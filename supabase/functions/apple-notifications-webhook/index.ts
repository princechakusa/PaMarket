// apple-notifications-webhook — receives App Store Server Notifications V2
// for lifecycle events (renewal, cancellation, billing retry, grace period,
// refund, revocation) that happen on Apple's own schedule, not at a moment
// the app calls verify-apple-purchase / verify-apple-subscription. Exact iOS
// counterpart of play-rtdn-webhook — same "always re-fetch truth, never
// trust the event payload's own claims" philosophy, same two subscription
// families (shop plans, recruiter plans), same downgrade-to-free logic, and
// the SAME revoke_play_purchase RPC for refunded consumables (it's purely
// purchase_token-keyed and platform-agnostic — no Apple-specific version
// needed).
//
// Request body (from Apple):
//   { signedPayload: <JWS> }
// Decoded payload (ResponseBodyV2DecodedPayload):
//   { notificationType, subtype?, data: { bundleId, environment,
//     signedTransactionInfo, signedRenewalInfo? } }
//
// notificationType values that matter here:
//   SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW,
//   GRACE_PERIOD_EXPIRED, EXPIRED, REFUND, REVOKE, CONSUMPTION_REQUEST
// (others — PRICE_INCREASE, OFFER_REDEEMED, TEST, etc. — are ack'd and
// otherwise ignored; they don't change entitlement state on their own.)
//
// Configure this function's URL in App Store Connect → your app → General
// → App Store Server Notifications → Production/Sandbox Server URL. Apple
// signs the payload itself (no separate transport-level auth like Pub/Sub's
// OIDC) — verifyNotificationPayload() is the authentication here, via the
// same certificate-chain check used for client-supplied transaction JWS.
//
// Required Edge Function secrets: see supabase/functions/_shared/apple-iap.ts

import {
  verifyNotificationPayload,
  verifyTransactionJWS,
  fetchAppleSubscriptionStatus,
} from "../_shared/apple-iap.ts";
import {
  SUBSCRIPTION_PRODUCTS,
  RECRUITER_SUBSCRIPTION_PRODUCTS,
} from "../_shared/billing-products.ts";

function json(d: unknown, s?: number) {
  return new Response(JSON.stringify(d), {
    status: s || 200,
    headers: { "Content-Type": "application/json" },
  });
}

