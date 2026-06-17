#!/usr/bin/env python3
"""
PaMarket – Google Play Feature Graphic Generator  v2.0
Output : 1024 × 500 px
Method : 3× supersampled, real app screenshots inside phone mockups
"""

import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Resolution ────────────────────────────────────────────────────────────────
SCALE = 3
W, H   = 1024, 500
SW, SH = W * SCALE, H * SCALE

# ── Brand palette ────────────────────────────────────────────────────────────
NAVY       = (8,   18,  62)
BLUE       = (22,  61,  170)
BLUE_LIGHT = (35,  85,  205)
GOLD       = (242, 168,  29)
GOLD_WARM  = (255, 185,  50)
WHITE      = (255, 255, 255)
PALE_BLUE  = (200, 215, 255)

# ── Real screenshot paths ─────────────────────────────────────────────────────
UPLOAD_DIR = "/root/.claude/uploads/df1f325b-5f6a-54b1-b075-a68a4cead434"
SCREENSHOT_HOME = f"{UPLOAD_DIR}/9e970a62-12bb1b68accc474a9d00d7faf3400d4a.jpeg"
SCREENSHOT_JOBS = f"{UPLOAD_DIR}/2ad5e8be-5b8499b3d96f4b6aaa6aba831118d874.jpeg"

# ── Fonts ────────────────────────────────────────────────────────────────────
FD = "/tmp/fonts/extras/ttf"

def F(variant, size):
    lut = {
        "display-bold": "InterDisplay-Bold.ttf",
        "bold":         "Inter-Bold.ttf",
        "semibold":     "Inter-SemiBold.ttf",
        "medium":       "Inter-Medium.ttf",
        "regular":      "Inter-Regular.ttf",
        "light":        "Inter-Light.ttf",
    }
    return ImageFont.truetype(f"{FD}/{lut[variant]}", size * SCALE)

# ─────────────────────────────────────────────────────────────────────────────
# UTILITY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def np_gradient(w, h, c1, c2, angle_deg=135):
    x = np.linspace(0, 1, w, dtype=np.float32)
    y = np.linspace(0, 1, h, dtype=np.float32)
    X, Y = np.meshgrid(x, y)
    rad  = math.radians(angle_deg)
    t    = X * math.cos(rad) + Y * math.sin(rad)
    t    = (t - t.min()) / (t.max() - t.min() + 1e-8)
    arr  = np.zeros((h, w, 4), dtype=np.uint8)
    for c in range(3):
        arr[:, :, c] = np.clip(c1[c] + (c2[c] - c1[c]) * t, 0, 255).astype(np.uint8)
    arr[:, :, 3] = 255
    return Image.fromarray(arr, "RGBA")


def radial_glow(canvas_wh, cx, cy, radius, color, alpha=90):
    w, h = canvas_wh
    x_ = np.arange(w, dtype=np.float32)
    y_ = np.arange(h, dtype=np.float32)
    X, Y = np.meshgrid(x_, y_)
    d = np.sqrt((X - cx)**2 + (Y - cy)**2)
    t = np.clip(1.0 - d / radius, 0.0, 1.0) ** 2.2
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, 0] = color[0]; arr[:, :, 1] = color[1]; arr[:, :, 2] = color[2]
    arr[:, :, 3] = np.clip(t * alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0]-1, size[1]-1],
                                            radius=radius, fill=255)
    return mask


def glass_card(w_px, h_px, title, subtitle, accent=(242, 168, 29)):
    """Frosted-glass floating card."""
    radius = int(11 * SCALE)
    card   = Image.new("RGBA", (w_px, h_px), (0, 0, 0, 0))
    d      = ImageDraw.Draw(card)
    # Dark glass background (opaque enough to read over phones)
    d.rounded_rectangle([0, 0, w_px-1, h_px-1], radius=radius,
                         fill=(18, 40, 110, 218), outline=(120, 160, 255, 130),
                         width=max(1, SCALE))
    # Top inner highlight
    d.rounded_rectangle([1, 1, w_px-2, int(h_px*0.32)], radius=radius,
                         fill=(255, 255, 255, 14))
    try:
        tf = F("semibold", 10)
        sf = F("regular",  8)
        d.text((int(12*SCALE), int(7*SCALE)),  title,    fill=WHITE,  font=tf)
        d.text((int(12*SCALE), int(22*SCALE)), subtitle, fill=accent, font=sf)
    except Exception as e:
        print(f"  card text: {e}")
    return card


