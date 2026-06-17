#!/usr/bin/env python3
"""
PaMarket – Google Play Feature Graphic  v3
1024 × 500 px  |  3× supersampled

Design: Original diagonal two-tone split.
Left  : Royal Blue (#163DAA) panel with subtle blueprint-line texture.
Right : Deep Navy background with phone hero + secondary phone.
Accent: Gold diagonal cut-line + gold left-edge bar.
"""

import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Resolution ─────────────────────────────────────────────────────────────
SCALE = 3
W, H   = 1024, 500
SW, SH = W * SCALE, H * SCALE

# ── Palette ─────────────────────────────────────────────────────────────────
ROYAL_BLUE  = (22,  61, 170)   # #163DAA
DEEP_NAVY   = (6,   12,  46)   # right panel dark
BLUE_PANEL  = (15,  38, 130)   # slightly lighter variant inside left panel
GOLD        = (242, 168,  29)
GOLD_BRIGHT = (255, 192,  55)
WHITE       = (255, 255, 255)
PALE_BLUE   = (188, 210, 255)

# Diagonal cut:  (DIAG_TOP, 0) → (DIAG_BOT, H)  in 1× pixel space
DIAG_TOP = 442   # x at y = 0   (right-of-centre is right panel)
DIAG_BOT = 402   # x at y = 500

FONT_DIR = "/tmp/fonts/extras/ttf"
ICON_PATH = "/home/user/PaMarket/www/img/icon-512.png"
UPLOAD    = "/root/.claude/uploads/df1f325b-5f6a-54b1-b075-a68a4cead434"
SCROT_HOME = f"{UPLOAD}/9e970a62-12bb1b68accc474a9d00d7faf3400d4a.jpeg"
SCROT_JOBS = f"{UPLOAD}/2ad5e8be-5b8499b3d96f4b6aaa6aba831118d874.jpeg"

# ── Font loader ──────────────────────────────────────────────────────────────
def F(v, sz):
    n = {"display-bold":"InterDisplay-Bold.ttf", "bold":"Inter-Bold.ttf",
         "semibold":"Inter-SemiBold.ttf", "medium":"Inter-Medium.ttf",
         "regular":"Inter-Regular.ttf", "light":"Inter-Light.ttf"}
    return ImageFont.truetype(f"{FONT_DIR}/{n[v]}", sz * SCALE)

# ── Helpers ───────────────────────────────────────────────────────────────────
def rounded_mask(sz, r):
    m = Image.new("L", sz, 0)
    ImageDraw.Draw(m).rounded_rectangle([0,0,sz[0]-1,sz[1]-1], radius=r, fill=255)
    return m

def radial_glow(wh, cx, cy, r, col, alpha=90):
    w, h = wh
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    t  = np.clip(1.0 - np.sqrt((X-cx)**2+(Y-cy)**2)/r, 0, 1)**2.0
    a  = np.zeros((h,w,4), np.uint8)
    a[:,:,0]=col[0]; a[:,:,1]=col[1]; a[:,:,2]=col[2]
    a[:,:,3]=np.clip(t*alpha,0,255).astype(np.uint8)
    return Image.fromarray(a,"RGBA")

