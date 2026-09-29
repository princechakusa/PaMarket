# Notes for the reviewer — 2026-09-29 "Your stall, online"

**What it's about (one sentence):** Harare traders can run their stall on PaMarket —
price it with the price guide, offer collection or delivery, get found on the map,
share one shop link, and meet buyers at safe public spots.

**News angle:** Harare City Council's vending crackdown ("Operation Chenesa Harare")
this past week — vendor evictions and clashes on First Street, CHRA calling for viable
vending sites. Sources: 263Chat, "Harare Vendors Caught Between By-Laws and the Fight to
Survive" (28 Sep 2026); NewsDay, "'Harare council must take responsibility for vendor
evictions'" (25 Sep 2026); both surfaced via Google News Zimbabwe on 2026-09-29.

**Sensitivity — please judge the timing.** The video never mentions the crackdown,
the council, evictions or any party. It only says "Trading in Harare? Take your stall
online." It's a positive, empathetic angle, but it could read as opportunistic if posted
while clashes are in the headlines. Consider posting a few days later, or with a
caption that doesn't reference the crackdown (the provided caption doesn't).

**ZiG rate:** 26.847 ZiG per US$ — LIVE, from open.er-api.com (`rates.ZWG`), last
updated Tue 29 Sep 2026 00:02 UTC. On screen: US$ 15 → "ZiG 403" (15 × 26.847 = 402.7).

**Features shown (all verified in git log / code):**
- Price guide — `feat(discovery)` 46c7981; post screen shows "PRICE GUIDE" with a
  US$ range of similar ads (components/PriceGuide.tsx). Only shows when 5+ comparable
  ads exist; the on-screen "US$ 12 – 18" for a denim jacket is illustrative, not real data.
- Delivery option (Collection / Delivery in my city / Delivery nationwide) — 008689c.
- Map view with price pins — 46c7981 (search List/Map toggle). Pins/prices illustrative.
- "Share Shop Link" (WhatsApp, bio) — 008689c; this is on the **Business dashboard**,
  i.e. for business/shop accounts, not every individual seller. The VO says "Share your
  shop link", which is accurate for shop accounts. Link on screen is shortened
  ("pamarketzw.com/b/tendais-threads-…"); real links are `/b/<slug>-<id>`.
- "Meet safely in Harare" safe meeting spots — 4e5d62b; Eastgate Mall, Sam Levy's
  Village, Joina City are in the seeded list (admin-managed, could change).
- "Tendai's Threads" is a made-up example shop name.

**Not included (per rules):** no phone/WhatsApp sign-in messaging; Zimbabwe/Harare only.

**Voice-over** (saved voice "PaMarket — Harare Presenter", eleven_v3), transcribed back
with Scribe and it matches word for word:
1. Trading in Harare? 2. Take your stall online, with PaMarket. 3. Not sure what to charge?
The price guide shows what similar ads are asking. 4. Offer collection, delivery in your
city, or nationwide. 5. Buyers nearby find you on the map. 6. Share your shop link on
WhatsApp, and in your bio. 7. And meet safely at busy spots, like Eastgate or Sam Levy's.
8. PaMarket. Buy, sell, rent, hire.
ZiG is not spoken in this script, so the "Zigi" pronunciation rule didn't come up.

**Music:** eleven_music_v2, 30s, Afro-pop instrumental. The node's "instrumental" flag
read False, but a Scribe pass over the track returned no words (no vocals detected).
Worth a quick listen anyway.

**Engine changes (motion-studio/render.mjs):** output file named from `SLUG` in
index.html instead of the hard-coded "for-sellers"; optional `CHROME_PATH` fallback
for the browser; and when `HTTPS_PROXY` is set, CDN/font requests are fetched via Node
(the cloud sandbox's Chromium didn't trust the proxy CA). No effect on a normal machine.
