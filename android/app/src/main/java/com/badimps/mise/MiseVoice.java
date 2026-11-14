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
        Voice best = pickBestVoice();
        if (best != null) {
            tts.setVoice(best);
            Log.i(TAG, "Voice selected: " + best.getName()
                    + " (quality " + best.getQuality()
                    + (best.isNetworkConnectionRequired() ? ", network" : ", local") + ")");
        }
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

    /**
     * Prefer very-high-quality English voices, then high/normal, favouring
     * local (works offline) and lower latency, with a US/GB accent preference.
     */
    private Voice pickBestVoice() {
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
            if (score > bestScore) {
                bestScore = score;
                best = voice;
            }
        }
        return best;
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
