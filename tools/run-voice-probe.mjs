// Usage: node tools/run-voice-probe.mjs SERIAL [carol|sean|both] ["fresh step text"]
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const [serial, persona = 'both', text] = process.argv.slice(2);
if (!serial || !/^[\w.:-]+$/.test(serial) || !['carol', 'sean', 'both'].includes(persona)) {
  throw new Error('Usage: node tools/run-voice-probe.mjs SERIAL [carol|sean|both] ["fresh step text"]');
}
if (text !== undefined && (!text.trim() || text.length > 2000 || /[\r\n\0]/.test(text))) {
  throw new Error('Step text must be one line of 1–2000 characters');
}
const root = fileURLToPath(new URL('../', import.meta.url));
const adb = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const executable = adb ? join(adb, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb';
const apk = join(root, 'android/voice-probe/build/outputs/apk/debug/voice-probe-debug.apk');
const model = join(root, 'dist/voice-probe/kokoro-multi-lang-v1_0');
await access(apk);
await access(join(model, 'model.onnx'));
function run(args) {
  const result = spawnSync(executable, ['-s', serial, ...args], { encoding: 'utf8', timeout: 600_000 });
  if (result.stdout) console.log(result.stdout.trim());
  if (result.error || result.status !== 0) {
    if (result.error?.code === 'ETIMEDOUT' && args.includes('instrument')) {
      spawnSync(executable, ['-s', serial, 'shell', 'am', 'force-stop', 'com.badimps.mise.voiceprobe'], { timeout: 15_000 });
    }
    throw new Error(result.stderr || `adb failed: ${result.error || result.status}`);
  }
  return result.stdout;
}
// adb shell joins arguments into a remote shell command: quote user-provided text.
const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
const component = 'com.badimps.mise.voiceprobe/.VoiceProbe';
const deviceBase = '/sdcard/Android/data/com.badimps.mise.voiceprobe/files';
run(['install', '-r', apk]);
const prepared = run(['shell', 'am', 'instrument', '-w', '-e', 'prepare', 'true', component]);
if (!prepared.includes('INSTRUMENTATION_RESULT: storage=')) throw new Error('Storage preparation failed');
run(['push', '--sync', model, deviceBase + '/']);
const args = ['shell', 'am', 'instrument', '-w', '-e', 'persona', persona, '-e', 'play', 'true'];
if (text !== undefined) args.push('-e', 'text', quote(text));
args.push(component);
const output = run(args);
if (!/^INSTRUMENTATION_RESULT: status=PASS\r?$/m.test(output)) throw new Error('Voice probe failed');
const local = join(root, 'dist/voice-probe/results', serial.replaceAll(':', '_'));
await mkdir(local, { recursive: true });
run(['pull', deviceBase + '/results/.', local]);
const report = JSON.parse(await readFile(join(local, 'report.json'), 'utf8'));
if (report.voices.length !== (persona === 'both' ? 2 : 1)) throw new Error('Incomplete persona results');
console.log('Audio and measurements:', local);
