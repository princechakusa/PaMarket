# PaMarket video agent — brief for the recurring build

You are creating a new 30-second PaMarket marketing video. This file is
self-contained. You have no memory of earlier conversations, so read it
fully before doing anything.

**What changed on 2026-09-29:** the founder no longer wants every video to
use the single dithered 3D bust in the same white layout ("same type of
videos", "not interactive"). Videos now use a **cast of characters** who
talk to each other and to the viewer, **picked per topic**, with a
**different format each time**. The reference build is `sample/index.html`
(the "Rudo's cushion" cast sample). Read it before writing anything.
`index.html` (the old dithered-bust video) is kept only as a fallback.

## What PaMarket is

A Zimbabwean marketplace app/website: buy, sell, rent, hire. Listings,
jobs, car rentals, property, institutions. Prices show in USD and ZiG
side by side. Real features you can draw a video from (check `git log
--oneline | grep 'feat'` and the `docs/` folder for the current list —
don't invent capabilities that don't exist): posting a listing, making
offers in-app, sharing a listing to WhatsApp Status, invite-a-friend,
scam warnings / reply-time badges / duplicate-photo checks / safe
meet-up spots, chiShona and isiNdebele language support, the AI help
assistant, job hiring pipeline, car rentals, price guides, map view, CV
as PDF, sellers listing their own delivery details.

## The cast

`cast/cast.json` lists every character: role, personality, which topics
they fit, their free-tier ElevenLabs voice, and each pose's mouth/jaw
coordinates for lip-sync. `cast/<name>/pose-N.png` are transparent
cut-outs. The founder adds new characters over time: a new
`cast/<name>/sheet.png` with no `pose-*.png` next to it means "cut this
one out" (see **Tools** below), then add it to `cast.json`.

- Pick **2–4 characters** whose `fits` match the topic. Rotate: don't lead
  with the same character two videos in a row (check `queue/*/notes.md`).
- Characters must **interact**: an offer card flies from one to the other,
  a split screen for the two sides of a deal, one character hands the
  story to the next, reactions (hop, lean, cheer). Don't make a slideshow
  of monologues.
- Respect each character's `caution` notes (garbled AI text on props,
  no invented PaMarket courier service, and don't mirror a pose whose
  clothing has text).

## Formats — rotate, never repeat the last one

Pick one, note which in `notes.md`, and don't reuse the previous video's:

1. **Skit**: 2–3 characters play out a real flow (the sample: list → offer
   → accept → price guide → safe meet-up).
2. **Sekuru explains**: one wise-elder tip, with big kinetic numbers
   (price guides, ZiG vs USD).
3. **Phone POV**: the app screen fills the frame, and characters pop in
   from the edges to react.
4. **Street vox-pop**: 3–4 characters each say one line to camera
   ("What I sold this week…"), with fast whip-pans between them.
5. **Editorial**: the older white layout with type, but a cast character
   replaces the dithered bust.

## The look (keep across formats)

- Pixar-style background plates behind sharp cut-out characters, with a
  soft depth-of-field blur on the background, a slow camera push, whip-pan
  or split-screen transitions, a warm grade, a vignette and light film grain.
- PaMarket UI cards (white, 1.5px border, `#2466e8` accent chips) living
  in **screen space**, so they survive camera moves and travel between
  scenes.
- **Burned-in captions** with the current word highlighted and a speaker
  label, plus a lower-third name tag the first time each character appears.
- Brand chrome: top-left `// NN — scene`, top-right `PAMARKET` timecode,
  bottom-right `pamarketzw.com`.
- End on a white card: logo, headline with one Caveat script word in blue
  with a drawn underline, `pamarketzw.com`, store badges, and the cast lined up.
- 1920×1080 and 1080×1920 from one file (`?format=9x16`, `P(h, v)` helper).
- **Everything is a pure function of `t`** (`render(t)`) so the preview
  and the frame-by-frame export match. No CSS transitions or animations.

## Backgrounds

Reuse `sample/bg/*.jpg` when they fit. For a new setting (car-rental
lot, campus, office, kombi rank), generate **one** plate with the
ElevenLabs MCP `creative_generate_image`, model `gemini-3.1-flash-image`,
16:9, `generations_count: 1` (~406 credits each). The prompt should ask for
a Pixar/Disney 3D render style, a Harare/Zimbabwe setting, empty floor
space for characters, and **no people, no text, no signs, no logos, no
number plates**. Upscale (see **Tools**) and save it as
`sample/bg/<name>.jpg` at 3840 px wide.

## Voice

**Free ElevenLabs tier only — never anything that needs payment.** Use
each character's `voice.id` from `cast.json` (model `eleven_v3`,
`generations_count: 1`, bracketed direction tags like `[warmly]` are
fine). If a new character needs a voice, try library voices with
`creative_generate_speech` until one doesn't return the "creator tier"
error; don't design new voices without the founder. The closing tagline
uses the Harare Presenter voice.

