# Splits each cast/<name>/sheet.png into transparent per-pose cut-outs.
#   python cast/cutout.py [name ...]
# Finds figures on the 1024px sheet, then re-cuts each one from sheet@4x.png
# so the final PNGs are sharp enough for 1080p close-ups.
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import remove, new_session

HERE = Path(__file__).parent
coarse = new_session("isnet-general-use")
fine = new_session("birefnet-general")

def figures(mask, min_frac=0.02):
    lab, n = ndimage.label(mask > 128)
    h, w = mask.shape
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        area = int((lab[sl] == i).sum())
        if area < min_frac * h * w:
            continue
        ys, xs = sl
        out.append((xs.start, ys.start, xs.stop, ys.stop, area))
    return sorted(out, key=lambda b: (b[1] // 200, b[0]))

def run(name):
    d = HERE / name
    sheet = Image.open(d / "sheet.png").convert("RGB")
    big = Image.open(d / "sheet@4x.png").convert("RGB")
    s = big.width / sheet.width
    mask = np.array(remove(sheet, session=coarse, only_mask=True))
    poses = []
    for k, (x0, y0, x1, y1, area) in enumerate(figures(mask)):
        pad = 12
        box = [max(0, x0 - pad), max(0, y0 - pad), min(sheet.width, x1 + pad), min(sheet.height, y1 + pad)]
        crop = big.crop(tuple(int(v * s) for v in box))
        cut = remove(crop, session=fine, post_process_mask=True)
        cut = cut.crop(cut.getbbox())
        f = f"pose-{k + 1}.webp"
        cut.save(d / f, quality=90, method=6)
        poses.append({"file": f, "sheet_box": box, "size": cut.size})
        print(name, f, cut.size)
    (d / "poses.json").write_text(json.dumps(poses, indent=2))

for n in sys.argv[1:] or sorted(p.name for p in HERE.iterdir() if (p / "sheet.png").exists()):
    run(n)
