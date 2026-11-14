package com.badimps.mise;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Bundle;
import android.os.Handler;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;

import java.util.ArrayList;
import java.util.List;
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
    /** Which engine to bind: "auto" | "samsung" | "google" | "system" (device default). */
    private String engine = "auto";
    /** Guards against an infinite fallback loop when a requested engine fails to boot. */
    private boolean fallbackUsed;
    /** Per-persona voice-name override, set by the user in Settings; null = auto pick. */
    private String overrideCarol;
    private String overrideSean;

    MiseVoice(Context context, Handler main, Reply reply) {
        this.context = context;
        this.main = main;
        this.reply = reply;
        main.post(this::ensureInit); // bind at boot so Settings can list voices
    }

    /** A TTS engine reported by the device (or "system" for the user's configured default). */
    static final class EngineInfo {
        final String id;
        final String label;
        final String packageName;

        EngineInfo(String id, String label, String packageName) {
            this.id = id;
            this.label = label;
            this.packageName = packageName;
        }
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

    /**
     * Pin one persona to an exact installed voice name (from listVoices()), or
     * clear it back to auto picking by passing null/empty. Safe from any thread.
     */
    void setPersonaVoice(String personaName, String voiceName) {
        main.post(() -> {
            boolean sean = "sean".equalsIgnoreCase(personaName);
            if (voiceName == null || voiceName.trim().isEmpty()) {
                if (sean) overrideSean = null; else overrideCarol = null;
            } else {
                if (sean) overrideSean = voiceName.trim(); else overrideCarol = voiceName.trim();
            }
            if (ready) applyVoice();
        });
    }

    /** Name of the voice currently carrying persona utterances, or "auto". */
    String currentPersonaVoice() {
        String active = (tts == null || !ready) ? null : voiceNameOf(tts);
        if (active != null && !active.isEmpty()) return active;
        String override = "sean".equals(persona) ? overrideSean : overrideCarol;
        return override == null || override.isEmpty() ? "auto" : override;
    }

    private String voiceNameOf(TextToSpeech engine) {
        try {
            Voice voice = engine.getVoice();
            return voice != null ? voice.getName() : null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    /** JSON list of the voices the bound engine exposes (English first, then the rest). */
    String listVoicesJson() {
        org.json.JSONArray array = new org.json.JSONArray();
        try {
            if (tts == null || !ready) ensureInit();
            if (tts == null) return array.toString();
            Set<Voice> voices = tts.getVoices();
            if (voices == null) return array.toString();
            List<Voice> ordered = new ArrayList<>(voices);
            ordered.sort((a, b) -> {
                boolean aEn = a != null && a.getLocale() != null && a.getLocale().getLanguage() != null
                        && a.getLocale().getLanguage().toLowerCase(Locale.US).startsWith("en");
                boolean bEn = b != null && b.getLocale() != null && b.getLocale().getLanguage() != null
                        && b.getLocale().getLanguage().toLowerCase(Locale.US).startsWith("en");
                return Boolean.compare(!aEn, !bEn);
            });
            for (Voice voice : ordered) {
                if (voice == null) continue;
                String name = voice.getName();
                if (name == null) name = "";
                String locale = voice.getLocale() == null ? "" : voice.getLocale().toString();
                boolean female = voiceLooksFemale(name);
                boolean male = voiceLooksMale(name);
                String guess = female ? "f" : male ? "m" : null;
                try {
                    org.json.JSONObject item = new org.json.JSONObject();
                    item.put("name", name);
                    item.put("locale", locale);
                    item.put("quality", voice.getQuality());
                    item.put("local", !voice.isNetworkConnectionRequired());
                    if (guess != null) item.put("guess", guess);
                    array.put(item);
                } catch (org.json.JSONException ignored) { }
            }
        } catch (Throwable ignored) { }
        return array.toString();
    }

    /**
     * Switch speech engine: "auto" (Samsung if installed, else Google, else the
     * system default), "samsung", "google", or "system". Rebuilds the binding and
     * re-picks the persona voice inside the new engine. Falls back to the system
     * default if the requested engine fails to initialise.
     */
    void setEngine(String engineName) {
        main.post(() -> {
            String next = "auto".equals(engineName) || "samsung".equals(engineName)
                    || "google".equals(engineName) ? engineName : "system";
            if (next.equals(engine) && tts != null) return;
            engine = next;
            fallbackUsed = false;
            rebuildEngine();
        });
    }

    /** Engines installed on this device, plus the "system" pseudo-engine. */
    List<EngineInfo> installedEngines() {
        List<EngineInfo> engines = new ArrayList<>();
        try {
            Intent probe = new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE);
            List<ResolveInfo> infos = context.getPackageManager()
                    .queryIntentServices(probe, PackageManager.GET_META_DATA);
            if (infos != null) {
                for (ResolveInfo info : infos) {
                    String packageName = info.serviceInfo != null ? info.serviceInfo.packageName : null;
                    if (packageName == null || packageName.isEmpty()) continue;
                    String id = idForPackage(packageName);
                    String label = String.valueOf(context.getPackageManager()
                            .getApplicationLabel(applicationInfo(packageName))).trim();
                    if (label.isEmpty()) label = packageName;
                    engines.add(new EngineInfo(id, label, packageName));
                }
            }
        } catch (Throwable ignored) { }
        engines.add(new EngineInfo("system", "System default", null));
        return engines;
    }

    private android.content.pm.ApplicationInfo applicationInfo(String packageName) {
        try {
            return context.getPackageManager().getApplicationInfo(packageName, 0);
        } catch (PackageManager.NameNotFoundException e) {
            return new android.content.pm.ApplicationInfo();
        }
    }

    private static String idForPackage(String packageName) {
        String lower = packageName.toLowerCase(Locale.US);
        if (lower.contains("samsung")) return "samsung";
        if (lower.contains("google.android.tts") || lower.contains("google")) return "google";
        return "custom:" + lower;
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
        String packageName = resolveEnginePackage();
        fallbackUsed = false;
        tts = (packageName != null)
                ? new TextToSpeech(context, newEngineListener(), packageName)
                : new TextToSpeech(context, newEngineListener());
    }

    /** Re-create the engine binding with the current preference (used by setEngine). */
    private void rebuildEngine() {
        stopInternal();
        if (tts != null) {
            try {
                tts.shutdown();
            } catch (Throwable ignored) { }
            tts = null;
            ready = false;
        }
        ensureInit();
    }

    /** Resolve the engine preference to a package, or null for the device default. */
    private String resolveEnginePackage() {
        List<EngineInfo> engines = installedEngines();
        if ("system".equals(engine)) return null;
        if ("auto".equals(engine)) {
            // Samsung first when present, then Google, then the device default.
            String samsung = findPackage(engines, "samsung");
            if (samsung != null) return samsung;
            String google = findPackage(engines, "google");
            return google; // may be null -> system default
        }
        return findPackage(engines, engine);
    }

    private static String findPackage(List<EngineInfo> engines, String id) {
        for (EngineInfo info : engines) {
            if (id.equals(info.id)) return info.packageName;
        }
        return null;
    }

    private TextToSpeech.OnInitListener newEngineListener() {
        return status -> {
            if (status != TextToSpeech.SUCCESS) {
                Log.w(TAG, "TextToSpeech engine (" + engine + ") failed to initialise (status " + status + ")");
                if (!fallbackUsed && !"system".equals(engine)) {
                    fallbackUsed = true;
                    if (tts != null) {
                        try {
                            tts.shutdown();
                        } catch (Throwable ignored) { }
                        tts = null;
                        ready = false;
                    }
                    engine = "system";
                    tts = new TextToSpeech(context, newEngineListener());
                    return;
                }
                reply.onError("init");
                return;
            }
            ready = true;
            configure();
            String queued = pendingText;
            pendingText = null;
            if (queued != null) speakInternal(queued);
        };
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

    /** Pick and apply the persona's voice: the user's override wins, else best match. */
    private void applyVoice() {
        String override = "sean".equals(persona) ? overrideSean : overrideCarol;
        Voice best = (override != null && !override.isEmpty()) ? findVoiceByName(override) : null;
        if (best == null) {
            best = pickBestVoice("carol".equals(persona));
        }
        if (best != null) {
            tts.setVoice(best);
            Log.i(TAG, "Voice selected: " + best.getName() + " for persona " + persona
                    + " (quality " + best.getQuality()
                    + (best.isNetworkConnectionRequired() ? ", network" : ", local") + ")");
        }
    }

    private Voice findVoiceByName(String name) {
        try {
            Set<Voice> voices = tts.getVoices();
            if (voices == null) return null;
            for (Voice voice : voices) {
                if (voice != null && name.equalsIgnoreCase(voice.getName())) return voice;
            }
        } catch (Throwable ignored) { }
        return null;
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