def make_phone(pw, ph, scrot_path, rotation_deg=0, crop_top=0.0):
    """Real-screenshot phone mockup, optionally rotated."""
    phone  = Image.new("RGBA", (pw, ph), (0,0,0,0))
    d      = ImageDraw.Draw(phone)
    radius = int(pw * 0.12)

    # Body gradient left→right dark navy
    bdy = np.zeros((ph,pw,4), np.uint8)
    for x in range(pw):
        t = x/max(pw-1,1)
        bdy[:,x,:] = [int(13+13*t), int(21+17*t), int(70+52*t), 255]
    bimg = Image.fromarray(bdy,"RGBA")
    bimg.putalpha(rounded_mask((pw,ph), radius))
    phone.alpha_composite(bimg)

    # Frame border + top specular
    d.rounded_rectangle([0,0,pw-1,ph-1], radius=radius,
                         outline=(90,130,240,80), width=max(1,SCALE))
    d.rounded_rectangle([int(pw*.12),1,int(pw*.88),int(ph*.005)+1],
                         radius=1, fill=(180,205,255,38))

    # Screen bezel
    bx, by = int(pw*.055), int(ph*.038)
    sw_, sh_ = pw-2*bx, ph-2*by
    sr = int(pw*.08)

    # Paste real screenshot
    try:
        sc = Image.open(scrot_path).convert("RGBA")
        if crop_top > 0:
            sc = sc.crop((0,int(sc.height*crop_top),sc.width,sc.height))
        sc = sc.resize((sw_, int(sc.height*sw_/sc.width)), Image.LANCZOS)
        if sc.height >= sh_:
            sc = sc.crop((0,0,sw_,sh_))
        else:
            bg  = sc.getpixel((sw_//2, sc.height-1))[:3]
            pad = Image.new("RGBA",(sw_,sh_), bg+(255,))
            pad.alpha_composite(sc)
            sc  = pad
        sc.putalpha(rounded_mask((sw_,sh_), sr))
        phone.alpha_composite(sc, (bx,by))
    except Exception as e:
        print(f"  [screenshot] {e}")
        fb = Image.new("RGBA",(sw_,sh_),(11,20,60,255))
        fb.putalpha(rounded_mask((sw_,sh_),sr))
        phone.alpha_composite(fb,(bx,by))

    # Dynamic island
    nw,nh = int(pw*.26),int(ph*.020)
    d.rounded_rectangle([(pw-nw)//2,by-nh//2,(pw+nw)//2,by+nh//2],
                         radius=nh//2, fill=(10,18,58))

    # Glare strip
    gl = Image.new("RGBA",(pw,ph),(0,0,0,0))
    ImageDraw.Draw(gl).polygon([
        (bx+int(sw_*.03), by+int(sh_*.01)),
        (bx+int(sw_*.50), by+int(sh_*.01)),
        (bx+int(sw_*.37), by+int(sh_*.14)),
        (bx,              by+int(sh_*.14)),
    ], fill=(255,255,255,9))
    phone.alpha_composite(gl)

    # Home bar
    hw = int(pw*.35); hh = max(1,int(ph*.006))
    hx = (pw-hw)//2;  hy = ph-by-int(ph*.014)
    d.rounded_rectangle([hx,hy,hx+hw,hy+hh], radius=hh//2,
                         fill=(215,228,255,65))

    if rotation_deg:
        return phone.rotate(-rotation_deg, expand=True, resample=Image.BICUBIC)
    return phone


def glass_card(wp, hp, title, subtitle, accent=GOLD):
    c  = Image.new("RGBA",(wp,hp),(0,0,0,0))
    cd = ImageDraw.Draw(c)
    r  = int(10*SCALE)
    cd.rounded_rectangle([0,0,wp-1,hp-1], radius=r,
                          fill=(10,24,85,218), outline=(105,152,255,120),
                          width=max(1,SCALE))
    cd.rounded_rectangle([1,1,wp-2,int(hp*.33)], radius=r,
                          fill=(255,255,255,12))
    try:
        cd.text((int(11*SCALE),int(7*SCALE)),  title,    fill=WHITE,  font=F("semibold",9))
        cd.text((int(11*SCALE),int(20*SCALE)), subtitle, fill=accent, font=F("regular", 7))
    except: pass
    return c


# ─────────────────────────────────────────────────────────────────────────────
# GENERATE
# ─────────────────────────────────────────────────────────────────────────────

def generate():
    print("PaMarket feature graphic v3 – diagonal split…")
    C = Image.new("RGBA",(SW,SH),(0,0,0,255))

    # ── 1. Right-panel base: deep navy with very subtle centre brightening
    rp = np.zeros((SH,SW,4),np.uint8)
    rp[:,:,0]=DEEP_NAVY[0]; rp[:,:,1]=DEEP_NAVY[1]; rp[:,:,2]=DEEP_NAVY[2]; rp[:,:,3]=255
    C.alpha_composite(Image.fromarray(rp,"RGBA"))

    X_,Y_ = np.meshgrid(np.linspace(0,1,SW,np.float32),
                         np.linspace(0,1,SH,np.float32))
    d2 = np.sqrt((X_-.70)**2+(Y_-.50)**2)
    br = np.clip(1-d2/.55,0,1)*20
    br_arr = np.zeros((SH,SW,4),np.uint8); br_arr[:,:,2]=br.astype(np.uint8)
    br_arr[:,:,3]=br.astype(np.uint8)
    C.alpha_composite(Image.fromarray(br_arr,"RGBA"))

    # ── 2. Left panel: Royal Blue diagonal polygon
    lp = Image.new("RGBA",(SW,SH),(0,0,0,0))
    lpd= ImageDraw.Draw(lp)
    lpd.polygon([
        (0,0),(DIAG_TOP*SCALE,0),
        (DIAG_BOT*SCALE,SH),(0,SH),
    ], fill=ROYAL_BLUE+(255,))
    C.alpha_composite(lp)

    # Subtle inner left-panel gradient (top slightly lighter)
    inner = np.zeros((SH,SW,4),np.uint8)
    top_t = np.clip(1.0-Y_*2.2,0,1)*16
    inner[:,:,0]=top_t.astype(np.uint8); inner[:,:,1]=top_t.astype(np.uint8)
    inner[:,:,2]=top_t.astype(np.uint8); inner[:,:,3]=top_t.astype(np.uint8)
    inner_img = Image.fromarray(inner,"RGBA")
    inner_img.putalpha(lp.split()[3])
    C.alpha_composite(inner_img)

    # ── 3. Blueprint diagonal line pattern (left panel only)
    bp = Image.new("RGBA",(SW,SH),(0,0,0,0))
    bpd= ImageDraw.Draw(bp)
    line_col = (55,110,228,18)
    step = int(22*SCALE)
    for offset in range(-SH, SW+SH, step):
        bpd.line([(offset,0),(offset+SH,SH)], fill=line_col, width=max(1,SCALE))
    bp.putalpha(lp.split()[3])
    C.alpha_composite(bp)

    # ── 4. Gold bar – left edge (4 px at 1×)
    gb = Image.new("RGBA",(SW,SH),(0,0,0,0))
    ImageDraw.Draw(gb).rectangle([0,0,int(4*SCALE),SH], fill=GOLD+(255,))
    C.alpha_composite(gb)

    # ── 5. Gold diagonal accent line + soft glow
    dl = Image.new("RGBA",(SW,SH),(0,0,0,0))
    ImageDraw.Draw(dl).line(
        [(DIAG_TOP*SCALE,0),(DIAG_BOT*SCALE,SH)],
        fill=GOLD+(210,), width=int(2.5*SCALE))
    C.alpha_composite(dl.filter(ImageFilter.GaussianBlur(int(3.5*SCALE))))
    C.alpha_composite(dl)

    # ── 6. Right-panel atmospheric glows
    g1 = radial_glow((SW,SH),int(.660*SW),int(.500*SH),int(.390*SW),(35,85,215),75)
    C.alpha_composite(g1.filter(ImageFilter.GaussianBlur(75)))
    g2 = radial_glow((SW,SH),int(.975*SW),int(.120*SH),int(.170*SW),GOLD,52)
    C.alpha_composite(g2.filter(ImageFilter.GaussianBlur(52)))
    g3 = radial_glow((SW,SH),int(.975*SW),int(.950*SH),int(.200*SW),GOLD,30)
    C.alpha_composite(g3.filter(ImageFilter.GaussianBlur(55)))

    # ── 7. Phone drop shadows
    s1 = radial_glow((SW,SH),int(.628*SW),int(.635*SH),int(.110*SW),(1,3,14),185)
    C.alpha_composite(s1.filter(ImageFilter.GaussianBlur(26)))
    s2 = radial_glow((SW,SH),int(.806*SW),int(.645*SH),int(.088*SW),(1,3,14),155)
    C.alpha_composite(s2.filter(ImageFilter.GaussianBlur(22)))

    # ── 8. Large phone  –  Home screen  (tilt -5°)
    lp_w = int(184*SCALE); lp_h = int(392*SCALE)
    lphone = make_phone(lp_w, lp_h, SCROT_HOME, rotation_deg=-5)
    lp_cx, lp_cy = int(.628*SW), int(.485*SH)
    C.alpha_composite(lphone, (lp_cx-lphone.width//2, lp_cy-lphone.height//2))
    print("  Large phone done")

    # ── 9. Small phone  –  Jobs / Hire Talent  (tilt +8°)
    sp_w = int(118*SCALE); sp_h = int(251*SCALE)
    sphone = make_phone(sp_w, sp_h, SCROT_JOBS, rotation_deg=8)
    sp_cx, sp_cy = int(.808*SW), int(.508*SH)
    C.alpha_composite(sphone, (max(0,sp_cx-sphone.width//2),
                                max(0,sp_cy-sphone.height//2)))
    print("  Small phone done")

    # ── 10. Screen-light glow (phones appear to emit light)
    sg = radial_glow((SW,SH), lp_cx, int(.37*SH), int(.13*SW),(80,145,255),42)
    C.alpha_composite(sg.filter(ImageFilter.GaussianBlur(30)))

    # ── 11. Glass info-cards (right panel only)
    c1 = glass_card(int(130*SCALE),int(46*SCALE),
                    "🚗  Honda Fit","USD $5,000  ·  Harare", GOLD_BRIGHT)
    C.alpha_composite(c1,(int(.450*SW),int(.080*SH)))

    c2 = glass_card(int(134*SCALE),int(46*SCALE),
                    "💼  Hire Talent","127 verified candidates",(128,205,255))
    C.alpha_composite(c2,(int(.718*SW),int(.050*SH)))

    c3 = glass_card(int(118*SCALE),int(40*SCALE),
                    "✓  Verified Seller","Harare, Zimbabwe",(100,228,145))
    C.alpha_composite(c3,(int(.452*SW),int(.808*SH)))

    # ── 12. Left-panel typography ─────────────────────────────────────────────
    draw = ImageDraw.Draw(C)
    LX = int(36*SCALE)   # text left margin (clear of 4px gold bar)

    # App icon
    icon_sz = int(42*SCALE)
    try:
        ico = Image.open(ICON_PATH).convert("RGBA").resize((icon_sz,icon_sz),Image.LANCZOS)
        ico.putalpha(rounded_mask((icon_sz,icon_sz),int(9*SCALE)))
        shd = Image.new("RGBA",(icon_sz+8,icon_sz+8),(0,0,0,0))
        shd.alpha_composite(ico,(4,4))
        shd = shd.filter(ImageFilter.GaussianBlur(5))
        C.alpha_composite(shd,(LX-2,int(30*SCALE)-2))
        C.alpha_composite(ico, (LX,int(30*SCALE)))
        ix_end = LX+icon_sz
    except Exception as e:
        print(f"  icon: {e}"); ix_end = LX

    # Wordmark "PaMarket"
    try:
        wf  = F("bold",20)
        wtx = ix_end+int(8*SCALE)
        wty = int(38*SCALE)
        pw_ = int(draw.textlength("Pa",font=wf))
        draw.text((wtx,wty),"Pa",     fill=WHITE,font=wf)
        draw.text((wtx+pw_,wty),"Market",fill=GOLD, font=wf)
    except Exception as e: print(f"  wordmark: {e}")

    # Gold rule beneath wordmark
    ry = int(86*SCALE)
    draw.rectangle([LX,ry,LX+int(65*SCALE),ry+int(3*SCALE)],fill=GOLD)
    # Fade tail
    for xi in range(int(32*SCALE)):
        a = int(255*(1-xi/(32*SCALE)))
        for yi in range(int(3*SCALE)):
            draw.point((LX+int(65*SCALE)+xi, ry+yi),
                       fill=GOLD+(a,))

    # Headline  "Buy. Sell. / Hire."
    try:
        hf  = F("display-bold",64)
        hy1 = int(96*SCALE)
        draw.text((LX,hy1),"Buy. Sell.",fill=WHITE,font=hf)
        hy2 = hy1+int(73*SCALE)
        hw_ = int(draw.textlength("Hire",font=hf))
        draw.text((LX,   hy2),"Hire",fill=WHITE,font=hf)
        draw.text((LX+hw_,hy2),".", fill=GOLD, font=hf)
    except Exception as e: print(f"  headline: {e}")

    # Subtitle
    try:
        sf = F("regular",13)
        sy = int(254*SCALE)
        for i, line in enumerate([
            "Zimbabwe's trusted marketplace",
            "for property, vehicles, jobs",
            "and services.",
        ]):
            draw.text((LX, sy+i*int(20*SCALE)), line, fill=PALE_BLUE, font=sf)
    except Exception as e: print(f"  subtitle: {e}")

    # Feature dots with labels
    features = [
        ("Buy & Sell",    GOLD),
        ("Find Jobs",     (128,208,255)),
        ("Rent Property", (100,228,145)),
        ("Services",      (205,155,255)),
    ]
    try:
        ff   = F("medium",11)
        fy0  = int(322*SCALE)
        dr   = int(3.5*SCALE)
        for i,(label,col) in enumerate(features):
            fy = fy0 + i*int(28*SCALE)
            if fy > SH-int(18*SCALE): break
            cx_ = LX+dr; cy_ = fy+dr+int(2*SCALE)
            draw.ellipse([cx_-dr,cy_-dr,cx_+dr,cy_+dr],fill=col)
            draw.text((LX+dr*2+int(6*SCALE),fy),label,fill=WHITE,font=ff)
    except Exception as e: print(f"  features: {e}")

    # ── 13. Subtle bottom fade
    _,VY = np.meshgrid(np.linspace(0,1,SW,np.float32),
                        np.linspace(0,1,SH,np.float32))
    ft = np.clip((VY-.76)/.24,0,1)**1.5*65
    fa = np.zeros((SH,SW,4),np.uint8); fa[:,:,3]=ft.astype(np.uint8)
    C.alpha_composite(Image.fromarray(fa,"RGBA"))

    # ── 14. Thin white vignette edge around entire graphic (premium frame feel)
    edge = Image.new("RGBA",(SW,SH),(0,0,0,0))
    ImageDraw.Draw(edge).rectangle([0,0,SW-1,SH-1],
                                    outline=(255,255,255,18),
                                    width=int(2*SCALE))
    C.alpha_composite(edge)

    # ── 15. Downsample 3× → 1×
    print("  Downsampling…")
    final = C.resize((W,H),Image.LANCZOS).convert("RGB")
    out   = "/home/user/PaMarket/store-assets/feature-graphic-1024x500.png"
    os.makedirs(os.path.dirname(out),exist_ok=True)
    final.save(out,"PNG",optimize=True)
    print(f"  ✓ {out}")
    return final

if __name__ == "__main__":
    generate()