const SUBSCRIPTION_REFUND_TYPES = new Set(["REFUND", "REVOKE"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const signedPayload = body?.signedPayload;
    if (!signedPayload) return json({ ok: true, skipped: "no signedPayload" }); // ack — malformed, nothing to retry

    let notification;
    try {
      notification = await verifyNotificationPayload(signedPayload);
    } catch (e) {
      console.warn(
        "apple-notifications-webhook: rejected unverifiable payload:",
        (e as Error).message
      );
      return json({ error: "Unauthorized" }, 403);
    }

    const notificationType = notification.notificationType as string;
    const signedTransactionInfo = notification.data?.signedTransactionInfo;
    if (!signedTransactionInfo) {
      // Some notification types (e.g. TEST) carry no transaction — nothing
      // to reconcile, ack and move on.
      return json({ ok: true, skipped: "no transaction info" });
    }

    let decoded;
    try {
      decoded = await verifyTransactionJWS(signedTransactionInfo);
    } catch (e) {
      console.error(
        "apple-notifications-webhook: could not verify embedded transaction:",
        (e as Error).message
      );
      return json({ error: "Could not verify embedded transaction" }, 500); // retry
    }

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isConsumable =
      decoded.type === "Consumable" || decoded.type === "Non-Consumable";
    const isSubscription = decoded.type === "Auto-Renewable Subscription";

    // Refunded/revoked ONE-TIME purchases (boosts, slot packs, job credits,
    // rental featured) — reverse the entitlement. revoke_play_purchase is
    // idempotent and resolves transactionId across all four consumable
    // ledgers, keyed by the same purchase_token column verify-apple-purchase
    // now populates with decoded.transactionId (not the raw JWS).
    if (isConsumable && SUBSCRIPTION_REFUND_TYPES.has(notificationType)) {
      const revokeRes = await db.rpc("revoke_play_purchase", {
        p_purchase_token: decoded.transactionId,
      });
      if (revokeRes.error) {
        console.error(
          "[BILLING_ALERT] apple-notifications-webhook: revoke_play_purchase failed:",
          revokeRes.error.message
        );
        return json({ error: revokeRes.error.message }, 500); // retry
      }
      console.log(
        "apple-notifications-webhook: refunded consumable processed:",
        JSON.stringify(revokeRes.data)
      );
      return json({ ok: true, voided: revokeRes.data });
    }

    if (!isSubscription) {
      // A consumable notification we don't act on (e.g. CONSUMPTION_REQUEST,
      // which just asks the app to report consumption status back to Apple
      // — not something this app currently automates) — ack, nothing to do.
      return json({ ok: true, skipped: "not a subscription lifecycle event" });
    }

    const originalTransactionId = decoded.originalTransactionId;
    if (!originalTransactionId)
      return json({ ok: true, skipped: "no originalTransactionId" });

    // This webhook handles two subscription families that share identical
    // lifecycle mechanics but live in different tables — check shop
    // subscriptions first, then recruiter subscriptions, since a given
    // originalTransactionId belongs to exactly one.
    const existing = await db
      .from("play_subscriptions")
      .select("id")
      .eq("purchase_token", originalTransactionId)
      .maybeSingle();
    if (existing.error) return json({ error: existing.error.message }, 500); // retry

    let isRecruiter = false;
    let rowId: string;
    if (existing.data) {
      rowId = existing.data.id;
    } else {
      const existingRecruiter = await db
        .from("play_recruiter_subscriptions")
        .select("id")
        .eq("purchase_token", originalTransactionId)
        .maybeSingle();
      if (existingRecruiter.error)
        return json({ error: existingRecruiter.error.message }, 500);
      if (!existingRecruiter.data) {
        // Never-seen originalTransactionId — most likely a subscription
        // started before this webhook existed, or a race with
        // verify-apple-subscription's own insert. Ack without erroring; the
        // next lifecycle event or reconciliation poll will pick it up once
        // the row exists.
        return json({ ok: true, skipped: "unknown originalTransactionId" });
      }
      isRecruiter = true;
      rowId = existingRecruiter.data.id;
    }

    const table = isRecruiter
      ? "play_recruiter_subscriptions"
      : "play_subscriptions";
    const activateFn = isRecruiter
      ? "activate_recruiter_subscription"
      : "activate_play_subscription";
    const activateParam = isRecruiter
      ? "p_play_recruiter_subscription_id"
      : "p_play_subscription_id";
    const lifecycleTable = isRecruiter
      ? "recruiter_subscriptions"
      : "business_subscriptions";
    const lifecycleFk = isRecruiter ? "recruiter_id" : "business_id";
    const downgradeTable = isRecruiter ? "recruiter_profiles" : "businesses";
    const downgradeIdColumn = isRecruiter ? "recruiter_id" : "business_id";

    // Always re-fetch the AUTHORITATIVE current state rather than trusting
    // this notification's own type/subtype to infer it — same rule
    // play-rtdn-webhook follows for subscriptionsv2, and Apple's own docs
    // recommend the equivalent for getAllSubscriptionStatuses.
    const sub = await fetchAppleSubscriptionStatus(originalTransactionId);
    if (!sub.ok) return json({ error: sub.reason }, 500); // transient Apple-side error — retry

    const mapped = sub.productId
      ? isRecruiter
        ? RECRUITER_SUBSCRIPTION_PRODUCTS[sub.productId]
        : SUBSCRIPTION_PRODUCTS[sub.productId]
      : null;
    if (!sub.productId || !mapped)
      return json(
        { error: "Apple returned an unknown subscription product" },
        500
      );

    const verifiedRes = await db
      .from(table)
      .update({
        status: "verified",
        product_id: sub.productId,
        plan_id: mapped.planId,
        billing_cycle: mapped.cycle,
        subscription_state: sub.subscriptionState,
        auto_renewing: sub.autoRenewing,
        order_id: sub.transactionId || null,
        expiry_time: sub.expiryTime || null,
      })
      .eq("id", rowId);
    if (verifiedRes.error) {
      console.error(
        "apple-notifications-webhook: failed to record verified status for",
        rowId,
        ":",
        verifiedRes.error.message
      );
      return json({ error: verifiedRes.error.message }, 500); // retry — state wasn't recorded
    }

    const activateRes = await db.rpc(activateFn, { [activateParam]: rowId });
    // Success requires BOTH no transport/DB error AND the RPC's own jsonb
    // payload saying ok:true — see verify-apple-subscription for the same
    // rule. A silent business-logic failure here must not be acked as 200,
    // or Apple will never redeliver an event that needs reprocessing.
    if (activateRes.error || activateRes.data?.ok !== true) {
      console.error(
        "[BILLING_ALERT] apple-notifications-webhook: activation failed for",
        rowId,
        ":",
        activateRes.error?.message || activateRes.data?.msg
      );
      return json(
        {
          error:
            activateRes.error?.message ||
            activateRes.data?.msg ||
            "activation returned ok:false",
        },
        500
      );
    }

    // If the subscription is no longer active/in-grace, downgrade the
    // business/recruiter back to Free immediately rather than waiting for a
    // client-side expiry sweep to notice — that sweep only runs when the
    // OWNER'S device happens to boot the app.
    if (
      sub.subscriptionState !== "active" &&
      sub.subscriptionState !== "in_grace_period"
    ) {
      const rowRes = await db
        .from(table)
        .select(downgradeIdColumn)
        .eq("id", rowId)
        .single();
      if (rowRes.error) {
        console.error(
          "apple-notifications-webhook: could not read",
          downgradeIdColumn,
          "for downgrade, rowId",
          rowId,
          ":",
          rowRes.error.message
        );
        return json(
          { error: "Downgrade lookup failed: " + rowRes.error.message },
          500
        ); // retry
      }
      const targetId = (rowRes.data as Record<string, string> | null)?.[
        downgradeIdColumn
      ];
      if (targetId) {
        const expireRes = await db
          .from(lifecycleTable)
          .update({ status: "expired" })
          .eq(lifecycleFk, targetId)
          .eq("status", "active");
        if (expireRes.error) {
          console.error(
            "apple-notifications-webhook: failed to expire",
            lifecycleTable,
            "for",
            targetId,
            ":",
            expireRes.error.message
          );
          return json(
            {
              error:
                "Could not expire subscription record: " +
                expireRes.error.message,
            },
            500
          ); // retry
        }

        // Entitlement-integrity-critical write: if it silently fails, a
        // lapsed/canceled subscriber keeps paid-tier access indefinitely.
        // Must be checked and must cause a retry, never a silent 200.
        const downgradeRes = await db
          .from(downgradeTable)
          .update({ plan_id: "free" })
          .eq("id", targetId);
        if (downgradeRes.error) {
          console.error(
            "[BILLING_ALERT] apple-notifications-webhook: FAILED to downgrade",
            downgradeTable,
            targetId,
            "to free plan:",
            downgradeRes.error.message
          );
          return json(
            {
              error:
                "Could not downgrade to free plan: " +
                downgradeRes.error.message,
            },
            500
          ); // retry
        }
      }
    }

    return json({ ok: true });
  } catch (err) {
    // Only a genuinely malformed/unparseable payload should be acked
    // (retrying it would never succeed differently). Anything else —
    // network errors, unexpected exceptions from the DB/Apple API calls
    // above — is a transient failure Apple should redeliver, so it must
    // NOT be silently acked as ok:true.
    const message = (err as Error).message || String(err);
    const isParseFailure = err instanceof SyntaxError || /JSON/i.test(message);
    console.error(
      "apple-notifications-webhook error:",
      message,
      isParseFailure
        ? "(treated as non-retryable parse failure)"
        : "(treated as transient — requesting retry)"
    );
    if (isParseFailure) return json({ ok: true, error: message });
    return json({ error: message }, 500);
  }
});
