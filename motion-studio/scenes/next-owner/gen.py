# Free generation via public Hugging Face Spaces (no account, no credits).
#   python gen.py img <name> "<prompt>" [seed] [w] [h]        -> gen/<name>.png   (FLUX.1-schnell)
#   python gen.py edit <name> <src.png> "<instruction>" [seed] -> gen/<name>.png   (FLUX.1-Kontext-dev)
#   python gen.py vid <name> <src.png> "<prompt>" [secs] [seed] -> gen/<name>.mp4   (LTX-Video distilled)
import sys, shutil, time, os
from pathlib import Path
from gradio_client import Client as _Client, handle_file
from PIL import Image

# HF_TOKEN (optional, from the environment) raises the free ZeroGPU daily quota
def Client(space, verbose=False): return _Client(space, token=os.environ.get("HF_TOKEN"), verbose=verbose)

OUT = Path(__file__).parent / "gen"; OUT.mkdir(exist_ok=True)
STYLE = ("Pixar Disney 3D animated feature film still, soft global illumination, warm cinematic lighting, "
         "subsurface skin, expressive stylised faces, highly detailed, no text, no letters, no logos, no watermark")

def save_img(src, name):
    Image.open(src).convert("RGB").save(OUT / f"{name}.png"); print(OUT / f"{name}.png")

def img(name, prompt, seed=0, w=1344, h=768):
    c = Client("black-forest-labs/FLUX.1-schnell", verbose=False)
    r = c.predict(f"{prompt}. {STYLE}", int(seed), int(seed) == 0, int(w), int(h), 4, api_name="/infer")
    save_img(r[0], name)

def edit(name, src, instr, seed=0):
    c = Client("black-forest-labs/FLUX.1-Kontext-Dev", verbose=False)
    r = c.predict(handle_file(str(src)), instr, int(seed), int(seed) == 0, 2.5, 28, api_name="/infer")
    save_img(r[0] if isinstance(r, (list, tuple)) else r, name)

def vid(name, src, prompt, secs=3, seed=0):
    c = Client("Lightricks/ltx-video-distilled", verbose=False)
    im = Image.open(src); w, h = im.size
    k = 768 / max(w, h); W, H = int(w * k) // 32 * 32, int(h * k) // 32 * 32
    r = c.predict(prompt=f"{prompt}. Pixar-style 3D animation, smooth natural motion.",
                  negative_prompt="worst quality, inconsistent motion, blurry, jittery, distorted, deformed hands, extra limbs, text, watermark",
                  input_image_filepath=handle_file(str(src)), height_ui=H, width_ui=W, mode="image-to-video",
                  duration_ui=float(secs), seed_ui=int(seed), randomize_seed=int(seed) == 0, improve_texture_flag=True,
                  api_name="/image_to_video")
    v = r[0]["video"] if isinstance(r[0], dict) else r[0]
    shutil.copy(v, OUT / f"{name}.mp4"); print(OUT / f"{name}.mp4")

if __name__ == "__main__":
    a = sys.argv[1:]
    for attempt in range(3):
        try:
            t = time.time()
            if a[0] == "img": img(a[1], a[2], *(a[3:]))
            elif a[0] == "edit": edit(a[1], a[2], a[3], *(a[4:]))
            elif a[0] == "vid": vid(a[1], a[2], a[3], *(a[4:]))
            print(f"done in {time.time() - t:.0f}s"); break
        except Exception as e:
            msg = str(e)
            print("attempt", attempt + 1, "failed:", msg[:300])
            if "quota" in msg or "runs limit" in msg: sys.exit(2)  # daily free limit: stop, don't retry
            if attempt == 2: sys.exit(1)
            time.sleep(20)
