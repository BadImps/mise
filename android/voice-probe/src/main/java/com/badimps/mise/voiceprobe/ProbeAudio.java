package com.badimps.mise.voiceprobe;

/** Audio invariants shared by the native probe and its host-side tests. */
final class ProbeAudio {
    private ProbeAudio() {}

    static int speaker(String persona) {
        // IDs belong to the pinned kokoro-multi-lang-v1_0 pack (54 voices).
        if ("carol".equals(persona)) return 3;
        if ("sean".equals(persona)) return 16;
        throw new IllegalArgumentException("Persona must be carol or sean");
    }

    static void validate(float[] samples, int sampleRate) {
        if (samples == null || samples.length == 0 || sampleRate <= 0) {
            throw new IllegalArgumentException("No generated audio");
        }
        double energy = 0;
        for (float sample : samples) {
            if (!Float.isFinite(sample)) throw new IllegalArgumentException("Non-finite audio");
            energy += (double) sample * sample;
        }
        if (energy == 0) throw new IllegalArgumentException("Silent generated audio");
    }

    static float[] join(float[] prompt, float[] step, int sampleRate) {
        validate(prompt, sampleRate);
        validate(step, sampleRate);
        float[] joined = new float[Math.addExact(Math.addExact(prompt.length, sampleRate), step.length)];
        System.arraycopy(prompt, 0, joined, 0, prompt.length);
        System.arraycopy(step, 0, joined, prompt.length + sampleRate, step.length);
        return joined;
    }
}