# ─────────────────────────────────────────────────────────────────────────────
# PHONE BUILDER  –  uses REAL screenshot inside the screen
# ─────────────────────────────────────────────────────────────────────────────

def make_phone(pw, ph, screenshot_path, crop_top_frac=0.0):
    """
    pw, ph   : phone pixel dimensions (already scaled)
    screenshot_path : path to real app screenshot (JPEG)
    crop_top_frac   : 0.0 = from very top; 0.15 = skip top 15% of screenshot
    Returns RGBA phone Image.
    """
    phone  = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d      = ImageDraw.Draw(phone)
    radius = int(pw * 0.115)

    # ── Phone body gradient (dark navy sides, slightly lighter centre)
    body_arr = np.zeros((ph, pw, 4), dtype=np.uint8)
    for x in range(pw):
        t = x / max(pw - 1, 1)
        body_arr[:, x, 0] = int(14 + 12 * t)
        body_arr[:, x, 1] = int(24 + 16 * t)
        body_arr[:, x, 2] = int(76 + 48 * t)
        body_arr[:, x, 3] = 255
    body_img = Image.fromarray(body_arr, "RGBA")
    body_img.putalpha(rounded_mask((pw, ph), radius))
    phone.alpha_composite(body_img)

    # Frame border
    d.rounded_rectangle([0, 0, pw-1, ph-1], radius=radius,
                         outline=(85, 120, 230, 90), width=max(1, SCALE))
    # Top specular
    d.rounded_rectangle([int(pw*0.12), 1, int(pw*0.88), int(ph*0.005)+1],
                         radius=1, fill=(180, 200, 255, 40))

    # ── Screen bezel
    bx  = int(pw * 0.055)
    by  = int(ph * 0.038)
    sw_ = pw - 2 * bx
    sh_ = ph - 2 * by
    scr_radius = int(pw * 0.08)

    # ── Paste real screenshot
    try:
        scr = Image.open(screenshot_path).convert("RGBA")

        # Crop top fraction if requested (to focus on a sub-section)
        if crop_top_frac > 0:
            skip_px = int(scr.height * crop_top_frac)
            scr = scr.crop((0, skip_px, scr.width, scr.height))

        # Scale to fit screen width exactly (no stretching)
        scale_x = sw_ / scr.width
        new_h   = int(scr.height * scale_x)
        scr     = scr.resize((sw_, new_h), Image.LANCZOS)

        # Fit to screen height: crop or pad
        if new_h >= sh_:
            # Taller than screen — crop from top
            scr = scr.crop((0, 0, sw_, sh_))
        else:
            # Shorter — pad bottom with app background colour (sample bottom pixel)
            bg_col = scr.getpixel((sw_//2, new_h - 1))[:3]
            padded = Image.new("RGBA", (sw_, sh_), bg_col + (255,))
            padded.alpha_composite(scr, (0, 0))
            scr = padded

        # Apply rounded corner mask matching screen bezel
        scr.putalpha(rounded_mask((sw_, sh_), scr_radius))
        phone.alpha_composite(scr, (bx, by))

    except Exception as e:
        print(f"  Screenshot load error ({screenshot_path}): {e}")
        # Fallback: dark blue screen
        fb = Image.new("RGBA", (sw_, sh_), (11, 20, 58, 255))
        fb.putalpha(rounded_mask((sw_, sh_), scr_radius))
        phone.alpha_composite(fb, (bx, by))

    # ── Dynamic island notch (over screen)
    nw = int(pw * 0.26)
    nh = int(ph * 0.021)
    nx = (pw - nw) // 2
    ny = by - nh // 2
    d.rounded_rectangle([nx, ny, nx+nw, ny+nh], radius=nh//2, fill=(12, 20, 65))

    # ── Screen glare (subtle top-left polygon)
    glare = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    gd    = ImageDraw.Draw(glare)
    gd.polygon([
        (bx + int(sw_*0.04), by + int(sh_*0.01)),
        (bx + int(sw_*0.55), by + int(sh_*0.01)),
        (bx + int(sw_*0.40), by + int(sh_*0.14)),
        (bx,                 by + int(sh_*0.14)),
    ], fill=(255, 255, 255, 9))
    phone.alpha_composite(glare)

    # ── Home bar indicator at bottom
    bar_w = int(pw * 0.36)
    bar_h = max(1, int(ph * 0.007))
    bar_x = (pw - bar_w) // 2
    bar_y = ph - by - int(ph * 0.015)
    d.rounded_rectangle([bar_x, bar_y, bar_x+bar_w, bar_y+bar_h],
                         radius=bar_h//2, fill=(220, 230, 255, 70))

    return phone


# ─────────────────────────────────────────────────────────────────────────────
# MAIN GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate():
    print("Generating PaMarket feature graphic v2 (real screenshots)…")
    canvas = Image.new("RGBA", (SW, SH), (0, 0, 0, 255))

    # ── 1. Background gradient
    bg = np_gradient(SW, SH, NAVY, (30, 74, 192), angle_deg=148)
    canvas.alpha_composite(bg)

    # Subtle upper-right warmth sweep
    x_ = np.linspace(0, 1, SW, np.float32)
    y_ = np.linspace(0, 1, SH, np.float32)
    X2, Y2 = np.meshgrid(x_, y_)
    sweep = np.clip(X2 * 0.55 + (1.0 - Y2) * 0.45, 0, 1) * 28
    sw_arr = np.zeros((SH, SW, 4), np.uint8)
    sw_arr[:, :, 2] = sweep.astype(np.uint8)
    sw_arr[:, :, 3] = sweep.astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(sw_arr, "RGBA"))

    # ── 2. Atmospheric glow blobs
    g1 = radial_glow((SW,SH), int(0.665*SW), int(0.50*SH), int(0.40*SW), BLUE_LIGHT, 90)
    canvas.alpha_composite(g1.filter(ImageFilter.GaussianBlur(75)))

    g2 = radial_glow((SW,SH), int(0.97*SW), int(0.14*SH), int(0.22*SW), GOLD, 58)
    canvas.alpha_composite(g2.filter(ImageFilter.GaussianBlur(55)))

    g3 = radial_glow((SW,SH), 0, int(0.65*SH), int(0.28*SW), BLUE_LIGHT, 32)
    canvas.alpha_composite(g3.filter(ImageFilter.GaussianBlur(60)))

    g4 = radial_glow((SW,SH), int(1.0*SW), int(1.0*SH), int(0.30*SW), GOLD, 32)
    canvas.alpha_composite(g4.filter(ImageFilter.GaussianBlur(55)))

    # ── 3. Phone drop shadows
    sh1 = radial_glow((SW,SH), int(0.648*SW), int(0.625*SH), int(0.115*SW), (3,5,18), 170)
    canvas.alpha_composite(sh1.filter(ImageFilter.GaussianBlur(24)))
    sh2 = radial_glow((SW,SH), int(0.810*SW), int(0.640*SH), int(0.085*SW), (3,5,18), 145)
    canvas.alpha_composite(sh2.filter(ImageFilter.GaussianBlur(20)))

    # ── 4. LARGE phone — Home screen (slight left tilt -8°)
    lp_w = int(164 * SCALE)
    lp_h = int(350 * SCALE)
    lp   = make_phone(lp_w, lp_h, SCREENSHOT_HOME, crop_top_frac=0.0)
    lp_r = lp.rotate(8, expand=True, resample=Image.BICUBIC)
    lp_cx, lp_cy = int(0.648*SW), int(0.495*SH)
    canvas.alpha_composite(lp_r, (lp_cx - lp_r.width//2, lp_cy - lp_r.height//2))
    print("  Large phone (Home screen) done")

    # ── 5. SMALL phone — Hire Talent / Jobs screen (slight right tilt +6°)
    sp_w = int(113 * SCALE)
    sp_h = int(240 * SCALE)
    sp   = make_phone(sp_w, sp_h, SCREENSHOT_JOBS, crop_top_frac=0.0)
    sp_r = sp.rotate(-6, expand=True, resample=Image.BICUBIC)
    sp_cx, sp_cy = int(0.806*SW), int(0.518*SH)
    paste_x = max(0, sp_cx - sp_r.width//2)
    paste_y = max(0, sp_cy - sp_r.height//2)
    canvas.alpha_composite(sp_r, (paste_x, paste_y))
    print("  Small phone (Jobs screen) done")

    # ── 6. Screen-light glow (phones emit blue light onto the scene)
    sg1 = radial_glow((SW,SH), lp_cx, int(0.39*SH), int(0.14*SW), (80,140,255), 50)
    canvas.alpha_composite(sg1.filter(ImageFilter.GaussianBlur(30)))
    sg2 = radial_glow((SW,SH), sp_cx, int(0.37*SH), int(0.09*SW), (80,140,255), 38)
    canvas.alpha_composite(sg2.filter(ImageFilter.GaussianBlur(25)))

    # ── 7. Floating glassmorphism cards
    # Top-left of large phone — references home screen listing
    c1 = glass_card(int(132*SCALE), int(48*SCALE),
                    "🚗  Honda Fit", "USD $5,000  ·  Harare", GOLD_WARM)
    canvas.alpha_composite(c1, (int(0.450*SW), int(0.092*SH)))

    # Top-right — references Jobs/Hire screen
    c2 = glass_card(int(138*SCALE), int(48*SCALE),
                    "💼  Hire Talent", "127 verified candidates", (130, 205, 255))
    canvas.alpha_composite(c2, (int(0.718*SW), int(0.058*SH)))

    # Bottom-left of large phone — Verified seller (real app feature)
    c3 = glass_card(int(120*SCALE), int(42*SCALE),
                    "✓  Verified Seller", "Harare, Zimbabwe", (100, 225, 145))
    canvas.alpha_composite(c3, (int(0.453*SW), int(0.802*SH)))

    # ── 8. Left-side typography
    draw = ImageDraw.Draw(canvas)
    LX   = int(42 * SCALE)

    # ── Logo
    icon_src_path = "/home/user/PaMarket/www/img/icon-512.png"
    icon_sz = int(46 * SCALE)
    try:
        icon_img = Image.open(icon_src_path).convert("RGBA")
        icon_img = icon_img.resize((icon_sz, icon_sz), Image.LANCZOS)
        icon_img.putalpha(rounded_mask((icon_sz, icon_sz), int(10*SCALE)))
        # Subtle icon shadow
        shd = Image.new("RGBA", (icon_sz + 10, icon_sz + 10), (0,0,0,0))
        shd.alpha_composite(icon_img, (5, 5))
        shd = shd.filter(ImageFilter.GaussianBlur(6))
        canvas.alpha_composite(shd, (LX - 3, int(36*SCALE) - 3))
        canvas.alpha_composite(icon_img, (LX, int(36*SCALE)))
        icon_end_x = LX + icon_sz
    except Exception as e:
        print(f"  Icon: {e}")
        icon_end_x = LX

    # "PaMarket" wordmark
    try:
        logo_f = F("bold", 23)
        tx = icon_end_x + int(10*SCALE)
        ty = int(46*SCALE)
        pa_w = int(draw.textlength("Pa", font=logo_f))
        draw.text((tx, ty), "Pa",      fill=WHITE, font=logo_f)
        draw.text((tx+pa_w, ty), "Market", fill=GOLD,  font=logo_f)
    except Exception as e:
        print(f"  Logo text: {e}")

    # ── Gold rule (tapered)
    rule_y = int(97 * SCALE)
    draw.rectangle([LX, rule_y, LX + int(60*SCALE), rule_y + int(3*SCALE)], fill=GOLD)
    # Fade tail
    taper = Image.new("RGBA", (int(40*SCALE), int(3*SCALE)), (0,0,0,0))
    for xi in range(int(40*SCALE)):
        a = int(255 * (1 - xi / (40*SCALE)))
        for yi in range(int(3*SCALE)):
            taper.putpixel((xi, yi), GOLD + (a,))
    canvas.alpha_composite(taper, (LX + int(60*SCALE), rule_y))

    # ── Headline  "Buy. Sell." / "Hire."
    try:
        h1f = F("display-bold", 65)
        hy1 = int(106 * SCALE)
        draw.text((LX, hy1), "Buy. Sell.", fill=WHITE, font=h1f)
        hy2 = hy1 + int(75 * SCALE)
        hire_w = int(draw.textlength("Hire", font=h1f))
        draw.text((LX,         hy2), "Hire", fill=WHITE, font=h1f)
        draw.text((LX+hire_w,  hy2), ".",    fill=GOLD,  font=h1f)
    except Exception as e:
        print(f"  Headline: {e}")

    # ── Subtitle
    try:
        sub_f = F("regular", 14)
        sub_y = int(268 * SCALE)
        draw.text((LX, sub_y),               "Zimbabwe's trusted marketplace for",    fill=PALE_BLUE, font=sub_f)
        draw.text((LX, sub_y+int(20*SCALE)), "property, vehicles, jobs & services.", fill=PALE_BLUE, font=sub_f)
    except Exception as e:
        print(f"  Subtitle: {e}")

    # ── Category pills  (match real app categories)
    pills = [
        ("Buy",      GOLD),
        ("Sell",     (100, 205, 130)),
        ("Jobs",     (100, 165, 255)),
        ("Property", (200, 130, 255)),
        ("Services", ( 80, 210, 210)),
    ]
    pill_f   = F("medium", 11)
    pill_h_  = int(25 * SCALE)
    pill_pad = int(10 * SCALE)
    px       = LX
    py       = int(322 * SCALE)
    row_max  = int(412 * SCALE)

    for label, col in pills:
        tw_  = int(draw.textlength(label, font=pill_f))
        pw_  = tw_ + pill_pad * 2
        if px + pw_ > row_max:
            px  = LX
            py += pill_h_ + int(8*SCALE)
        pill_img = Image.new("RGBA", (pw_, pill_h_), (0,0,0,0))
        pd_      = ImageDraw.Draw(pill_img)
        pd_.rounded_rectangle([0, 0, pw_-1, pill_h_-1],
                               radius=pill_h_//2,
                               fill=col+(40,), outline=col+(115,), width=SCALE)
        pd_.text((pill_pad, int(5*SCALE)), label, fill=WHITE, font=pill_f)
        canvas.alpha_composite(pill_img, (px, py))
        px += pw_ + int(8*SCALE)

    # ── Decorative rings (very faint, give sense of depth)
    ring_layer = Image.new("RGBA", (SW, SH), (0,0,0,0))
    rd         = ImageDraw.Draw(ring_layer)
    # Left bottom ring
    rd.ellipse([-int(0.05*SW)-int(0.18*SH), int(0.72*SH)-int(0.18*SH),
                -int(0.05*SW)+int(0.18*SH), int(0.72*SH)+int(0.18*SH)],
               outline=(255,255,255,16), width=int(2*SCALE))
    # Right centre ring (behind phones)
    rd.ellipse([int(0.55*SW)-int(0.22*SH), int(0.50*SH)-int(0.22*SH),
                int(0.55*SW)+int(0.22*SH), int(0.50*SH)+int(0.22*SH)],
               outline=(255,255,255,10), width=int(2*SCALE))
    canvas.alpha_composite(ring_layer)

    # ── Left vignette (keeps copy readable over any leaked glow)
    v_x = np.linspace(0, 1, SW, dtype=np.float32)
    v_y = np.linspace(0, 1, SH, dtype=np.float32)
    VX, _ = np.meshgrid(v_x, v_y)
    v_alpha = np.clip((1.0 - VX * 3.8), 0, 1) * 38
    v_arr   = np.zeros((SH, SW, 4), dtype=np.uint8)
    v_arr[:, :, 3] = v_alpha.astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(v_arr, "RGBA"))

    # ── Bottom fade
    _, VY = np.meshgrid(v_x, v_y)
    fade_t = np.clip((VY - 0.74) / 0.26, 0, 1) ** 1.5 * 75
    f_arr  = np.zeros((SH, SW, 4), dtype=np.uint8)
    f_arr[:, :, 3] = fade_t.astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(f_arr, "RGBA"))

    # ── Downsample to final 1024 × 500
    print("  Downsampling…")
    final    = canvas.resize((W, H), Image.LANCZOS).convert("RGB")
    out_path = "/home/user/PaMarket/store-assets/feature-graphic-1024x500.png"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path, "PNG", optimize=True)
    print(f"  Saved → {out_path}")
    return final


if __name__ == "__main__":
    generate()
