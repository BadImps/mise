package com.badimps.mise;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Receives notification media-action taps while cooking is in progress and
 * forwards them into the web layer as window.__miseMediaAction({action: ...}).
 * The app's hash route keeps state; the web layer decides what each action means.
 */
public final class CookMediaReceiver extends BroadcastReceiver {

    static final String EXTRA_ACTION = "mise.media-action";
    static final String ACTION_PREV = "prev";
    static final String ACTION_NEXT = "next";
    static final String ACTION_PAUSE_RESUME = "pause-resume";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra(EXTRA_ACTION);
        if (action == null) return;
        MainActivity handler = MainActivity.mediaHandler;
        if (handler != null) handler.pushMediaAction(action);
    }
}
