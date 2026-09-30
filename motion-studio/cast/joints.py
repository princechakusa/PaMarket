# Finds body joints on each puppet A-pose with MediaPipe and writes cast/<name>/puppet/joints.json
# (pixel coords in apose.png) + a debug overlay shots/joints-<name>.jpg.   python cast/joints.py [name ...]
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

HERE = Path(__file__).parent
MODEL = HERE.parents[1] / ".video-tools" / "models" / "pose_landmarker_heavy.task"
det = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
    base_options=mpt.BaseOptions(model_asset_path=str(MODEL)), num_poses=1, min_pose_detection_confidence=.3))
N = {"nose": 0, "l_ear": 7, "r_ear": 8, "l_sh": 11, "r_sh": 12, "l_el": 13, "r_el": 14, "l_wr": 15, "r_wr": 16,
     "l_hip": 23, "r_hip": 24, "l_kn": 25, "r_kn": 26, "l_an": 27, "r_an": 28, "l_ft": 31, "r_ft": 32}

for name in sys.argv[1:] or [p.name for p in sorted(HERE.iterdir()) if (p / "puppet" / "apose.png").exists()]:
    f = HERE / name / "puppet" / "apose.png"
    im = Image.open(f).convert("RGB"); W, H = im.size
    r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
    if not r.pose_landmarks: print(name, "NO POSE"); continue
    lm = r.pose_landmarks[0]
    J = {k: [round(lm[i].x * W, 1), round(lm[i].y * H, 1)] for k, i in N.items()}
    (HERE / name / "puppet" / "joints.json").write_text(json.dumps(J, indent=1))
    d = ImageDraw.Draw(im)
    for a, b in [("l_sh", "l_el"), ("l_el", "l_wr"), ("r_sh", "r_el"), ("r_el", "r_wr"), ("l_sh", "r_sh"), ("l_hip", "r_hip"),
                 ("l_hip", "l_kn"), ("l_kn", "l_an"), ("r_hip", "r_kn"), ("r_kn", "r_an"), ("l_sh", "l_hip"), ("r_sh", "r_hip")]:
        d.line([*J[a], *J[b]], fill=(255, 0, 80), width=4)
    for k, (x, y) in J.items(): d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(0, 200, 255))
    out = HERE.parent / "shots" / f"joints-{name}.jpg"; im.save(out, quality=85); print(name, "ok", out.name)
