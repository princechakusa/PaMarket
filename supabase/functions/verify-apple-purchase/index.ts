// verify-apple-purchase — server-side verification of App Store CONSUMABLE
// purchases: listing boosts (boost_1day/7day/30day, plus job_boost_7day/30day
// which shares the same mechanism), business featured-slot packs
// (featured_slot_pack_1/3), job posting credit packs (job_credit_pack_1/5),
// and rental listing featured placement (rental_featured_slot_7day/30day).
// This is the exact iOS counterpart of verify-play-purchase — same ledger
// tables, same activation RPCs, same idempotency/ownership rules — the only
// thing that differs is HOW the purchase is verified (Apple's signed JWS
// instead of a call to the Android Publisher API) and that inserted rows
// are tagged platform='ios'.
//
// Call shape (boost):           POST { listingId: uuid, productId: 'boost_1day'|'boost_7day'|'boost_30day'|'job_boost_7day'|'job_boost_30day', purchaseToken }
// Call shape (slot pack):       POST { businessId: uuid, productId: 'featured_slot_pack_1'|'featured_slot_pack_3', purchaseToken }
// Call shape (job credit):      POST { productId: 'job_credit_pack_1'|'job_credit_pack_5', purchaseToken }
// Call shape (rental featured): POST { listingId: uuid, productId: 'rental_featured_slot_7day'|'rental_featured_slot_30day', purchaseToken }
// `purchaseToken` here is the client's StoreKit signed transaction JWS (see
// lib/iap.ts — expo-iap's Purchase.purchaseToken is documented as "Unified
// purchase token (iOS JWS, Android purchaseToken)").
// Auth: caller must be a signed-in user (their own JWT, not service-role).
//
// Flow:
//   1. Authenticate the caller via their bearer token.
//   2. Reject if this transaction was already recorded (anti-replay).
//   3. Insert a `pending` ledger row (platform='ios').
//   4. Verify the signed transaction JWS against Apple's certificate chain
//      (supabase/functions/_shared/apple-iap.ts) — confirms it's genuinely
//      Apple-signed, not expired/revoked, and for the expected bundle id.
//   5. Confirm the decoded productId matches what was requested and the
//      transaction hasn't been revoked (refunded).
//   6. On success: mark `verified`, call the activation RPC (service-role,
//      not callable by the client) to atomically grant the entitlement.
//   7. On failure at any step: mark `failed` with the reason, never activate.
//
// Unlike Google Play, Apple has no separate server-side "consume" call for
// StoreKit consumables — the client's finishTransaction() (called only
// after this function returns ok:true — see lib/iap.ts) is the equivalent
// action.
//
// Required Edge Function secrets: see supabase/functions/_shared/apple-iap.ts

import {
  BOOST_PRODUCTS,
  SLOT_PACK_PRODUCTS,
  JOB_CREDIT_PRODUCTS,
  JOB_BOOST_PRODUCTS,
  RENTAL_FEATURED_SLOT_PRODUCTS,
  getProductStatus,
} from "../_shared/billing-products.ts";
import { verifyTransactionJWS } from "../_shared/apple-iap.ts";

