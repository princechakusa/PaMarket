# Depth maps for the stills (Depth Anything V2 small, ONNX, CPU, free): gen/<id>.depth.png
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
import onnxruntime as ort

HERE = Path(__file__).parent
MODEL = HERE.parents[2] / ".video-tools" / "models" / "depth-anything-v2-small.onnx"
sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
MEAN, STD = np.array([.485, .456, .406]), np.array([.229, .224, .225])

for name in sys.argv[1:] or ["a-yard", "b-photo", "c-chipo", "e-meet", "f-ride", "g-shoes", "h-hug"]:
    im = Image.open(HERE / "gen" / f"{name}.png").convert("RGB")
    W, H = 518 * 2, int(518 * 2 * im.height / im.width) // 14 * 14
    x = (np.asarray(im.resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    d = sess.run(None, {inp: x.transpose(2, 0, 1)[None].astype(np.float32)})[0].squeeze()
    d = (d - np.percentile(d, 1)) / (np.percentile(d, 99) - np.percentile(d, 1) + 1e-6)
    out = Image.fromarray((np.clip(d, 0, 1) * 255).astype(np.uint8)).resize(im.size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    out.save(HERE / "gen" / f"{name}.depth.png"); print(name, d.shape)
