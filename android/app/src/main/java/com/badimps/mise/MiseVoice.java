package com.badimps.mise;

import android.content.Context;
import android.os.Bundle;
import android.os.Handler;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;

import java.util.Locale;
import java.util.Set;

/**
 * System text-to-speech for the automated voice guide. Picks the best
 * installed English voice once — quality rating first, then local-over-network
 * and lower latency — and speaks with Mise's guide pacing (0.92 rate).
 * Replies over a callback so the web layer can chain "speak, then listen"
 * without polling. Everything runs on the main thread; the recognizer lives
 * across utterances, the speech engine is engine-shared.
 */
final class MiseVoice {

    interface Reply {
        void onDone();

        void onError(String code);
    }

    private static final String TAG = "MiseVoice";
    private static final String UTTERANCE_ID = "mise-guide";
    private static final float SPEECH_RATE = 0.92f;

    private final Context context;
    private final Handler main;
    private final Reply reply;

    private TextToSpeech tts;
    private boolean ready;
    private String pendingText;
    /** Which named persona the web layer asked for: "carol" (female) or "sean" (male). */
    private String persona = "carol";

    MiseVoice(Context context, Handler main, Reply reply) {
        this.context = context;
        this.main = main;
        this.reply = reply;
    }

    /** Speak one utterance, flushing whatever is playing. Safe from any thread. */
    void speak(String text) {
        main.post(() -> speakInternal(text));
    }

    /** Stop and drop the current utterance. Safe from any thread. */
    void stop() {
        main.post(this::stopInternal);
    }

    /** Switch persona ("carol"/"sean"); re-picks the best matching installed English voice. */
    void setPersona(String personaName) {
        main.post(() -> {
            persona = "sean".equalsIgnoreCase(personaName) ? "sean" : "carol";
            if (ready) applyVoice();
        });
    }

    /** Release the engine. Safe from any thread. */
    void shutdown() {
        main.post(() -> {
            stopInternal();
            if (tts != null) {
                tts.shutdown();
                tts = null;
                ready = false;
            }
        });
    }

    private void ensureInit() {
        if (tts != null) return;
        tts = new TextToSpeech(context, status -> {
            if (status != TextToSpeech.SUCCESS) {
                Log.w(TAG, "TextToSpeech engine failed to initialise (status " + status + ")");
                reply.onError("init");
                return;
            }
            ready = true;
            configure();
            String queued = pendingText;
            pendingText = null;
            if (queued != null) speakInternal(queued);
        });
    }

    private void configure() {
        tts.setLanguage(Locale.US);
        applyVoice();
        tts.setSpeechRate(SPEECH_RATE);
        tts.setPitch(1.0f);
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) { }

            @Override
            public void onDone(String utteranceId) {
                reply.onDone();
            }

            @Override
            public void onError(String utteranceId) {
                reply.onError("tts");
            }
        });
    }

    /** Pick and apply the persona's best installed English voice. */
    private void applyVoice() {
        Voice best = pickBestVoice("carol".equals(persona));
        if (best != null) {
            tts.setVoice(best);
            Log.i(TAG, "Voice selected: " + best.getName() + " for persona " + persona
                    + " (quality " + best.getQuality()
                    + (best.isNetworkConnectionRequired() ? ", network" : ", local") + ")");
        }
    }

    /**
     * Prefer very-high-quality English voices, then high/normal, favouring
     * local (works offline) and lower latency, with a US/GB accent preference.
     * Persona gender is honoured when the engine exposes one; otherwise the
     * best quality voice wins, which keeps speakers working on every device.
     */
    private Voice pickBestVoice(boolean wantFemale) {
        Set<Voice> voices = tts.getVoices();
        if (voices == null) return null;
        Voice best = null;
        int bestScore = Integer.MIN_VALUE;
        for (Voice voice : voices) {
            if (voice == null || voice.getLocale() == null) continue;
            if (!"en".equalsIgnoreCase(voice.getLocale().getLanguage())) continue;
            int quality = voice.getQuality();
            boolean network = voice.isNetworkConnectionRequired();
            int latency = voice.getLatency();
            int score = quality * 10;
            score += network ? 25 : 60;
            String country = voice.getLocale().getCountry();
            if ("US".equalsIgnoreCase(country)) score += 12;
            else if ("GB".equalsIgnoreCase(country)) score += 8;
            if (latency >= Voice.LATENCY_VERY_HIGH) score -= 40;
            else if (latency >= Voice.LATENCY_HIGH) score -= 15;
            // Persona: strong weight for a named female/male match so the two
            // presets differ. Unmarked voices sit in the middle.
            boolean female = voiceLooksFemale(voice.getName());
            boolean male = voiceLooksMale(voice.getName());
            if (wantFemale ? female : male) score += 1000;
            else if (!female && !male) score += 40;
            if (score > bestScore) {
                bestScore = score;
                best = voice;
            }
        }
        return best;
    }

    private static boolean voiceLooksFemale(String name) {
        if (name == null) return false;
        String n = name.toLowerCase(Locale.US);
        return n.contains("female") || n.endsWith("-f") || n.endsWith("_f") || n.contains(" tpf")
                || containsAny(n, "standard-c", "standard-e", "standard-f", "standard-h",
                        "wavenet-c", "wavenet-e", "wavenet-f", "wavenet-k", "wavenet-o",
                        "wavenet-q", "wavenet-t", "wavenet-u", "wavenet-v", "wavenet-w",
                        "neural2-c", "neural2-e", "neural2-f", "neural2-i", "neural2-j", "neural2-o");
    }

    private static boolean voiceLooksMale(String name) {
        if (name == null) return false;
        String n = name.toLowerCase(Locale.US);
        return n.contains("male") && !n.contains("female") || n.endsWith("-m") || n.contains(" tpc")
                || containsAny(n, "standard-a", "standard-b", "standard-d", "standard-j",
                        "wavenet-a", "wavenet-b", "wavenet-d", "wavenet-i", "wavenet-j",
                        "neural2-a", "neural2-d", "neural2-g", "neural2-j");
    }

    private static boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) return true;
        }
        return false;
    }

    private void speakInternal(String text) {
        if (!ready) {
            pendingText = text;
            ensureInit();
            return;
        }
        tts.stop();
        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, UTTERANCE_ID);
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, UTTERANCE_ID);
        if (result == TextToSpeech.ERROR) reply.onError("speak");
    }

    private void stopInternal() {
        pendingText = null;
        if (tts != null) tts.stop();
    }
}
