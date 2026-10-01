# Notes for the reviewer: 2026-10-01 "Know what's fair"

**Format:** 2. Sekuru explains (one elder's tip with big kinetic numbers). The last video
(2026-09-30, "Rudo's cushion") was a Skit led by Rudo, so this one uses a different format and
Sekuru leads.

**Cast:** Sekuru Tadiwa (lead, explains), Tariro (buyer, asks if US$ 25 is too much, then sends
the offer), Rudo (seller, priced the jacket with the guide, accepts the offer).
How they interact: Tariro asks Sekuru, and a split screen hands her listing card across to him.
He answers with the price guide. Rudo then explains how she priced it. Tariro sends the offer over
a split screen and Rudo accepts it, with confetti.

**News angle:** "Zimbabwe's ZiG and USD inflation accelerate in September 2026" (NewsDay and
Pindula News, 25 Sep 2026). Related: "RBZ admits Zimbabwe still not ready for mono-currency"
(ZimEye, 28 Sep). All were found through Google News Zimbabwe on 2026-10-01. The video never
quotes an inflation figure. It only says "prices keep moving, in US dollars and in ZiG".

**ZiG rate:** 26.7965 ZiG per US$. This is LIVE, from open.er-api.com (`rates.ZWG`), last updated
Thu 1 Oct 2026 00:02 UTC. On screen: US$ 25 → "≈ ZiG 670" (25 × 26.7965 = 669.9).
The rolling numbers in the opener (US$ 23–29, each shown with its ZiG value at today's rate) are
illustrative "prices keep moving" motion, not real data.

**Features shown (all checked in the code):**
- Price guide, from commit 46c7981 (`apps/mobile/components/PriceGuide.tsx`). The buyer-side card uses
  the app's listing-page wording, "TYPICAL PRICE · Most similar ads in Harare are priced in this
  range." The seller-side card uses the post-screen wording, "PRICE GUIDE · Similar ads in Harare
  are priced in this range." The real guide is US$-only and only shows when there are 5+ comparable
  ads. The range "US$ 18 – US$ 30" and the range bar with the "This jacket" marker are illustrative.
  The app shows the range as text, without a bar.
- "≈ ZiG" next to a US$ price (`approxOtherCurrency` in `lib/listings.ts`, used on the listing page).
- Make offer, offer accepted, and LIVE after posting, all as in earlier videos.
- "Denim jacket", seller Rudo, Mbare, is a made-up example. The jacket "photo" is a drawn SVG,
  not an AI image, so it has no garbled text.

**Voices.** Please read this one. The free tier was blocked partway through this run.
- Sekuru: Dr Samuel Rosso `L5zW3PqYZoWAeS4J1qMV` (tempo 1.10).
- Rudo: Chulu `Bn5h1jUGRkTAdBGY2icT` (1.12).
- Tagline: Harare Presenter `UqVoYflBV54bEWmZcrK6` (1.06).
- Tariro: **Laura `FGY2WhTYpPnrIDTdsKH5`, an ElevenLabs premade voice with an American accent**
  (1.08). Three South African library voices (Stacy, AVA, Kim) returned "You need to be on the
  creator tier". Laura's id is now saved for Tariro in `cast/cast.json`. Please confirm you're happy
  with her as Tariro's voice.
- Right after those 5 lines, ElevenLabs rejected the next request: "Unusual activity has been
  detected on your account, so Free Tier access has been disabled … Please upgrade". Because of
  that, a planned 6th line (Tariro: "A fair price! Sending my offer.") was never made. That beat
  plays silently, with music and SFX only. I didn't retry, and I didn't use any paid option.
  **Future runs will have no ElevenLabs voices until the account is sorted out.**
- "ZiG" is spoken as "Zigi" in every line. The captions say "ZiG". I couldn't listen to the audio
  in the sandbox, and Scribe transcription was blocked by the same lockout, so the pronunciation
  and wording haven't been checked by ear. Please listen once.

**Music:** I couldn't use ElevenLabs music (same lockout), and `music.mp3` isn't in the repo. The
bed is synthesised locally by `scenes/fair-price/tools/music.py`: a 104 BPM mbira-style
arpeggio, bass, shaker and soft kick. No samples, no vocals, nothing paid. It's simple, so it's
worth a listen. Replace it if it sounds thin.

**Engine changes:** No change to `render.mjs`: this branch already has the `CHROME_PATH` and
proxy fallbacks from 2026-09-29, and the run used them. The scene self-hosts its Google Fonts in
`scenes/fair-price/fonts/`, because the sandbox's Chromium rejected the proxy certificate. It also
adds anchored caption timing (`marks`) and diagonal split-screen helpers. Note: I built on the
existing `amos-video-queue` branch with `master` merged in, rather than restarting it from
`master`, because restarting would have needed a force-push.

**Rules check:** Harare and Mbare settings only. No phone/WhatsApp sign-in messaging. No invented
features: no PaMarket courier, and Farai isn't used. Accents are South African for Sekuru and
Rudo, Harare Presenter for the tagline, and American for Tariro.
