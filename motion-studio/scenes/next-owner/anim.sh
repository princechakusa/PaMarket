#!/bin/sh
# One LTX-Video run per shot (8 runs total). Ordered by importance, so if the daily
# free quota runs out, the shots that matter most are already done. Skips finished clips.
# Run with HF_TOKEN set. Durations match the voice timeline in index.html (+0.3 s spare).
cd "$(dirname "$0")"
v() { [ -f "gen/$1.mp4" ] && { echo "skip $1"; return; }; python gen.py vid "$@" || exit 1; }
v f-ride  gen/f-ride.png  "The young woman pedals the bicycle smoothly forward along the street, her braids swaying in the wind, big smile, the camera tracks alongside her, purple jacaranda blossoms drift through the air" 3.1 11
v e-meet  gen/e-meet.png  "The man hands the bicycle over to the young woman, they both laugh warmly and she takes the handlebars, shoppers walk past in the background, gentle camera push-in" 4.6 12
v a-yard  gen/a-yard.png  "The man walks forward through the open gate towards the camera, smiling, wheeling the old bicycle beside him, washing on the line sways in the breeze, slow camera push-in" 4.7 13
v b-photo gen/b-photo.png "The man raises his smartphone and takes a photo of his bicycle, then smiles proudly, nodding, gentle handheld camera movement" 4.1 14
v h-hug   gen/h-hug.png   "The father and his little daughter hug tightly and rock gently from side to side, both smiling with eyes closed, warm golden sunset light, slow camera push-in" 2.8 15
v c-chipo gen/c-chipo.png "The young woman looks at her phone, gasps with excitement, then talks quickly and happily, her braids moving, slight camera push-in" 2.5 16
v g-shoes gen/g-shoes.png "The little girl gasps and bounces with joy, hands on her cheeks, as her smiling father holds out the orange shoebox to her" 2.4 17
v d-accept gen/b-photo.png "Close-up feel: the man looks down at the screen of his smartphone and bursts out laughing with delight, nodding, camera slowly pushes in towards his face" 2.9 18
ls -la gen/*.mp4
