package com.badimps.mise;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import java.util.List;

/**
 * One-utterance speech recognizer for the automated voice guide. The guide
 * arms a single utterance, the recognizer reports it, and the web layer
 * re-arms for the next turn — hands-free loops with a stock system service.
 * All lifecycle calls hop onto the main thread; SpeechRecognizer requires it.
 */
final class MiseSpeech {

    interface Reply {
        void onResult(String text);

        void onError(String code);
    }

    private static final String TAG = "MiseSpeech";

    private final Context context;
    private final Handler main;
    private final Reply reply;
    private SpeechRecognizer recognizer;

    MiseSpeech(Context context, Handler main, Reply reply) {
        this.context = context;
        this.main = main;
        this.reply = reply;
    }

    /** Arm a single utterance. Safe to call from any thread. */
    void start() {
        main.post(this::startListening);
    }

    /** Stop listening and release the mic. Safe to call from any thread. */
    void stop() {
        main.post(this::cancelInternal);
    }

    private void startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            reply.onError("unavailable");
            return;
        }
        cancelInternal();
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 900L);

        SpeechRecognizer fresh = SpeechRecognizer.createSpeechRecognizer(context);
        fresh.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) { }

            @Override
            public void onBeginningOfSpeech() { }

            @Override
            public void onRmsChanged(float rmsdB) { }

            @Override
            public void onBufferReceived(byte[] buffer) { }

            @Override
            public void onEndOfSpeech() { }

            @Override
            public void onPartialResults(Bundle partialResults) { }

            @Override
            public void onEvent(int eventType, Bundle params) { }

            @Override
            public void onResults(Bundle results) {
                List<String> matches = results == null ? null
                        : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = matches == null || matches.isEmpty() ? "" : matches.get(0);
                reply.onResult(text == null ? "" : text);
                cancelInternal();
            }

            @Override
            public void onError(int error) {
                reply.onError(codeFor(error));
                cancelInternal();
            }
        });
        try {
            fresh.startListening(intent);
            recognizer = fresh;
        } catch (RuntimeException e) {
            Log.w(TAG, "Could not start listening", e);
            reply.onError("denied");
            try {
                fresh.destroy();
            } catch (Throwable ignored) { }
        }
    }

    private void cancelInternal() {
        SpeechRecognizer current = recognizer;
        recognizer = null;
        if (current != null) {
            try {
                current.cancel();
            } catch (Throwable ignored) { }
            try {
                current.destroy();
            } catch (Throwable ignored) { }
        }
    }

    private static String codeFor(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH: return "no-match";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "no-speech";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "busy";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "denied";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network";
            case SpeechRecognizer.ERROR_CLIENT: return "client";
            case SpeechRecognizer.ERROR_AUDIO: return "audio";
            case SpeechRecognizer.ERROR_SERVER: return "server";
            default: return "code-" + error;
        }
    }
}
