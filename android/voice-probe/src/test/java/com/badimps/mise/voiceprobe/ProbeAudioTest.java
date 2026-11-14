package com.badimps.mise.voiceprobe;

import org.junit.Test;
import static org.junit.Assert.*;

public class ProbeAudioTest {
    @Test public void promptThenExactlyOneSecondOfSilenceThenFullStep() {
        float[] result = ProbeAudio.join(new float[]{0.5f, -0.5f}, new float[]{0.2f, 0.3f}, 24000);
        assertEquals(24004, result.length);
        assertEquals(0.5f, result[0], 0);
        assertEquals(-0.5f, result[1], 0);
        for (int i = 2; i < 24002; i++) assertEquals(0f, result[i], 0);
        assertEquals(0.2f, result[24002], 0);
        assertEquals(0.3f, result[24003], 0);
    }

    @Test public void invalidOrSilentOutputIsNotSuccess() {
        for (float[] samples : new float[][]{{}, {0, 0}, {Float.NaN}, {Float.POSITIVE_INFINITY}}) {
            assertThrows(IllegalArgumentException.class, () -> ProbeAudio.validate(samples, 24000));
        }
        assertThrows(IllegalArgumentException.class, () -> ProbeAudio.validate(new float[]{0.1f}, 0));
        ProbeAudio.validate(new float[]{0, -0.2f, 0.2f}, 24000);
    }

    @Test public void onlyPinnedPersonaIdsAreAccepted() {
        assertEquals(3, ProbeAudio.speaker("carol"));
        assertEquals(16, ProbeAudio.speaker("sean"));
        assertThrows(IllegalArgumentException.class, () -> ProbeAudio.speaker("unknown"));
    }
}
