# Original procedural score (no samples, no third-party audio). Arc follows the film's acts.
import json, numpy as np, soundfile as sf
SR = 48000
plan = json.load(open('src/plan.json')); D = json.load(open('src/vo-durations.json')); FPS = plan['fps']
OV = dict(cut=0, block=0, jump=0, glitch=0, whip=14, roll=24, wipe=20, zoom=18, dissolve=26)
f = lambda s: round(s * FPS)
starts = {}; cursor = 0
for s in plan['scenes']:
    fr = max(0, cursor - OV[s['in']]); t = f(s['lead']) + OV[s['in']]
    for i, v in enumerate(s['vo']):
        if i: t += f(s['gap'])
        t += f(D[v])
    t += f(s['tail']); starts[s['id']] = fr / FPS; cursor = fr + t
TOTAL = cursor / FPS
print('total s', round(TOTAL, 2)); print({k: round(v, 1) for k, v in starts.items()})
N = int(TOTAL * SR) + SR
out = np.zeros((N, 2))
rng = np.random.default_rng(3)
BPM = 96; beat = 60 / BPM
def note(m): return 440 * 2 ** ((m - 69) / 12)
def add(x, at, gain=1.0, pan=0.0):
    i = int(at * SR); j = min(N, i + len(x));
    if i >= N: return
    seg = x[: j - i] * gain
    out[i:j, 0] += seg * (1 - pan) ; out[i:j, 1] += seg * (1 + pan)
def lp(x, k):
    y = np.empty_like(x); a = 0.0
    for n in range(len(x)): a += k * (x[n] - a); y[n] = a
    return y
def pad(midis, dur, bright=0.08, gain=0.12):
    t = np.arange(int(dur * SR)) / SR; x = np.zeros_like(t)
    for m in midis:
        for det in (-0.07, 0.0, 0.07):
            ph = 2 * np.pi * note(m + det) * t + rng.uniform(0, 6)
            x += (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.33
    x = lp(x / len(midis), bright)
    e = np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 1.2)
    return x * e * gain
def kick():
    t = np.arange(int(0.5 * SR)) / SR; fq = 48 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fq) / SR) * np.exp(-t * 7)
def hat():
    n = int(0.06 * SR); x = rng.standard_normal(n); x = x - lp(x, 0.3); return x * np.exp(-np.linspace(0, 9, n)) * 0.25
def pluck(m, dur=0.35):
    t = np.arange(int(dur * SR)) / SR; return (np.sin(2*np.pi*note(m)*t) + 0.4*np.sin(4*np.pi*note(m)*t)) * np.exp(-t * 9)
def bass(m, dur):
    t = np.arange(int(dur * SR)) / SR; ph = 2*np.pi*note(m)*t
    return lp(np.tanh(np.sin(ph) * 2.5), 0.05) * np.minimum(1, t*40) * np.exp(-t*1.2)
def sec(a, b): return starts[a], starts[b] if b else TOTAL
# chord progressions
minor = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]      # Am F G Em  (tension)
major = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]      # C Am F G   (lift/drive)
def chords(a, b, prog, bars=2, bright=0.06, gain=0.12, oct=0):
    t = a; i = 0; L = 4 * beat * bars
    while t < b:
        add(pad([m + oct for m in prog[i % len(prog)]], min(L + 1.2, b - t + 1.2), bright, gain), t); t += L; i += 1
def drums(a, b, k=True, h=True, kg=0.5, hg=0.35, half=False):
    t = a; n = 0
    while t < b:
        if k and (not half or n % 2 == 0): add(kick(), t, kg)
        if h: add(hat(), t + beat / 2, hg, 0.3)
        t += beat; n += 1
def bassline(a, b, prog, bars=2):
    t = a; i = 0
    while t < b:
        root = prog[i % len(prog)][0] - 24
        for q in range(4 * bars):
            if t + q * beat < b: add(bass(root, beat * 0.95), t + q * beat, 0.22)
        t += 4 * beat * bars; i += 1
def arp(a, b, prog, gain=0.08, step=0.5, bars=2):
    t = a; i = 0
    while t < b:
        ch = prog[(int((t - a) / (4 * beat * bars))) % len(prog)]
        m = ch[i % 3] + 12 * (1 + (i // 3) % 2); add(pluck(m), t, gain, 0.4 * np.sin(i)); t += beat * step; i += 1
# --- arc ---
a, b = sec('hook', 'title'); chords(a, b, [[45, 52]], bars=4, bright=0.02, gain=0.10)                        # drone
a, b = sec('title', 'problem'); chords(a, b, [major[0]], bars=2, bright=0.05, gain=0.13)
a, b = sec('problem', 'breaker1'); chords(a, b, minor, bars=1, bright=0.04, gain=0.11); drums(a, b, k=True, h=True, kg=0.35, hg=0.25, half=True)
a, b = sec('turn', 'w-import'); chords(a, b, major, bars=1, bright=0.08, gain=0.13); arp(a, b, major, 0.05)
a, b = sec('w-import', 'hood'); chords(a, b, major, bright=0.05, gain=0.08); drums(a, b, kg=0.42, hg=0.22); bassline(a, b, major); arp(a, b, major, 0.04)
a, b = sec('hood', 'impact'); chords(a, b, [[60, 64, 71], [57, 64, 67]], bars=2, bright=0.1, gain=0.11); arp(a, b, [[72, 76, 79], [69, 72, 76]], 0.05, step=0.25)
a, b = sec('impact', 'breaker2'); chords(a, b, major, bars=1, bright=0.09, gain=0.12); drums(a, b, kg=0.5, hg=0.3); bassline(a, b, major, bars=1); arp(a, b, major, 0.05, step=0.5, bars=1)
a, b = sec('outro', None); chords(a, b, [[48, 55, 64, 67], [53, 57, 64, 69]], bars=2, bright=0.05, gain=0.13)
# soft master: gentle saturation + fade out
out = np.tanh(out * 1.3) * 0.8
tail = int(3 * SR); out[-tail:] *= np.linspace(1, 0, tail)[:, None]
sf.write('public/music.wav', out.astype(np.float32), SR)
print('music ok')