- **ZiG is spoken "Zigi"** (hard G). On-screen text and captions still say "ZiG".
- Keep the total dialogue at about 27 s so it fits 30 s: 6–8 short lines.
- Trim, compress pauses, then speed up by the voice's `tempo`:
  ```
  ffmpeg -i raw.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=stop_periods=-1:stop_duration=0.22:stop_threshold=-42dB:stop_silence=0.18,atempo=1.12" -ar 44100 vo/01-name.wav
  ```
- Lip-sync: run Rhubarb on each line with its script as dialog text:
  `rhubarb -q -f json -d 01-name.txt -o 01-name.lips.json 01-name.wav`.
  The composition reads `vo/<id>.lips.json` and drives each speaking
  character's jaw from it.
- Reuse `../music.mp3` as the bed unless the topic really needs a new
  mood (`eleven_music_v2`, ~30 s, no vocals). SFX come from `../sfx/`
  (`sh sfx/make-sfx.sh` regenerates them).

Look up today's ZiG-per-USD rate (`https://open.er-api.com/v6/latest/USD`,
field `rates.ZWG`) and set `ZIG_RATE`. If it's unreachable, keep the old
value and flag it in `notes.md`.

## Picking a topic

The founder wants topics tied to what's actually happening in Zimbabwe
that week:

1. Check real, public Zimbabwean news (Google News ZW RSS
   `https://news.google.com/rss?hl=en-ZW&gl=ZW&ceid=ZW:en`, Pindula,
   NewsDay, Techzim) for something a 30-second ad could genuinely connect
   to: fuel or ZiG pricing, jobs, back-to-school, salary day, a holiday,
   load-shedding. Don't fabricate a trend you didn't see.
2. Connect it only to a **real** PaMarket feature, and pick the cast to match.
3. If nothing connects, say so in `notes.md` and rotate to a feature not
   covered recently (`queue/*/topic.txt`).

## Building it

Copy `sample/` to a new folder `scenes/<slug>/` (keep `sample/` intact as
the reference). Edit `CAST`, the `VO` lines, `SFX`, the cards and the scene
timings in `render(t)`. Adding a speaking pose: copy its `mouth`/`jaw`/`drop`
from `cast.json`. For a pose not yet measured, run
`python cast/facegrid.py <name> <pose> 0.22`, read the lip line off the
grid, and save the values to `cast.json`.

Preview: `node preview.mjs scenes/<slug>/index.html`. Spot-check stills
before the full render:
```
node render.mjs --page scenes/<slug>/index.html --snap 1.5 6 12 18 24 28.5
node render.mjs --page scenes/<slug>/index.html --9x16 --snap 3 12 25 28.5
```
Look at every still. Check for cropped heads, cards covering faces or
captions, and garbled text on props. Then render:
```
node render.mjs --page scenes/<slug>/index.html --slug <slug>
node render.mjs --page scenes/<slug>/index.html --slug <slug> --9x16
```

## Tools

Local Windows machine: everything is installed in `../.video-tools/bin/`
(Rhubarb, Real-ESRGAN) and via pip (`rembg`, `scipy`). In a fresh Linux
sandbox:
```
pip install "rembg[cpu,cli]" scipy
curl -sSL -o rh.zip https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v1.14.0/Rhubarb-Lip-Sync-1.14.0-Linux.zip && unzip -q rh.zip
```
- Cut out a new sheet: `python cast/cutout.py <name>`. It needs
  `sheet@4x.png` first. With Real-ESRGAN:
  `realesrgan-ncnn-vulkan -i sheet.png -o sheet@4x.png -n realesrgan-x4plus -s 4`.
  If there's no GPU/Vulkan in the sandbox, make it with a Lanczos 4× resize
  in PIL instead.
- The first rembg run downloads its models (~1.1 GB).

## Handing off the finished video

You do **not** have credentials to publish or to write into the AMOS
database directly — don't attempt either. Your job ends at a finished,
reviewed pair of MP4s, a caption, and a clear written summary.

1. Create `queue/<YYYY-MM-DD>-<topic-slug>/` containing:
   - `pamarket-<slug>.mp4` (16:9) and `pamarket-<slug>-9x16.mp4` (9:16)
   - `topic.txt`: one line naming the topic
   - `caption.md`: the social caption + hashtags for Facebook/Instagram
   - `notes.md`: the format used, the cast used, the ZiG rate (live or
     placeholder), and anything you're unsure about or couldn't verify
2. `git add -f queue/<...>/*.mp4` (`.gitignore` blocks `*.mp4`, so force-add
   only inside `queue/`), plus the other new files and your
   `scenes/<slug>/` folder.
3. Commit on branch `amos-video-queue`. Branch fresh from the default
   branch's tip each run, and commit the text files **and** the MP4s in the
   **same commit**. The ingest workflow skips pushes that have no `.mp4`
   yet. Push it.
4. End your final message with the topic, format, cast, caption,
   branch/folder path, and every fact in `notes.md`.

## Rules to respect

- **Zimbabwe/Harare only.** Never depict another country's market.
- **No invented product capabilities.** Only show shipped features.
- **No phone/WhatsApp sign-in messaging.** That flow is soft-launched.
- **Free services only.** No paid ElevenLabs tier, no paid APIs.
- **Accents: Southern African, British or American only.** Never West African voices.
- 30 seconds, both aspect ratios.
