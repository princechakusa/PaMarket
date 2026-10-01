# Synthesises a 30 s mbira-flavoured, Afro-pop bed (no vocals, no samples).
# Run from motion-studio/: python scenes/fair-price/tools/music.py → scenes/fair-price/music.wav
import numpy as np, wave
SR, DUR, BPM = 44100, 30.0, 104
beat = 60 / BPM; N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(3)
mix = np.zeros(N)

def add(sig, at, gain=1.0):
    i = int(at * SR)
    if i >= N: return
    j = min(N, i + len(sig)); mix[i:j] += sig[:j - i] * gain

def mbira(f, d=1.6):
    x = np.arange(int(SR * d)) / SR
    s = np.sin(2*np.pi*f*x) * np.exp(-x*3.2) + .35*np.sin(2*np.pi*f*5.4*x) * np.exp(-x*18) + .12*np.sin(2*np.pi*f*2*x)*np.exp(-x*6)
    buzz = rng.standard_normal(len(x)) * np.exp(-x*9) * .02
    s += buzz * (1 + np.sin(2*np.pi*f*x))
    return s * np.minimum(1, x / .003)

def kick():
    x = np.arange(int(SR*.35))/SR; f = 48 + 90*np.exp(-x*30)
    return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-x*9)

def shaker(acc):
    x = np.arange(int(SR*.06))/SR; n = rng.standard_normal(len(x))
    n = np.diff(np.concatenate([[0], n]))  # crude high-pass
    return n * np.exp(-x*70) * (.5 if acc else .28)

def clap():
    x = np.arange(int(SR*.18))/SR; n = rng.standard_normal(len(x))
    env = np.exp(-x*30) + .6*np.exp(-np.maximum(0, x-.012)*40)*(x > .012)
    return np.diff(np.concatenate([[0], n])) * env * .5

def bass(f, d):
    x = np.arange(int(SR*d))/SR
    return (np.sin(2*np.pi*f*x) + .25*np.sin(2*np.pi*2*f*x)) * np.exp(-x*2.2) * np.minimum(1, x/.01)

def pad(fs, d):
    x = np.arange(int(SR*d))/SR; s = sum(np.sin(2*np.pi*f*x + i) for i, f in enumerate(fs))
    return s / len(fs) * np.minimum(1, x/.6) * np.minimum(1, (d - x)/.6)

hz = lambda m: 440 * 2 ** ((m - 69) / 12)
# I–V–vi–IV in C, one chord per bar (4 beats)
prog = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
roots = [36, 43, 45, 41]
pattern = [0, 2, 1, 2, 0, 2, 1, 3]  # interlocking mbira-style arpeggio indexes per 8th
bar = 4 * beat
nbars = int(DUR / bar) + 1
for b in range(nbars):
    c = prog[b % 4]; t0 = b * bar
    add(pad([hz(m) for m in c], bar + .3), t0, .05)
    add(bass(hz(roots[b % 4]), beat * 1.6), t0, .32)
    add(bass(hz(roots[b % 4]), beat * 1.2), t0 + 2.5 * beat, .22)
    for k in range(8):
        idx = pattern[k]; m = c[idx % 3] + (12 if idx == 3 else 0) + 12
        add(mbira(hz(m)), t0 + k * beat / 2, .16 if k % 2 == 0 else .11)
        if b >= 1 and k in (3, 7):  # off-beat upper line enters after bar 1
            add(mbira(hz(c[(k // 4 + b) % 3] + 24), 1.0), t0 + k * beat / 2 + beat / 4, .06)
    for q in range(4):
        add(kick(), t0 + q * beat, .55 if q in (0, 2) else .3)
        if q in (1, 3): add(clap(), t0 + q * beat, .22)
    for s in range(16):
        add(shaker(s % 4 == 2), t0 + s * beat / 4 + (0.012 if s % 2 else 0), .5)

# gentle lift: drums thin out for the first bar, fade in/out
mix *= np.minimum(1, t / .6)
mix *= np.clip((30 - t) / 1.8, 0, 1)
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix /= np.max(np.abs(mix)) / .7
st = np.stack([mix, np.roll(mix, 220) * .96], 1)
with wave.open('scenes/fair-price/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype('<i2').tobytes())
print('music.wav written')
