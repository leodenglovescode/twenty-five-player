"""Generate the project's original short musical sketches. Standard library only."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
SECONDS = 16
ROOT = Path(__file__).resolve().parent / 'audio'
ROOT.mkdir(exist_ok=True)
TRACKS = [
    ('first-light', [60, 64, 67, 71, 67, 64, 62, 67], [48, 45, 53, 55], 112),
    ('pocket-orbit', [69, 72, 76, 79, 76, 72, 67, 72], [45, 53, 48, 55], 124),
    ('long-way-home', [67, 71, 74, 78, 74, 71, 69, 66], [43, 47, 40, 45], 96),
]

def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def render(slug, melody, bass, bpm):
    beat = 60 / bpm
    frames = bytearray()
    for n in range(RATE * SECONDS):
        t = n / RATE
        note_time = t % (beat / 2)
        note = melody[int(t / (beat / 2)) % len(melody)]
        f = hz(note)
        env = min(1, note_time / .008) * math.exp(-note_time * 8)
        lead = (math.sin(2 * math.pi * f * t) + .2 * math.sin(2 * math.pi * f * 2 * t)) * env * .18
        low = hz(bass[int(t / (beat * 4)) % len(bass)])
        bass_env = min(1, (t % beat) / .015) * math.exp(-(t % beat) * 3)
        foundation = math.sin(2 * math.pi * low * t) * bass_env * .16
        phase = t % beat
        kick = math.sin(2 * math.pi * (47 * phase + 4 * (1 - math.exp(-phase * 30)))) * math.exp(-phase * 24) * .2
        fade = min(1, t / .15, max(0, (SECONDS - t) / 1.2))
        sample = max(-1, min(1, (lead + foundation + kick) * fade))
        frames.extend(struct.pack('<h', int(sample * 32767)))
    with wave.open(str(ROOT / f'{slug}.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(frames)

if __name__ == '__main__':
    for args in TRACKS:
        render(*args)
