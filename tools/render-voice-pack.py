# Render the dialogue clips for BOTH personas (Carol = af_heart, Sean = am_michael).
# Each is a full constant voice: the native engine speaks everything when a
# speech engine exists; on engineless devices the clips for the chosen persona
# keep the voice constant. Run from the repository root:
#
#   <python> tools/render-voice-pack.py [outdir]
#
# Requires: kokoro, soundfile, numpy, and the spaCy English model.
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join("assets", "voice")
os.makedirs(OUT, exist_ok=True)

from kokoro import KPipeline
import soundfile as sf
import numpy as np

PIPE = KPipeline(lang_code="a")
SPEED = 0.92
PHRASES = [(f"step-{n}.wav", f"Step {n}") for n in range(1, 41)] + [
    ("no-previous-step.wav", "There is no previous step."),
    ("cook-cancelled.wav", "Cook cancelled."),
]
PERSONAS = [("carol", "af_heart"), ("sean", "am_michael")]

for name, voice in PERSONAS:
    dest = os.path.join(OUT, name)
    os.makedirs(dest, exist_ok=True)
    for filename, text in PHRASES:
        audio = None
        for result in PIPE(text, voice=voice, speed=SPEED):
            audio = result.audio if audio is None else np.concatenate([audio, result.audio])
        sf.write(os.path.join(dest, filename), audio, 24000)
    print(f"{name:6} {len(PHRASES)} clips -> {dest}")
print("done")
