// Verify real Android-generated artifacts, including the full step tail and pause.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2];
assert(directory, 'Usage: node tools/verify-voice-probe.mjs RESULT_DIRECTORY');
async function wav(name) {
  const bytes = await readFile(join(directory, name));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let format;
  let data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    assert.equal(chunk.length, size, 'Truncated WAV chunk');
    if (id === 'fmt ') format = chunk;
    if (id === 'data') data = chunk;
    offset += 8 + size + (size % 2);
  }
  assert(format && data, 'Missing WAV format or data');
  assert.equal(format.readUInt16LE(0), 1, 'Expected PCM');
  assert.equal(format.readUInt16LE(2), 1, 'Expected mono');
  assert.equal(format.readUInt32LE(4), 24000);
  assert.equal(format.readUInt16LE(14), 16);
  assert(data.length > 0 && data.length % 2 === 0);
  assert(data.some(value => value !== 0), 'Silent WAV');
  return data;
}
const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
assert.equal(report.model, 'kokoro-multi-lang-v1_0');
assert.equal(report.runtime, 'sherpa-onnx-1.13.8');
assert(report.voices.length > 0);
const seen = new Set();
for (const voice of report.voices) {
  assert(['carol', 'sean'].includes(voice.persona));
  assert(!seen.has(voice.persona), 'Duplicate persona');
  seen.add(voice.persona);
  assert.equal(voice.speakerId, voice.persona === 'carol' ? 3 : 16);
  assert(voice.stepSynthesisMs > 0 && voice.pssSnapshotKiB > 0);
  const prompt = await wav(`${voice.persona}-prompt.wav`);
  const step = await wav(`${voice.persona}-step.wav`);
  const combined = await wav(`${voice.persona}-comparison.wav`);
  const gapBytes = 24000 * 2;
  assert.equal(combined.length, prompt.length + gapBytes + step.length);
  assert.deepEqual(combined.subarray(0, prompt.length), prompt);
  assert(combined.subarray(prompt.length, prompt.length + gapBytes).every(value => value === 0));
  assert.deepEqual(combined.subarray(prompt.length + gapBytes), step, 'Step truncated or changed');
  assert(Math.abs(voice.stepAudioSeconds - step.length / 48000) < 1 / 24000);
  console.log(`${voice.persona}: non-silent audio, exact one-second pause, full step verified`);
}
