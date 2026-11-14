package com.badimps.mise.voiceprobe;

import android.app.Activity;
import android.app.Instrumentation;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.os.Debug;
import android.os.SystemClock;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Developer-only, separate APK: run using adb am instrument (see docs/voice-prototype.md). */
public final class VoiceProbe extends Instrumentation {
    private Bundle arguments;
    private static final float SPEED = 0.92f;

    @Override public void onCreate(Bundle args) {
        super.onCreate(args);
        arguments = args == null ? new Bundle() : new Bundle(args);
        start();
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        OfflineTts tts = null;
        try {
            File base = getTargetContext().getExternalFilesDir(null);
            if (base == null) throw new IllegalStateException("App storage unavailable");
            if ("true".equals(arguments.getString("prepare"))) {
                result.putString("storage", base.getAbsolutePath());
                finish(Activity.RESULT_OK, result);
                return;
            }
            String persona = arguments.getString("persona", "both");
            String[] personas = "both".equals(persona) ? new String[]{"carol", "sean"} : new String[]{persona};
            for (String name : personas) ProbeAudio.speaker(name);
            // A diagnostic sample, not an edit to publisher recipe content.
            String text = arguments.getString("text", "Whisk the flour and milk until smooth. Add the eggs and stir gently.");
            if (text.trim().isEmpty() || text.length() > 2000) {
                throw new IllegalArgumentException("Step text must contain 1–2000 characters");
            }
            File model = new File(base, "kokoro-multi-lang-v1_0");
            for (String name : new String[]{"model.onnx", "voices.bin", "tokens.txt", "lexicon-us-en.txt", "espeak-ng-data/en_dict"}) {
                if (!new File(model, name).isFile()) throw new IllegalStateException("Missing model file: " + name);
            }
            OfflineTtsKokoroModelConfig kokoro = new OfflineTtsKokoroModelConfig();
            kokoro.setModel(new File(model, "model.onnx").getPath());
            kokoro.setVoices(new File(model, "voices.bin").getPath());
            kokoro.setTokens(new File(model, "tokens.txt").getPath());
            kokoro.setLexicon(new File(model, "lexicon-us-en.txt").getPath());
            kokoro.setDataDir(new File(model, "espeak-ng-data").getPath());
            kokoro.setLang("en-us");
            OfflineTtsModelConfig modelConfig = new OfflineTtsModelConfig();
            modelConfig.setKokoro(kokoro);
            modelConfig.setNumThreads(2);
            OfflineTtsConfig config = new OfflineTtsConfig();
            config.setModel(modelConfig);
            progress("Loading Kokoro model");
            long started = SystemClock.elapsedRealtime();
            tts = new OfflineTts(null, config);
            long initMs = SystemClock.elapsedRealtime() - started;
            progress("Model initialized in " + initMs + " ms");
            if (tts.numSpeakers() != 54) throw new IllegalStateException("Wrong model: expected 54 speakers, got " + tts.numSpeakers());
            File output = new File(base, "results");
            Files.createDirectories(output.toPath());
            JSONArray voices = new JSONArray();
            for (String name : personas) {
                int speaker = ProbeAudio.speaker(name);
                // Pre-render only the fixed phrase. The step is synthesized independently below.
                progress(name + ": generating fixed prompt");
                started = SystemClock.elapsedRealtime();
                GeneratedAudio prompt = tts.generate("Step 1", speaker, SPEED);
                long promptMs = SystemClock.elapsedRealtime() - started;
                save(prompt, new File(output, name + "-prompt.wav"));
                progress(name + ": generating fresh step");
                started = SystemClock.elapsedRealtime();
                GeneratedAudio step = tts.generate(text, speaker, SPEED);
                long stepMs = SystemClock.elapsedRealtime() - started;
                progress(name + ": step synthesized in " + stepMs + " ms");
                save(step, new File(output, name + "-step.wav"));
                if (prompt.getSampleRate() != step.getSampleRate()) throw new IllegalStateException("Sample rate changed");
                GeneratedAudio combined = new GeneratedAudio(
                        ProbeAudio.join(prompt.getSamples(), step.getSamples(), step.getSampleRate()), step.getSampleRate());
                File comparison = new File(output, name + "-comparison.wav");
                save(combined, comparison);
                Debug.MemoryInfo memory = new Debug.MemoryInfo();
                Debug.getMemoryInfo(memory);
                double duration = (double) step.getSamples().length / step.getSampleRate();
                JSONObject metrics = new JSONObject();
                metrics.put("persona", name);
                metrics.put("voice", speaker == 3 ? "af_heart" : "am_michael");
                metrics.put("speakerId", speaker);
                metrics.put("promptSynthesisMs", promptMs);
                metrics.put("stepSynthesisMs", stepMs);
                metrics.put("stepAudioSeconds", duration);
                metrics.put("realTimeFactor", stepMs / 1000.0 / duration);
                metrics.put("pssSnapshotKiB", memory.getTotalPss());
                metrics.put("sampleRate", step.getSampleRate());
                voices.put(metrics);
                if ("true".equals(arguments.getString("play"))) {
                    progress(name + ": playing comparison");
                    play(comparison, combined);
                }
            }
            JSONObject report = new JSONObject();
            report.put("model", "kokoro-multi-lang-v1_0");
            report.put("runtime", "sherpa-onnx-1.13.8");
            report.put("initMs", initMs);
            report.put("text", text);
            report.put("speed", SPEED);
            report.put("threads", 2);
            report.put("voices", voices);
            Files.write(new File(output, "report.json").toPath(), report.toString(2).getBytes(StandardCharsets.UTF_8));
            result.putString("report", report.toString());
            result.putString("output", output.getAbsolutePath());
            result.putString("status", "PASS");
        } catch (Exception | LinkageError error) {
            result.putString("status", "FAIL");
            result.putString("error", error.toString());
        } finally {
            if (tts != null) tts.release();
        }
        finish("PASS".equals(result.getString("status")) ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
    }

    private void progress(String phase) {
        Bundle status = new Bundle();
        status.putString("phase", phase);
        sendStatus(1, status);
    }

    private static void save(GeneratedAudio audio, File file) {
        ProbeAudio.validate(audio.getSamples(), audio.getSampleRate());
        if (!audio.save(file.getAbsolutePath())) throw new IllegalStateException("Could not save " + file);
    }

    private static void play(File file, GeneratedAudio audio) throws Exception {
        MediaPlayer player = new MediaPlayer();
        CountDownLatch ended = new CountDownLatch(1);
        AtomicBoolean failed = new AtomicBoolean();
        try {
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            player.setDataSource(file.getAbsolutePath());
            player.setOnCompletionListener(ignored -> ended.countDown());
            player.setOnErrorListener((ignored, what, extra) -> {
                failed.set(true);
                ended.countDown();
                return true;
            });
            player.prepare();
            player.start();
            long timeout = 15 + audio.getSamples().length / audio.getSampleRate();
            if (!ended.await(timeout, TimeUnit.SECONDS) || failed.get()) {
                throw new IllegalStateException("Audio playback failed or timed out");
            }
        } finally { player.release(); }
    }
}
