# PaMarket video agent — brief for the recurring build

You are creating a new 30-second PaMarket marketing video, in the exact
style approved by the founder on 2026-09-28. This file is self-contained —
you have no memory of earlier conversations, so read it fully before doing
anything.

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
as PDF.

## The visual style (do not deviate)

Reference: `index.html` in this folder is the last shipped video
("Got something to sell?" — for sellers). Read it before writing
anything. Keep:

- **Layout**: white (`#ffffff`) editorial background, 1920×1080 (and a
  1080×1920 vertical mode, `?format=9x16`, already built into the file —
  reuse the same `V` flag pattern, don't rebuild it).
- **Chrome**: top-left `// NN — scene name` in JetBrains Mono, top-right
  `PAMARKET   HH:MM:SS:FF` timecode, bottom-left a `■■■□□` scene-progress
  counter, bottom-right `pamarketzw.com`.
- **Headline type**: Inter Tight 600, ~150px, black, with one accent line
  set in Caveat (script font) coloured `#2466e8` and hand-drawn SVG
  underline.
- **Character**: the halftone/dithered 3D bust (Three.js + Bayer-dither
  shader, see the `THREE.*` block and the `postMat` fragment shader) —
  reuse it exactly as built, only retime his gestures (arm/head keyframe
  arrays) to match the new script's beats. Do not redesign the character.
- **UI cards**: white cards with a 1.5px border, generous radius,
  `#2466e8` accent chips — same visual language as the listing card /
  offer card / status card in the current file. Build new cards for
  whatever the new topic needs (e.g. a rental car card, a job posting
  card), following the same `.card`/`.ui` CSS patterns already defined.
- **Everything is a pure function of time `t`** (see the `render(t)`
  function) so the preview and the frame-by-frame export always match.
  Keep this architecture. Don't introduce CSS animations/transitions that
  aren't driven by `t`.

## Picking a topic

List `queue/*/topic.txt` in this folder (create `queue/` if absent) —
each past run recorded its topic there. Pick something **not** already
used, drawn from real shipped features (see above). Good next topics:
job hiring / CV as PDF, car rentals, safe meet-up + trust features (if
not already the focus), price guides + map view, the AI help assistant,
institutions/campus listings. Write one clear sentence of what the video
is about before starting.

## The voiceover

Reuse the saved ElevenLabs voice **"PaMarket — Harare Presenter"**,
`voice_id: UqVoYflBV54bEWmZcrK6` (Zimbabwean, warm, upbeat) — do not
design a new voice. Use the ElevenLabs MCP tools available to you
(`creative_generate_speech`, model `eleven_v3`) for 7–9 short lines
matching your new script's scenes, then `eleven_music_v2` for a ~30s
instrumental bed (same style as before: bright, warm, Afro-pop-ish,
sparse enough to sit under narration, no vocals).

**Pronunciation rule**: the currency ZiG is spoken **"Zigi"** (hard G,
like ga-ge-gi-go-gu) in any voiceover — never "zig" or "ziji". The
on-screen text still reads "ZiG".

After generating each line, download the audio, then trim silence with:
```
ffmpeg -i raw.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse" -c:a libmp3lame -q:a 2 vo/01.mp3
```
Save trimmed lines to `vo/01.mp3`, `vo/02.mp3`, etc. and the music to
`music.mp3`. Regenerate the small UI sound library (shutter/tap/ping/
pop/whoosh/tick) with `sh sfx/make-sfx.sh` — don't hand-author these,
the script already exists.

If a live source is reachable, look up today's real ZiG-per-USD rate
(the app fetches it from `https://open.er-api.com/v6/latest/USD`,
field `rates.ZWG`) and set it as `ZIG_RATE` near the top of the script.
If not reachable, keep whatever rate is already in the file and note in
your final summary that it's a placeholder needing a refresh.

## Editing the composition

Edit `index.html` in place (same file, same engine) — change the `SC`
scene-copy array, the UI card markup/positions, the character pose
keyframe arrays (`rKeys`/`lKeys`/`headX`/etc.), and the `VO` array's
`.text` and `.at` timings to match your new script. Keep the file
structure (the math helpers, the Three.js rig, the dither shader, the
render loop, the preview player) untouched unless something is actually
broken.

## Rendering

```
cd motion-studio
npm install   # if node_modules isn't already present
npx playwright install --with-deps chromium   # if not already installed
node render.mjs            # 1920×1080 → out/pamarket-<slug>.mp4
node render.mjs --9x16      # 1080×1920 → out/pamarket-<slug>-9x16.mp4
```
Use `node render.mjs --snap 1.2 8 15 22 28` first to spot-check a few
frames (`shots/*.png`) before committing to the full 900-frame render —
it's much cheaper to catch a layout mistake early.

## Handing off the finished video

You do **not** have credentials to publish or to write into the AMOS
database directly — don't attempt either. Your job ends at: a finished,
reviewed pair of MP4s, a caption, and a clear written summary.

1. Create a folder `queue/<YYYY-MM-DD>-<topic-slug>/` containing:
   - `pamarket-<slug>.mp4` (16:9) and `pamarket-<slug>-9x16.mp4` (9:16)
   - `topic.txt` — one line naming the topic (so the next run doesn't repeat it)
   - `caption.md` — the finished social caption + hashtags, written for
     Facebook/Instagram, matching the tone of prior posts (see git log
     for the caption used on the last video if useful context)
   - `notes.md` — anything the human reviewer should know: the ZiG rate
     used and whether it's live or placeholder, any content you're
     unsure about, anything you couldn't verify
2. `git add -f queue/<...>/*.mp4` (the repo's `.gitignore` blocks `*.mp4`
   deliberately for the working engine — force-add only inside `queue/`)
   plus the other new files in that folder, and your `index.html` edits.
3. Commit on branch `amos-video-queue` (create it from the default
   branch if it doesn't exist yet; if it does, branch again from the
   default branch's current tip each run rather than stacking on the
   previous run's commit, so each run's diff is easy to review alone).
   Push it.
4. End your final message with: the topic you chose, the caption, the
   branch/folder path, and every fact in `notes.md`. This is what the
   founder or a follow-up session will read to move it into the AMOS
   approval queue — the video does not go live on its own.

## Rules to respect

- **Zimbabwe/Harare only.** Every video is about the Zimbabwean market;
  never depict or reference another country's market as the setting.
- **No invented product capabilities.** Only show features that
  genuinely exist in the shipped app (check `git log`/`docs/` — don't
  guess).
- **No phone/WhatsApp sign-in messaging** — that flow is deliberately
  soft-launched, not a marketing point yet.
- Keep the whole video to 30 seconds, both aspect ratios.
