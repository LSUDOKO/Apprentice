import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
K = '/home/arpit/.local/share/kokoro/'
k = Kokoro(K + 'kokoro-v1.0.onnx', K + 'voices-v1.0.bin')
voice = sys.argv[1]; out = sys.argv[2]; only = sys.argv[3:] 
lines = json.load(open('capture/vo.json'))
for id_, text in lines:
    if only and id_ not in only: continue
    samples, sr = k.create(text.replace('Apprentice', 'Apprentice'), voice=voice, speed=0.95, lang='en-us')
    sf.write(f'{out}/{id_}.wav', samples, sr)
    print(id_, round(len(samples) / sr, 2), flush=True)