const ALLOWED_ORIGINS = new Set([
  "https://pamarketzw.com",
  "https://www.pamarketzw.com",
  "https://localhost",
  "capacitor://localhost",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://pamarketzw.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (d: unknown, s?: number) =>
    new Response(JSON.stringify(d), {
      status: s || 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );

    const authHeader = req.headers.get("Authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "").trim();
    if (!userJwt) return json({ error: "Missing authorization" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    const authResult = await authClient.auth.getUser(userJwt);
    if (authResult.error || !authResult.data?.user)
      return json({ error: "Invalid token" }, 401);
    const userId = authResult.data.user.id;

    const body = await req.json();
    const listingId = body?.listingId;
    const businessId = body?.businessId;
    const productId = body?.productId;
    const purchaseToken = body?.purchaseToken; // StoreKit signed transaction JWS

    if (!productId || !purchaseToken) {
      return json({ error: "productId and purchaseToken are required" }, 400);
    }
    const productStatus = getProductStatus(productId);
    if (productStatus === "planned") {
      return json(
        {
          ok: false,
          notImplemented: true,
          error: "This product is not available for purchase yet.",
        },
        501
      );
    }
    if (productStatus === "unknown") {
      return json({ error: "Unknown productId: " + productId }, 400);
    }

    // Decode+verify the JWS FIRST, before touching the DB at all, and use
    // the decoded transactionId (a stable numeric-string id) as the ledger's
    // purchase_token from here on — NOT the raw incoming JWS string. Apple
    // re-signs a transaction's JWS on every fetch (different bytes each
    // time even for the same logical purchase), so if the raw JWS were
    // stored, apple-notifications-webhook could never find this row again
    // when a later REFUND notification decodes to the same transactionId
    // but arrives as a completely different JWS blob.
    let decoded;
    try {
      decoded = await verifyTransactionJWS(purchaseToken);
    } catch (e) {
      return json(
        { error: "Purchase verification failed: " + (e as Error).message },
        402
      );
    }
    if (decoded.productId !== productId) {
      return json(
        {
          error: `Product mismatch: expected ${productId}, got ${decoded.productId}`,
        },
        402
      );
    }
    if (decoded.revocationDate) {
      return json({ error: "This purchase was refunded" }, 402);
    }
    if (decoded.appAccountToken && decoded.appAccountToken !== userId) {
      return json(
        { error: "This purchase belongs to a different account" },
        403
      );
    }
    if (!decoded.transactionId) {
      return json(
        { error: "Apple returned a transaction without an identifier" },
        402
      );
    }
    const ledgerToken = decoded.transactionId;

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isBoost =
      productId in BOOST_PRODUCTS || productId in JOB_BOOST_PRODUCTS;
    const slotCount = SLOT_PACK_PRODUCTS[productId]?.extraSlots;
    const creditCount = JOB_CREDIT_PRODUCTS[productId]?.credits;
    const rentalDays = RENTAL_FEATURED_SLOT_PRODUCTS[productId]?.days;
    if (!isBoost && !slotCount && !creditCount && !rentalDays)
      return json({ error: "Unknown productId: " + productId }, 400);

    const table = isBoost
      ? "play_purchases"
      : slotCount
      ? "featured_slot_packs"
      : rentalDays
      ? "rental_featured_slot_packs"
      : "job_credit_packs";
    const activateFn = isBoost
      ? "activate_play_boost"
      : slotCount
      ? "activate_featured_slot_pack"
      : rentalDays
      ? "activate_rental_featured_slot_pack"
      : "activate_job_credit_pack";
    const activateParam = isBoost ? "p_purchase_id" : "p_pack_id";

    let rentalCompanyId: string | null = null;
    if (isBoost) {
      if (!listingId)
        return json(
          { error: "listingId is required for a boost purchase" },
          400
        );
      const listingRes = await db
        .from("listings")
        .select("id, seller_id, category")
        .eq("id", listingId)
        .maybeSingle();
      if (listingRes.error || !listingRes.data)
        return json({ error: "Listing not found" }, 404);
      if (listingRes.data.seller_id !== userId)
        return json({ error: "You do not own this listing" }, 403);
      const isJobListing = listingRes.data.category === "jobs";
      const isJobBoostProduct = productId in JOB_BOOST_PRODUCTS;
      if (isJobBoostProduct && !isJobListing)
        return json(
          { error: "Job boost products can only be applied to job listings" },
          400
        );
      if (!isJobBoostProduct && isJobListing)
        return json(
          { error: "Use a job boost product to boost a job listing" },
          400
        );
    } else if (slotCount) {
      if (!businessId)
        return json(
          { error: "businessId is required for a featured-slot-pack purchase" },
          400
        );
      const bizRes = await db
        .from("businesses")
        .select("id, owner_user_id")
        .eq("id", businessId)
        .maybeSingle();
      if (bizRes.error || !bizRes.data)
        return json({ error: "Business not found" }, 404);
      if (bizRes.data.owner_user_id !== userId)
        return json({ error: "You do not own this business" }, 403);
    } else if (rentalDays) {
      if (!listingId)
        return json(
          {
            error: "listingId is required for a rental featured-slot purchase",
          },
          400
        );
      const rlRes = await db
        .from("rental_vehicle_listings")
        .select(
          "id, company_id, rental_companies!inner(id, business_id, businesses!inner(owner_user_id))"
        )
        .eq("id", listingId)
        .maybeSingle();
      if (rlRes.error || !rlRes.data)
        return json({ error: "Rental listing not found" }, 404);
      const ownerUserId = (rlRes.data as any).rental_companies?.businesses
        ?.owner_user_id;
      if (ownerUserId !== userId)
        return json({ error: "You do not own this rental listing" }, 403);
      rentalCompanyId = (rlRes.data as any).company_id;
    }

    // Anti-replay: same purchase_token column, now shared across platforms.
    // Keyed by the decoded transactionId, not the raw JWS — see comment above.
    const existing = await db
      .from(table)
      .select("id, status, expiry_time, user_id")
      .eq("purchase_token", ledgerToken)
      .maybeSingle();
    if (existing.error) {
      console.error(
        "verify-apple-purchase: existing-token lookup failed:",
        existing.error.message
      );
      return json(
        {
          error: "Could not check purchase history: " + existing.error.message,
        },
        500
      );
    }
    if (existing.data && existing.data.user_id !== userId) {
      return json(
        { error: "This purchase belongs to a different account" },
        403
      );
    }
    if (existing.data) {
      if (existing.data.status === "consumed") {
        return json({
          ok: true,
          already_processed: true,
          until: existing.data.expiry_time || null,
        });
      }
      if (existing.data.status === "verified") {
        const activateRes = await db.rpc(activateFn, {
          [activateParam]: existing.data.id,
        });
        if (activateRes.error || !activateRes.data?.ok) {
          console.error(
            "verify-apple-purchase: activation failed (retry branch):",
            activateRes.error?.message || activateRes.data?.msg
          );
          return json(
            {
              error:
                "Could not activate: " +
                (activateRes.error?.message || activateRes.data?.msg),
            },
            500
          );
        }
        return json({ ok: true, ...activateRes.data });
      }
      // pending/failed — fall through and re-attempt verification.
    }

    let purchaseRowId: string;
    if (existing.data) {
      purchaseRowId = existing.data.id;
    } else {
      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        product_id: productId,
        purchase_token: ledgerToken,
        status: "pending",
        platform: "ios",
      };
      if (isBoost) insertPayload.listing_id = listingId;
      else if (slotCount) {
        insertPayload.business_id = businessId;
        insertPayload.extra_slots = slotCount;
      } else if (rentalDays) {
        insertPayload.listing_id = listingId;
        insertPayload.company_id = rentalCompanyId;
        insertPayload.duration_days = rentalDays;
      } else insertPayload.credits = creditCount;

      const insertRes = await db
        .from(table)
        .insert(insertPayload)
        .select("id")
        .single();
      if (insertRes.error || !insertRes.data) {
        if (String(insertRes.error?.message || "").includes("unique")) {
          const raced = await db
            .from(table)
            .select("id,status,user_id,expiry_time")
            .eq("purchase_token", ledgerToken)
            .maybeSingle();
          if (raced.error || !raced.data) {
            return json(
              { error: "Could not resolve the concurrent purchase record" },
              409
            );
          }
          if (raced.data.user_id !== userId) {
            return json(
              { error: "This purchase belongs to a different account" },
              403
            );
          }
          if (raced.data.status === "consumed") {
            return json({
              ok: true,
              already_processed: true,
              until: raced.data.expiry_time || null,
            });
          }
          if (raced.data.status === "verified") {
            const racedActivation = await db.rpc(activateFn, {
              [activateParam]: raced.data.id,
            });
            if (racedActivation.error || !racedActivation.data?.ok) {
              return json(
                { error: "Could not activate the verified purchase" },
                500
              );
            }
            return json({ ok: true, ...racedActivation.data });
          }
          return json(
            {
              error: "This purchase is still being verified. Please try again.",
            },
            409
          );
        }
        return json(
          { error: "Could not record purchase: " + insertRes.error?.message },
          500
        );
      }
      purchaseRowId = insertRes.data.id;
    }

    // JWS was already decoded+verified above (before the DB was touched at
    // all), so no second verification call is needed here.
    const verifiedRes = await db
      .from(table)
      .update({
        status: "verified",
        order_id: decoded.transactionId || null,
        purchase_time: decoded.purchaseDate
          ? new Date(decoded.purchaseDate).toISOString()
          : null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", purchaseRowId);
    if (verifiedRes.error) {
      console.error(
        "verify-apple-purchase: failed to record verified status:",
        verifiedRes.error.message
      );
      return json(
        {
          error:
            "Purchase verified with Apple but could not be recorded: " +
            verifiedRes.error.message,
        },
        500
      );
    }

    const activateRes = await db.rpc(activateFn, {
      [activateParam]: purchaseRowId,
    });
    if (activateRes.error || !activateRes.data?.ok) {
      console.error(
        "[BILLING_ALERT] verify-apple-purchase: verified-but-activation-failed:",
        activateRes.error?.message || activateRes.data?.msg
      );
      return json(
        {
          error:
            "Purchase verified but activation failed: " +
            (activateRes.error?.message || activateRes.data?.msg),
        },
        500
      );
    }

    // No separate "consume" call for Apple — mark consumed immediately so
    // the ledger's terminal state matches the Play path's shape; the actual
    // client-side finishTransaction() (equivalent action) happens after this
    // response, gated on ok:true, same as the Play flow's consume step.
    await db.from(table).update({ status: "consumed" }).eq("id", purchaseRowId);

    return json({ ok: true, ...activateRes.data });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
