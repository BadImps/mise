# Mise / render the pre-baked voice phrases.
# The fixed strings the automated voice guide speaks ("Step 1"–"Step 40" and
# the two one-off confirmations) are synthesized once here with Kokoro-82M
# (Apache-2.0, hexgrad/Kokoro-82M), voice `af_heart`, speed 0.92, American
# English. Step text between those fixed lines speaks through the device
# text-to-speech engine at runtime. Run from the repository root:
#
#   <python> tools/render-voice-clips.py [outdir]
#
# Defaults to assets/voice/. Requires: kokoro, soundfile, and the spaCy
# English model (en_core_web_sm). Audio never leaves this machine.
import os
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join("assets", "voice")
os.makedirs(OUT, exist_ok=True)

from kokoro import KPipeline
import soundfile as sf
import numpy as np

pipe = KPipeline(lang_code="a")

CLIPS = [(f"step-{n}.wav", f"Step {n}") for n in range(1, 41)]
CLIPS.append(("no-previous-step.wav", "There is no previous step."))
CLIPS.append(("cook-cancelled.wav", "Cook cancelled."))

for filename, text in CLIPS:
    audio = None
    for result in pipe(text, voice="af_heart", speed=0.92):
        audio = result.audio if audio is None else np.concatenate([audio, result.audio])
    sf.write(os.path.join(OUT, filename), audio, 24000)
    print(filename, "written")
print("done", len(CLIPS), "clips")
