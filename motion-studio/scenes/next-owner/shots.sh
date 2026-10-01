#!/bin/sh
# Key stills for "Everything has a next owner". Needs HF_TOKEN in the environment.
cd "$(dirname "$0")"
TEN="Baba Tendai, a friendly 45-year-old Zimbabwean father with a youthful face, dark brown skin, short black hair with a little grey at the temples, short neat black beard, light-blue checked short-sleeve shirt, khaki trousers, brown leather shoes"
CHI="Chipo, a cheerful 21-year-old Zimbabwean woman, dark brown skin, long black box braids tied in a high ponytail, mustard-yellow jacket over a plain white t-shirt with no print, dark blue jeans, white sneakers, small red backpack"
RUF="Rufaro, a cheerful 8-year-old Zimbabwean girl, dark brown skin, hair in two round afro puffs, light-blue school dress with a white collar, white socks"
BIKE="an old black roadster bicycle with a chrome rear carrier rack"
g() { python gen.py img "$@"; }
[ -f gen/a-yard.png ]   || g a-yard   "Wide shot, eye level. $TEN, smiling, walking and wheeling $BIKE out through the open green metal gate of his small red-brick house in Highfield, Harare. Low precast concrete wall, a washing line with colourful clothes, a big mango tree, swept dusty yard, bright early morning sun, long soft shadows" 101
[ -f gen/b-photo.png ]  || g b-photo  "Medium shot. $TEN standing in his swept yard in Highfield, Harare, holding up a smartphone with both hands to take a photo of $BIKE leaning against a low precast concrete wall, happy focused expression, morning sun, mango tree" 202
[ -f gen/c-chipo.png ]  || g c-chipo  "Medium shot. $CHI, holding one smartphone in both hands at chest height and looking at the screen with excited wide eyes and an open-mouth smile, standing on a sunny pavement in Harare city centre with purple jacaranda trees and a white kombi minibus softly blurred behind her" 303
[ -f gen/d-accept.png ] || g d-accept "Close-up. $TEN in his yard, looking down at a smartphone in his hand and breaking into a big delighted laugh, warm morning light, mango tree leaves softly blurred behind him" 404
[ -f gen/e-meet.png ]   || g e-meet   "Wide shot. $TEN and $CHI shaking hands and smiling at each other, standing beside $BIKE in front of a busy, colourful suburban shopping centre in Harare in bright daylight, shoppers walking in the background, a covered walkway and shopfronts with awnings, purple jacaranda tree" 505
[ -f gen/f-ride.png ]   || g f-ride   "Side view tracking shot. $CHI, joyful, riding $BIKE with a red plastic crate strapped to the rear rack, pedalling along a quiet Harare suburban street lined with blooming purple jacaranda trees, purple blossoms on the road and falling in the air, afternoon sun, motion" 606
[ -f gen/g-shoes.png ]  || g g-shoes  "Medium shot, golden evening light. $TEN kneeling on one knee in his yard, smiling and holding out an orange shoebox to his daughter $RUF, who gasps with delight with both hands on her cheeks, red-brick house and green gate behind them, warm sunset" 707
[ -f gen/h-hug.png ]    || g h-hug    "Medium shot, golden evening light. $RUF hugging her father $TEN tightly around his neck while he kneels and hugs her back with his eyes closed, happy tears, a new pair of shiny black school shoes on the ground beside them, red-brick house, warm sunset glow" 808
ls -la gen
