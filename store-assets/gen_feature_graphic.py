#!/usr/bin/env python3
"""
PaMarket – Google Play Feature Graphic Generator
Output: 1024 × 500 px  |  Supersampled 3x for crisp edges
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
GOLD       = (242, 168, 29)
GOLD_WARM  = (255, 185, 50)
WHITE      = (255, 255, 255)
PALE_BLUE  = (200, 215, 255)
OFF_WHITE  = (235, 240, 255)

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
    """Smooth diagonal linear gradient using numpy."""
    x = np.linspace(0, 1, w, dtype=np.float32)
    y = np.linspace(0, 1, h, dtype=np.float32)
    X, Y = np.meshgrid(x, y)
    rad  = math.radians(angle_deg)
    t    = X * math.cos(rad) + Y * math.sin(rad)
    t    = (t - t.min()) / (t.max() - t.min() + 1e-8)
    arr  = np.zeros((h, w, 4), dtype=np.uint8)
    for c in range(3):
        arr[:, :, c] = (c1[c] + (c2[c] - c1[c]) * t).astype(np.uint8)
    arr[:, :, 3] = 255
    return Image.fromarray(arr, "RGBA")


def radial_glow(canvas_wh, cx, cy, radius, color, alpha=90):
    """Soft radial glow blob – returns RGBA Image."""
    w, h = canvas_wh
    x_ = np.arange(w, dtype=np.float32)
    y_ = np.arange(h, dtype=np.float32)
    X, Y = np.meshgrid(x_, y_)
    d = np.sqrt((X - cx)**2 + (Y - cy)**2)
    t = np.clip(1.0 - d / radius, 0.0, 1.0) ** 2.2
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[:, :, 0] = color[0]
    arr[:, :, 1] = color[1]
    arr[:, :, 2] = color[2]
    arr[:, :, 3] = (t * alpha).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0]-1, size[1]-1],
                                            radius=radius, fill=255)
    return mask


def glass_card(w_px, h_px, title, subtitle, accent=(242, 168, 29)):
    """Frosted-glass floating card (pixel dimensions already scaled)."""
    radius = int(11 * SCALE)
    card   = Image.new("RGBA", (w_px, h_px), (0, 0, 0, 0))
    d      = ImageDraw.Draw(card)
    # Background fill – more opaque for visibility
    d.rounded_rectangle([0, 0, w_px-1, h_px-1], radius=radius,
                         fill=(30, 50, 120, 200), outline=(120, 160, 255, 120),
                         width=max(1, SCALE))
    # Top highlight strip
    d.rounded_rectangle([1, 1, w_px-2, int(h_px*0.30)], radius=radius,
                         fill=(255, 255, 255, 18))
    try:
        tf = F("semibold", 10)
        sf = F("regular",  8)
        d.text((int(12*SCALE), int(7*SCALE)),  title,    fill=WHITE,  font=tf)
        d.text((int(12*SCALE), int(22*SCALE)), subtitle, fill=accent, font=sf)
    except Exception as e:
        print(f"  card text: {e}")
    return card


# ─────────────────────────────────────────────────────────────────────────────
# PHONE SCREEN CONTENT PAINTERS
# ─────────────────────────────────────────────────────────────────────────────

def thumb_gradient(w, h, color_top, color_bot):
    """Tiny gradient rectangle – mimics a photo thumbnail."""
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        t = y / (h - 1)
        for c in range(3):
            arr[y, :, c] = int(color_top[c] + (color_bot[c] - color_top[c]) * t)
    arr[:, :, 3] = 255
    return Image.fromarray(arr, "RGBA")


def paint_home_screen(phone_img, sx, sy, sw, sh):
    """Paint Home screen UI inside the screen bounds (all coords in pixel space)."""
    d  = ImageDraw.Draw(phone_img)
    s  = SCALE

    # ── Status bar
    d.rectangle([sx, sy, sx+sw, sy+int(sh*0.04)], fill=(18, 52, 148))

    # ── Header / nav bar (slight gradient: blue → deeper blue)
    hh = int(sh * 0.115)
    hdr_arr = np.zeros((hh, sw, 4), dtype=np.uint8)
    for y in range(hh):
        t = y / (hh - 1)
        hdr_arr[y, :, :] = [int(22+8*t), int(61+10*t), int(170+10*t), 255]
    phone_img.alpha_composite(Image.fromarray(hdr_arr, "RGBA"),
                              (sx, sy + int(sh*0.04)))

    try:
        hf = ImageFont.truetype(f"{FD}/Inter-SemiBold.ttf", int(7*s))
        rf = ImageFont.truetype(f"{FD}/Inter-Regular.ttf",  int(5.2*s))
        d.text((sx+int(7*s), sy+int(sh*0.048)+int(1*s)), "PaMarket",
               fill=WHITE, font=hf)
        d.text((sx+int(7*s), sy+int(sh*0.048)+int(9.5*s)), "Harare, ZW",
               fill=(170, 210, 255), font=rf)
        # Bell icon (dot)
        bx = sx + sw - int(10*s)
        by_ = sy + int(sh*0.068)
        d.ellipse([bx-int(3.5*s), by_-int(3.5*s), bx+int(3.5*s), by_+int(3.5*s)],
                  fill=(255, 255, 255, 200))
    except: pass

    bar_bottom = sy + int(sh*0.04) + hh

    # ── Search bar (bright, high contrast)
    sb_y = bar_bottom + int(sh*0.025)
    sb_h = int(sh*0.075)
    d.rounded_rectangle([sx+int(5*s), sb_y, sx+sw-int(5*s), sb_y+sb_h],
                          radius=sb_h//2, fill=(255, 255, 255, 235))
    # Search icon dot
    d.ellipse([sx+int(10*s), sb_y+int(sb_h*0.3),
               sx+int(16*s), sb_y+int(sb_h*0.7)], fill=(180, 190, 220))
    try:
        pf = ImageFont.truetype(f"{FD}/Inter-Regular.ttf", int(5*s))
        d.text((sx+int(19*s), sb_y+int(sb_h*0.24)), "Search listings…",
               fill=(140, 150, 180), font=pf)
    except: pass

    # ── Category strip (4 icons with labels)
    cat_y  = sb_y + sb_h + int(sh*0.032)
    cats   = [
        ("Buy",  (242, 168,  29)),
        ("Rent", ( 52, 168,  83)),
        ("Jobs", ( 26, 115, 232)),
        ("Cars", (234,  67,  53)),
    ]
    n      = len(cats)
    cw     = sw // n
    icon_r = int(cw * 0.24)
    for i, (name, col) in enumerate(cats):
        cx = sx + i*cw + cw//2
        cy = cat_y + icon_r + int(sh*0.01)
        # Outer glow ring
        d.ellipse([cx-icon_r-int(2*s), cy-icon_r-int(2*s),
                   cx+icon_r+int(2*s), cy+icon_r+int(2*s)],
                  fill=col+(30,))
        # Main circle
        d.ellipse([cx-icon_r, cy-icon_r, cx+icon_r, cy+icon_r], fill=col)
        # Inner white highlight
        d.ellipse([cx-int(icon_r*0.4), cy-int(icon_r*0.55),
                   cx+int(icon_r*0.15), cy-int(icon_r*0.10)],
                  fill=(255, 255, 255, 70))
        try:
            lf = ImageFont.truetype(f"{FD}/Inter-Medium.ttf", int(4.2*s))
            tw = d.textlength(name, font=lf)
            d.text((cx-int(tw//2), cy+icon_r+int(2.5*s)), name,
                   fill=(190, 215, 255), font=lf)
        except: pass

    # ── Section label
    sect_y = cat_y + icon_r*2 + int(sh*0.075)
    try:
        sf2 = ImageFont.truetype(f"{FD}/Inter-SemiBold.ttf", int(5.2*s))
        d.text((sx+int(5*s), sect_y), "Featured Listings", fill=(210, 225, 255), font=sf2)
        # "See all" right-aligned
        sal = ImageFont.truetype(f"{FD}/Inter-Regular.ttf", int(4.2*s))
        d.text((sx+sw-int(28*s), sect_y+int(1*s)), "See all", fill=(242,168,29), font=sal)
    except: pass

    # ── Listing cards (with gradient thumbnails)
    card_top  = sect_y + int(sh*0.055)
    card_h    = int(sh * 0.185)
    card_gap  = int(sh * 0.020)
    listings  = [
        ("iPhone 14 Pro",    "USD $450",    (70, 120, 240), ( 30,  60, 160)),
        ("3 Bed House",      "USD $85,000", (45, 175,  95), ( 20,  90,  50)),
        ("Toyota Hilux",     "USD $32,000", (225, 80,  55), (140,  40,  25)),
    ]
    for i, (title, price, t_top, t_bot) in enumerate(listings):
        cy = card_top + i*(card_h + card_gap)
        if cy + card_h > sy + sh - int(3*s): break
        # Card background
        cl = Image.new("RGBA", (sw - int(6*s), card_h), (255, 255, 255, 30))
        phone_img.alpha_composite(cl, (sx+int(3*s), cy))
        # Thumbnail with gradient
        tw_ = int(sw * 0.32)
        th_ = card_h - int(6*s)
        t_img = thumb_gradient(tw_, th_, t_top, t_bot)
        t_mask = rounded_mask((tw_, th_), int(3*s))
        t_img.putalpha(t_mask)
        phone_img.alpha_composite(t_img, (sx+int(5*s), cy+int(3*s)))
        # Text
        tx = sx + int(5*s) + tw_ + int(6*s)
        try:
            tbf = ImageFont.truetype(f"{FD}/Inter-SemiBold.ttf", int(5.2*s))
            trf = ImageFont.truetype(f"{FD}/Inter-Regular.ttf",  int(4.0*s))
            d.text((tx, cy+int(card_h*0.14)), title,             fill=(230,240,255), font=tbf)
            d.text((tx, cy+int(card_h*0.44)), price,             fill=GOLD,          font=tbf)
            d.text((tx, cy+int(card_h*0.70)), "Harare · 2h ago", fill=(150,170,230), font=trf)
        except: pass


def paint_jobs_screen(phone_img, sx, sy, sw, sh):
    """Paint Jobs screen UI."""
    d = ImageDraw.Draw(phone_img)
    s = SCALE

    # Status bar
    d.rectangle([sx, sy, sx+sw, sy+int(sh*0.04)], fill=(18, 52, 148))

    # Header (gradient)
    hh = int(sh * 0.12)
    hdr_arr = np.zeros((hh, sw, 4), dtype=np.uint8)
    for y in range(hh):
        t = y / (hh - 1)
        hdr_arr[y, :, :] = [int(22+8*t), int(61+10*t), int(170+10*t), 255]
    phone_img.alpha_composite(Image.fromarray(hdr_arr, "RGBA"),
                              (sx, sy + int(sh*0.04)))
    try:
        hf = ImageFont.truetype(f"{FD}/Inter-SemiBold.ttf", int(7*s))
        rf = ImageFont.truetype(f"{FD}/Inter-Regular.ttf",  int(5.0*s))
        d.text((sx+int(6*s), sy+int(sh*0.048)+int(1*s)), "Jobs Board",
               fill=WHITE, font=hf)
        d.text((sx+int(6*s), sy+int(sh*0.048)+int(10*s)), "127 positions",
               fill=(170, 210, 255), font=rf)
    except: pass

    bar_bottom = sy + int(sh*0.04) + hh

    # Job cards
    jobs = [
        ("Sr. Developer",  "$2,000/mo", (26,  115, 232)),
        ("UI/UX Designer", "$1,500/mo", (103,  58, 183)),
        ("Sales Manager",  "$1,800/mo", ( 52, 168,  83)),
        ("Data Analyst",   "$1,600/mo", (234,  67,  53)),
    ]
    card_h   = int(sh * 0.185)
    card_gap = int(sh * 0.022)
    card_top = bar_bottom + int(sh * 0.03)

    for i, (title, salary, col) in enumerate(jobs):
        cy = card_top + i*(card_h + card_gap)
        if cy + card_h > sy + sh - int(3*s): break
        # Card background
        cl = Image.new("RGBA", (sw-int(4*s), card_h), (255, 255, 255, 32))
        phone_img.alpha_composite(cl, (sx+int(2*s), cy))
        # Left accent bar
        d.rectangle([sx+int(2*s), cy, sx+int(2*s)+int(2*s), cy+card_h],
                    fill=col)
        # Company icon (gradient square)
        icon_s = int(card_h * 0.48)
        icx    = sx + int(8*s) + icon_s//2
        icy    = cy + card_h//2
        # Icon gradient
        ic_arr = np.zeros((icon_s, icon_s, 4), dtype=np.uint8)
        for y in range(icon_s):
            t = y / (icon_s - 1)
            ic_arr[y, :, :3] = [
                int(col[0] * (1 - 0.3*t)),
                int(col[1] * (1 - 0.3*t)),
                int(col[2] * (1 - 0.3*t)),
            ]
            ic_arr[y, :, 3] = 255
        ic_img  = Image.fromarray(ic_arr, "RGBA")
        ic_mask = rounded_mask((icon_s, icon_s), int(4*s))
        ic_img.putalpha(ic_mask)
        phone_img.alpha_composite(ic_img, (icx-icon_s//2, icy-icon_s//2))
        # Inner white letter placeholder
        d.ellipse([icx-int(4*s), icy-int(4*s), icx+int(4*s), icy+int(4*s)],
                  fill=(255,255,255,80))
        # Text
        tx = icx + icon_s//2 + int(5*s)
        try:
            tbf = ImageFont.truetype(f"{FD}/Inter-SemiBold.ttf", int(5.5*s))
            saf = ImageFont.truetype(f"{FD}/Inter-Regular.ttf",  int(4.2*s))
            d.text((tx, cy+int(card_h*0.14)), title,  fill=(225, 235, 255), font=tbf)
            d.text((tx, cy+int(card_h*0.46)), salary, fill=GOLD,            font=tbf)
            chip_h2 = int(card_h*0.22)
            chip_w2 = int(sw * 0.36)
            d.rounded_rectangle([tx, cy+int(card_h*0.68),
                                  tx+chip_w2, cy+int(card_h*0.68)+chip_h2],
                                 radius=chip_h2//2, fill=(100, 165, 255, 55))
            d.text((tx+int(3*s), cy+int(card_h*0.69)), "Harare",
                   fill=(190, 215, 255), font=saf)
        except: pass


# ─────────────────────────────────────────────────────────────────────────────
# PHONE BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def make_phone(pw, ph, content_painter):
    """
    Builds a phone mockup RGBA image (pw × ph pixels).
    content_painter(img, sx, sy, sw, sh) draws the screen UI.
    """
    phone  = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    d      = ImageDraw.Draw(phone)
    radius = int(pw * 0.115)

    # ── Body gradient (dark navy, slight right-edge highlight)
    body_arr = np.zeros((ph, pw, 4), dtype=np.uint8)
    for x in range(pw):
        t = x / (pw - 1)
        body_arr[:, x, 0] = int(16 + 12 * t)
        body_arr[:, x, 1] = int(26 + 16 * t)
        body_arr[:, x, 2] = int(80 + 45 * t)
        body_arr[:, x, 3] = 255
    body_img = Image.fromarray(body_arr, "RGBA")
    body_img.putalpha(rounded_mask((pw, ph), radius))
    phone.alpha_composite(body_img)

    # ── Frame border
    d.rounded_rectangle([0, 0, pw-1, ph-1], radius=radius,
                         outline=(80, 115, 220, 80), width=max(1, SCALE))
    # Top specular highlight (thin arc)
    d.rounded_rectangle([int(pw*0.12), 1, int(pw*0.88), int(ph*0.005)+1],
                         radius=1, fill=(180, 200, 255, 45))

    # ── Screen bezel
    bx  = int(pw * 0.055)
    by  = int(ph * 0.038)
    sw_ = pw - 2*bx
    sh_ = ph - 2*by

    # Screen fill (dark navy with slight blue warmth)
    scr_arr = np.zeros((sh_, sw_, 4), dtype=np.uint8)
    scr_arr[:, :, 0] = 11
    scr_arr[:, :, 1] = 20
    scr_arr[:, :, 2] = 58
    scr_arr[:, :, 3] = 255
    scr_img = Image.fromarray(scr_arr, "RGBA")
    scr_mask = rounded_mask((sw_, sh_), int(pw * 0.075))
    scr_img.putalpha(scr_mask)
    phone.alpha_composite(scr_img, (bx, by))

    # ── App content
    content_painter(phone, bx, by, sw_, sh_)

    # ── Dynamic island notch
    nw = int(pw * 0.26)
    nh = int(ph * 0.021)
    nx = (pw - nw) // 2
    ny = by - nh//2
    d.rounded_rectangle([nx, ny, nx+nw, ny+nh], radius=nh//2, fill=(9, 16, 50))

    # ── Screen glare (soft white polygon top-left)
    glare = Image.new("RGBA", (pw, ph), (0,0,0,0))
    gd    = ImageDraw.Draw(glare)
    gd.polygon([
        (bx + int(sw_*0.04), by + int(sh_*0.02)),
        (bx + int(sw_*0.52), by + int(sh_*0.02)),
        (bx + int(sw_*0.38), by + int(sh_*0.18)),
        (bx + int(sw_*0.00), by + int(sh_*0.18)),
    ], fill=(255, 255, 255, 10))
    phone.alpha_composite(glare)

    # ── Bottom home bar indicator
    bar_w = int(pw * 0.36)
    bar_h = int(ph * 0.007)
    bar_x = (pw - bar_w) // 2
    bar_y = ph - by - int(ph*0.015)
    d.rounded_rectangle([bar_x, bar_y, bar_x+bar_w, bar_y+bar_h],
                         radius=bar_h//2, fill=(200, 215, 255, 80))

    return phone


# ─────────────────────────────────────────────────────────────────────────────
# MAIN GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate():
    print("Generating PaMarket feature graphic…")
    canvas = Image.new("RGBA", (SW, SH), (0, 0, 0, 255))

    # ── 1. Background gradient (navy → royal blue, diagonal)
    bg = np_gradient(SW, SH, NAVY, (28, 72, 190), angle_deg=148)
    canvas.alpha_composite(bg)

    # ── 2. Subtle secondary gradient sweep (bottom-right brightening)
    bg2 = np_gradient(SW, SH, (0,0,0,0), (22, 55, 155, 80), angle_deg=310)
    bg2_img = Image.fromarray(
        np.concatenate([
            np.zeros((SH, SW, 3), dtype=np.uint8),
            (np_gradient(SW, SH, (8,18,62), (28,72,190), 148)
             .split()[0]
             .__class__   # just a placeholder, replaced below
            )
        ], axis=2), "RGBA") if False else None
    # Simpler: just add a second subtle gradient
    x_ = np.linspace(0, 1, SW, np.float32)
    y_ = np.linspace(0, 1, SH, np.float32)
    X2, Y2 = np.meshgrid(x_, y_)
    sweep = np.clip(X2 * 0.6 + (1-Y2) * 0.4, 0, 1) * 30
    sw_arr = np.zeros((SH, SW, 4), np.uint8)
    sw_arr[:, :, 2] = sweep.astype(np.uint8)
    sw_arr[:, :, 3] = sweep.astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(sw_arr, "RGBA"))

    # ── 3. Atmospheric glow blobs
    # Main blue aura (behind phones)
    g1 = radial_glow((SW,SH), int(0.665*SW), int(0.50*SH), int(0.38*SW), BLUE_LIGHT, 95)
    canvas.alpha_composite(g1.filter(ImageFilter.GaussianBlur(70)))

    # Gold accent (top-right corner)
    g2 = radial_glow((SW,SH), int(0.96*SW), int(0.14*SH), int(0.20*SW), GOLD, 60)
    canvas.alpha_composite(g2.filter(ImageFilter.GaussianBlur(55)))

    # Subtle left glow (near copy)
    g3 = radial_glow((SW,SH), 0, int(0.65*SH), int(0.28*SW), BLUE_LIGHT, 35)
    canvas.alpha_composite(g3.filter(ImageFilter.GaussianBlur(60)))

    # Gold rim bottom-right
    g4 = radial_glow((SW,SH), int(1.0*SW), int(1.0*SH), int(0.30*SW), GOLD, 35)
    canvas.alpha_composite(g4.filter(ImageFilter.GaussianBlur(50)))

    # ── 4. Phone drop shadows (painted before phones for depth)
    sh1 = radial_glow((SW,SH), int(0.655*SW), int(0.62*SH), int(0.11*SW), (3,6,20), 160)
    canvas.alpha_composite(sh1.filter(ImageFilter.GaussianBlur(22)))
    sh2 = radial_glow((SW,SH), int(0.815*SW), int(0.64*SH), int(0.08*SW), (3,6,20), 130)
    canvas.alpha_composite(sh2.filter(ImageFilter.GaussianBlur(18)))

    # ── 5. Build & paste LARGE phone (home screen, tilted -8°)
    lp_w = int(164 * SCALE)
    lp_h = int(348 * SCALE)
    lp   = make_phone(lp_w, lp_h, paint_home_screen)
    lp_r = lp.rotate(8, expand=True, resample=Image.BICUBIC)      # tilt left
    lp_cx, lp_cy = int(0.652*SW), int(0.495*SH)
    canvas.alpha_composite(lp_r, (lp_cx - lp_r.width//2, lp_cy - lp_r.height//2))
    print("  Large phone done")

    # ── 6. Build & paste SMALL phone (jobs screen, tilted +6°)
    sp_w = int(112 * SCALE)
    sp_h = int(238 * SCALE)
    sp   = make_phone(sp_w, sp_h, paint_jobs_screen)
    sp_r = sp.rotate(-6, expand=True, resample=Image.BICUBIC)     # tilt right
    sp_cx, sp_cy = int(0.805*SW), int(0.520*SH)   # moved left slightly to avoid crop
    paste_x = max(0, sp_cx - sp_r.width//2)
    paste_y = max(0, sp_cy - sp_r.height//2)
    canvas.alpha_composite(sp_r, (paste_x, paste_y))
    print("  Small phone done")

    # ── 7a. Screen-light glow (phones appear to emit blue light onto scene)
    scr_glow1 = radial_glow((SW,SH), lp_cx, int(0.40*SH), int(0.13*SW), (80,140,255), 55)
    canvas.alpha_composite(scr_glow1.filter(ImageFilter.GaussianBlur(30)))
    scr_glow2 = radial_glow((SW,SH), sp_cx, int(0.38*SH), int(0.09*SW), (80,140,255), 40)
    canvas.alpha_composite(scr_glow2.filter(ImageFilter.GaussianBlur(25)))

    # ── 7. Floating glassmorphism cards
    # "12 New Jobs" – above small phone
    c1 = glass_card(int(140*SCALE), int(48*SCALE),
                    "⚡  12 New Jobs", "Updated just now", (130, 205, 255))
    canvas.alpha_composite(c1, (int(0.720*SW), int(0.060*SH)))

    # "3 Bed House $45K" – upper-left of large phone (depth overlap)
    c2 = glass_card(int(138*SCALE), int(48*SCALE),
                    "🏠  3 Bed House", "USD $45,000", GOLD_WARM)
    canvas.alpha_composite(c2, (int(0.452*SW), int(0.095*SH)))

    # "Verified Seller" – lower-left of large phone
    c3 = glass_card(int(122*SCALE), int(42*SCALE),
                    "✓  Verified Seller", "Harare, Zimbabwe", (100, 225, 145))
    canvas.alpha_composite(c3, (int(0.455*SW), int(0.800*SH)))

    # ── 8. Left-side typography
    draw = ImageDraw.Draw(canvas)
    LX   = int(42 * SCALE)   # left margin

    # ── Logo block
    icon_src_path = "/home/user/PaMarket/www/img/icon-512.png"
    icon_sz = int(46 * SCALE)
    try:
        icon_img = Image.open(icon_src_path).convert("RGBA")
        icon_img = icon_img.resize((icon_sz, icon_sz), Image.LANCZOS)
        # Apply rounded corners
        icon_img.putalpha(rounded_mask((icon_sz, icon_sz), int(10*SCALE)))
        # Subtle drop shadow for icon
        shadow_icon = Image.new("RGBA", (icon_sz+8, icon_sz+8), (0,0,0,0))
        shadow_icon.alpha_composite(icon_img, (4, 4))
        shadow_icon = shadow_icon.filter(ImageFilter.GaussianBlur(5))
        canvas.alpha_composite(shadow_icon, (LX-2, int(36*SCALE)-2))
        canvas.alpha_composite(icon_img, (LX, int(36*SCALE)))
        icon_end_x = LX + icon_sz
    except Exception as e:
        print(f"  Icon load error: {e}")
        icon_end_x = LX

    # "PaMarket" wordmark
    try:
        logo_f = F("bold", 23)
        tx     = icon_end_x + int(10*SCALE)
        ty     = int(46*SCALE)
        pa_w   = int(draw.textlength("Pa", font=logo_f))
        draw.text((tx, ty), "Pa",     fill=WHITE, font=logo_f)
        draw.text((tx+pa_w, ty), "Market", fill=GOLD, font=logo_f)
    except Exception as e:
        print(f"  Logo text: {e}")

    # ── Gold rule beneath logo
    rule_y = int(97 * SCALE)
    # Main rule
    draw.rectangle([LX, rule_y, LX + int(60*SCALE), rule_y + int(3*SCALE)], fill=GOLD)
    # Fade extension
    fade_ext = Image.new("RGBA", (int(40*SCALE), int(3*SCALE)), (0,0,0,0))
    for x in range(int(40*SCALE)):
        alpha = int(255 * (1 - x / (40*SCALE)))
        for y2 in range(int(3*SCALE)):
            fade_ext.putpixel((x, y2), GOLD + (alpha,))
    canvas.alpha_composite(fade_ext, (LX + int(60*SCALE), rule_y))

    # ── Main headline  "Buy. Sell." / "Hire."
    try:
        h1f = F("display-bold", 64)
        hy1 = int(106 * SCALE)
        draw.text((LX, hy1), "Buy. Sell.", fill=WHITE, font=h1f)

        hy2 = hy1 + int(74 * SCALE)
        hire_w = int(draw.textlength("Hire", font=h1f))
        draw.text((LX,         hy2), "Hire", fill=WHITE, font=h1f)
        draw.text((LX+hire_w,  hy2), ".",    fill=GOLD,  font=h1f)
    except Exception as e:
        print(f"  Headline: {e}")

    # ── Subtitle
    try:
        sub_f = F("regular", 14)
        sub_y = int(266 * SCALE)
        draw.text((LX, sub_y),              "Zimbabwe's trusted marketplace for",    fill=PALE_BLUE, font=sub_f)
        draw.text((LX, sub_y+int(20*SCALE)),"property, vehicles, jobs & services.", fill=PALE_BLUE, font=sub_f)
    except Exception as e:
        print(f"  Subtitle: {e}")

    # ── Category pills
    pills    = [
        ("Buy",      GOLD),
        ("Sell",     (100, 205, 130)),
        ("Jobs",     (100, 165, 255)),
        ("Property", (200, 130, 255)),
        ("Services", (80,  210, 210)),
    ]
    pill_f   = F("medium", 11)
    pill_h   = int(25 * SCALE)
    pill_pad = int(10 * SCALE)
    px       = LX
    py       = int(325 * SCALE)
    row_max  = int(410 * SCALE)

    for label, col in pills:
        tw   = int(draw.textlength(label, font=pill_f))
        pw_  = tw + pill_pad * 2
        if px + pw_ > row_max:
            px = LX
            py += pill_h + int(8*SCALE)
        # pill RGBA image
        pill_img = Image.new("RGBA", (pw_, pill_h), (0,0,0,0))
        pd_      = ImageDraw.Draw(pill_img)
        pd_.rounded_rectangle([0, 0, pw_-1, pill_h-1],
                               radius=pill_h//2,
                               fill=col+(40,), outline=col+(110,), width=SCALE)
        pd_.text((pill_pad, int(5*SCALE)), label, fill=WHITE, font=pill_f)
        canvas.alpha_composite(pill_img, (px, py))
        px += pw_ + int(8*SCALE)

    # ── Subtle decorative ring (left-side circle accent, large, very faint)
    ring_layer = Image.new("RGBA", (SW, SH), (0,0,0,0))
    rd         = ImageDraw.Draw(ring_layer)
    rrx = int(-0.04 * SW)
    rry = int(0.72  * SH)
    rrR = int(0.18  * min(SW, SH))
    rd.ellipse([rrx-rrR, rry-rrR, rrx+rrR, rry+rrR],
               outline=(255,255,255,18), width=int(2*SCALE))
    canvas.alpha_composite(ring_layer)

    # Second ring (right area, behind phones)
    ring2 = Image.new("RGBA", (SW, SH), (0,0,0,0))
    r2d   = ImageDraw.Draw(ring2)
    r2d.ellipse([int(0.55*SW)-int(0.22*SH), int(0.50*SH)-int(0.22*SH),
                 int(0.55*SW)+int(0.22*SH), int(0.50*SH)+int(0.22*SH)],
                outline=(255,255,255,12), width=int(2*SCALE))
    canvas.alpha_composite(ring2)

    # ── 9. Left-side vignette — keeps copy area clean and readable
    vig = Image.new("RGBA", (SW, SH), (0,0,0,0))
    vx_ = np.linspace(0, 1, SW, dtype=np.float32)
    vy_ = np.linspace(0, 1, SH, dtype=np.float32)
    VX, VY = np.meshgrid(vx_, vy_)
    # Darken very left edge slightly, brighten centre-left slightly
    v_alpha = np.clip((1.0 - VX * 3.5), 0, 1) * 40  # dark left band
    v_arr   = np.zeros((SH, SW, 4), dtype=np.uint8)
    v_arr[:,:,3] = v_alpha.astype(np.uint8)
    canvas.alpha_composite(Image.fromarray(v_arr, "RGBA"))

    # ── 10. Subtle bottom fade to deep navy (grounds the composition)
    fade_arr = np.zeros((SH, SW, 4), dtype=np.uint8)
    fade_t   = np.clip((vy_ - 0.75) / 0.25, 0, 1) ** 1.5
    for y in range(SH):
        fade_arr[y, :, 3] = int(fade_t[y // 1] * 80) if y // 1 < len(fade_t) else 0
    canvas.alpha_composite(Image.fromarray(fade_arr, "RGBA"))

    # ── 11. Downsample to final 1024 × 500
    print("  Downsampling…")
    final = canvas.resize((W, H), Image.LANCZOS).convert("RGB")

    out_path = "/home/user/PaMarket/store-assets/feature-graphic-1024x500.png"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path, "PNG", optimize=True)
    print(f"  Saved → {out_path}")
    return final


if __name__ == "__main__":
    generate()
