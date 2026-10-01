# Writes shots/face-<name>-<pose>.png: the head area of a pose with a labelled pixel grid,
# used to read off mouth coordinates for cast.json.  python cast/facegrid.py rudo 2 [top_frac]
import sys
from pathlib import Path
from PIL import Image, ImageDraw

name, pose = sys.argv[1], sys.argv[2]
frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.2
start = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
here = Path(__file__).parent
im = Image.open(here / name / f"pose-{pose}.webp").convert("RGBA")
y0 = int(im.height * start)
h = int(im.height * frac)
crop = Image.new("RGBA", (im.width, h), (60, 140, 110, 255))
crop.alpha_composite(im.crop((0, y0, im.width, y0 + h)))
d = ImageDraw.Draw(crop)
for x in range(0, im.width, 50):
    d.line([(x, 0), (x, h)], fill=(255, 255, 255, 90) if x % 100 else (255, 255, 0, 160))
    if x % 100 == 0: d.text((x + 2, 2), str(x), fill=(255, 255, 0, 255))
for y in range(0, h, 50):
    d.line([(0, y), (im.width, y)], fill=(255, 255, 255, 90) if y % 100 else (255, 255, 0, 160))
    if y % 100 == 0: d.text((2, y + 2), str(y + y0), fill=(255, 255, 0, 255))
out = here.parent / "shots" / f"face-{name}-{pose}-{int(start * 100)}.png"
crop.convert("RGB").save(out)
print(out, im.size)
