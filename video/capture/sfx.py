# Original, procedurally generated SFX (no third-party audio, no license needed).
import numpy as np, soundfile as sf
SR = 48000
rng = np.random.default_rng(7)
def env(n, a, d):  # attack/decay envelope in samples
    e = np.ones(n); a = max(1, int(a)); e[:a] = np.linspace(0, 1, a); e[a:] = np.exp(-np.linspace(0, d, n - a)); return e
def lp(x, k):  # one-pole lowpass, k in (0,1)
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x): acc += k * (v - acc); y[i] = acc
    return y
def save(name, x, g=0.9):
    x = x / (np.abs(x).max() + 1e-9) * g; sf.write(f'public/sfx/{name}.wav', np.stack([x, x], 1).astype(np.float32), SR)
t = lambda s: np.arange(int(SR * s)) / SR
# soft UI click
n = int(SR * .06); c = rng.standard_normal(n) * env(n, 10, 60); c = c - lp(c, .2); save('click', c + np.sin(2*np.pi*1800*t(.06)) * env(n, 5, 40) * .5, .5)
# keyboard key
n = int(SR * .05); k = lp(rng.standard_normal(n), .5) * env(n, 5, 50); save('key', k + np.sin(2*np.pi*420*t(.05))*env(n,3,70)*.6, .45)
# whoosh (filtered noise sweep)
s = 0.55; n = int(SR*s); w = rng.standard_normal(n); out = np.zeros(n); acc = 0.0
ks = np.concatenate([np.linspace(.01, .35, n//2), np.linspace(.35, .01, n - n//2)])
for i in range(n): acc += ks[i]*(w[i]-acc); out[i] = acc
save('whoosh', out * np.sin(np.linspace(0, np.pi, n))**2, .7)
# sub hit
tt = t(1.4); f = 55 * np.exp(-tt*3) + 38; ph = 2*np.pi*np.cumsum(f)/SR
hit = np.sin(ph) * np.exp(-tt*2.6) + lp(rng.standard_normal(len(tt)), .08) * np.exp(-tt*18) * .6
save('hit', np.tanh(hit*1.6), .95)
# riser
tt = t(2.0); f = 200 + 1400 * (tt/2)**2; r = np.sin(2*np.pi*np.cumsum(f)/SR) * (tt/2)**2 * .4 + lp(rng.standard_normal(len(tt)), .15) * (tt/2)**3
save('riser', r, .5)
# chime (learned / test saved)
tt = t(1.6); ch = sum(np.sin(2*np.pi*fr*tt)*np.exp(-tt*k)*a for fr,k,a in [(1046.5,3,.6),(1568,4,.4),(2093,6,.2)])
save('chime', ch, .45)
# glitch
n = int(SR*.25); g = np.sign(np.sin(2*np.pi*np.repeat(rng.uniform(80,900,25), n//25+1)[:n]*t(.25))) * rng.uniform(.3,1,n)
save('glitch', g * env(n, 20, 6), .4)
# tick
n = int(SR*.03); save('tick', np.sin(2*np.pi*2600*t(.03))*env(n,2,90), .35)
print('sfx ok')
