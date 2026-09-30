# Turns each animated shot gen/<shot>.mp4 into upscaled frames for the composition:
#   clips/<shot>/0001.jpg ... (4x Real-ESRGAN, realesr-animevideov3) + clips/manifest.json
# Also cuts out the end-card characters with rembg.  python prep.py [shot ...]
import json, subprocess, sys, shutil
from pathlib import Path

HERE = Path(__file__).parent
ESR = HERE.parents[2] / ".video-tools" / "bin" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
SHOTS = ["a-yard", "b-photo", "c-chipo", "d-accept", "e-meet", "f-ride", "g-shoes", "h-hug"]
man_path = HERE / "clips" / "manifest.json"
man = json.loads(man_path.read_text()) if man_path.exists() else {}

def fps_of(mp4):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(mp4)], capture_output=True, text=True).stdout.strip()
    a, b = r.split("/"); return float(a) / float(b)

for s in sys.argv[1:] or SHOTS:
    mp4 = HERE / "gen" / f"{s}.mp4"
    if not mp4.exists(): print("missing", mp4); continue
    raw, out = HERE / "clips" / "_raw" / s, HERE / "clips" / s
    shutil.rmtree(raw, ignore_errors=True); shutil.rmtree(out, ignore_errors=True)
    raw.mkdir(parents=True); out.mkdir(parents=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4), str(raw / "%04d.png")], check=True)
    subprocess.run([str(ESR), "-i", str(raw), "-o", str(out), "-n", "realesr-animevideov3", "-s", "4", "-f", "jpg"], check=True, capture_output=True)
    n = len(list(out.glob("*.jpg")))
    man[s] = {"fps": fps_of(mp4), "count": n}
    man_path.write_text(json.dumps(man, indent=1)); print(s, man[s])
shutil.rmtree(HERE / "clips" / "_raw", ignore_errors=True)
