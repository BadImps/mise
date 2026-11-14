package com.badimps.mise;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.content.pm.PackageManager;
import android.app.PendingIntent;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

public final class MainActivity extends Activity {

    private static final String TAG = "Mise";
    private static final String START_URL = "https://" + WebContentStore.HOST + "/index.html";
    private static final int CHARCOAL = Color.rgb(23, 25, 27);
    private static final String COOK_CHANNEL_ID = "mise.cooking";
    private static final int COOK_NOTIFICATION_ID = 4271;
    private static final String EXTRA_DESTINATION = "mise.destination";
    private static final int REQUEST_POST_NOTIFICATIONS = 1001;
    private static final int REQUEST_RECORD_AUDIO = 1002;

    private FrameLayout root;
    private WebView webView;
    private View loading;
    private TextView loadingHint;
    private WebContentStore store;
    private UpdateManager updates;
    private UpdateManager.Manifest pendingUpdate;
    private BroadcastReceiver downloadReceiver;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean loadFailed;
    private String pendingDestination;
    private boolean pendingCook;
    private String pendingCookTitle;
    private String pendingCookText;
    private int pendingCookStep;
    private int pendingCookTotal;
    private boolean pendingSpeech;
    private MiseSpeech miseSpeech;
    private MiseVoice miseVoice;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        // The decor view must exist before getInsetsController() is queried.
        configureWindow();
        ensureCookChannel();
        pendingDestination = destinationFrom(getIntent());
        miseSpeech = new MiseSpeech(this, handler, new MiseSpeech.Reply() {
            @Override
            public void onResult(String text) {
                org.json.JSONObject json = new org.json.JSONObject();
                try {
                    json.put("text", text == null ? "" : text);
                } catch (org.json.JSONException ignored) { }
                emitJavascript("__miseSpeechResult", json);
            }

            @Override
            public void onError(String code) {
                org.json.JSONObject json = new org.json.JSONObject();
                try {
                    json.put("code", code == null ? "error" : code);
                } catch (org.json.JSONException ignored) { }
                emitJavascript("__miseSpeechError", json);
            }
        });
        miseVoice = new MiseVoice(this, handler, new MiseVoice.Reply() {
            @Override
            public void onDone() {
                emitJavascript("__miseSpeechDone", new org.json.JSONObject());
            }

            @Override
            public void onError(String code) {
                org.json.JSONObject json = new org.json.JSONObject();
                try {
                    json.put("code", code == null ? "error" : code);
                } catch (org.json.JSONException ignored) { }
                emitJavascript("__miseSpeechDone", json); // guide must never wedge
            }
        });

        root = findViewById(R.id.root);
        webView = findViewById(R.id.webview);
        loading = findViewById(R.id.loading);
        loadingHint = findViewById(R.id.loading_hint);

        applyInsets();
        store = new WebContentStore(this);
        setupWebView();
        registerBackCallback();

        loading.setOnClickListener(view -> {
            if (loadFailed) {
                loadFailed = false;
                loadingHint.setText(R.string.loading_hint);
                loadStart();
            }
        });

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            loadStart();
        } else {
            loading.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
        }

        updates = new UpdateManager(this, store);
        registerDownloadReceiver();
        handler.postDelayed(this::checkForUpdates, 1800);
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(CHARCOAL);
        window.setNavigationBarColor(CHARCOAL);
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(0,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        }
    }

    private void applyInsets() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return insets;
            });
            root.requestApplyInsets();
        } else {
            root.setFitsSystemWindows(true);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString()
                + " MiseAndroid/" + BuildConfig.VERSION_NAME);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }

        webView.addJavascriptInterface(new MiseBridge(), "MiseNative");
        webView.setBackgroundColor(CHARCOAL);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null && WebContentStore.HOST.equals(url.getHost())
                        && "GET".equalsIgnoreCase(request.getMethod())) {
                    return store.open(url);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null && WebContentStore.HOST.equals(url.getHost())) return false;
                openExternally(url);
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri parsed = Uri.parse(url);
                if (parsed.getHost() != null && WebContentStore.HOST.equals(parsed.getHost())) return false;
                openExternally(parsed);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (url == null || !url.startsWith("https://" + WebContentStore.HOST + "/")) return;
                loadFailed = false;
                // The WebView composites behind the opaque loading panel, so the
                // first revealed frame already has the rendered recipe view.
                revealWhenRendered(0);
                String dest = pendingDestination;
                if (dest != null && webView != null) {
                    pendingDestination = null;
                    handler.postDelayed(() -> navigateWebView(dest), 250);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showLoadError(error == null ? "Unknown error" : String.valueOf(error.getDescription()));
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (failingUrl != null && failingUrl.startsWith("https://" + WebContentStore.HOST)) {
                    showLoadError(description);
                }
            }
        });

        webView.loadUrl("about:blank");
    }

    /** Creates the low-importance channel used by the ongoing cooking notification. */
    private void ensureCookChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(COOK_CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
                COOK_CHANNEL_ID,
                "Cooking in progress",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Ongoing notification while a cook is active: the recipe and the step you are on.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private String destinationFrom(Intent intent) {
        // Only the in-app deep link Mise itself puts on the notification is honoured.
        String dest = intent != null ? intent.getStringExtra(EXTRA_DESTINATION) : null;
        return "#/cook".equals(dest) ? dest : null;
    }

    private void navigateWebView(String hash) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "(function(){ try { location.hash = '" + hash + "'; } catch (e) {} })()",
                null);
    }

    private void showCookNotification(String title, int step, int total, String stepText) {
        if (isFinishing() || isDestroyed()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            pendingCook = true;
            pendingCookTitle = title;
            pendingCookStep = step;
            pendingCookTotal = total;
            pendingCookText = stepText;
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, REQUEST_POST_NOTIFICATIONS);
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        ensureCookChannel();

        Intent intent = new Intent(this, MainActivity.class);
        // The activity is singleTop: an existing instance gets onNewIntent, a cold
        // start routes the deep link through onCreate → onPageFinished instead.
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_DESTINATION, "#/cook");
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String safeTitle = title == null || title.trim().isEmpty() ? "Mise" : title.trim();
        String big = stepText == null ? "" : stepText.trim();
        String progress = "Step " + step + " of " + total;
        Notification.Builder builder = new Notification.Builder(this, COOK_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_pot)
                .setContentTitle("Cooking · " + safeTitle)
                .setContentText(progress)
                .setCategory(Notification.CATEGORY_STATUS)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentIntent);
        if (!big.isEmpty()) {
            builder.setStyle(new Notification.BigTextStyle()
                    .bigText(progress + " — " + big)
                    .setBigContentTitle("Cooking · " + safeTitle));
        }
        manager.notify(COOK_NOTIFICATION_ID, builder.build());
    }

    private void cancelCookNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(COOK_NOTIFICATION_ID);
    }

    /** Delivers a bridge event object to the web layer as window.<name>(payload). */
    private void emitJavascript(final String functionName, final org.json.JSONObject payload) {
        handler.post(() -> {
            if (webView == null) return;
            final String argument = payload.toString();
            webView.evaluateJavascript(
                    "window." + functionName + " && window." + functionName + "(" + argument + ")", null);
        });
    }

    /** Starts a one-utterance speech recognizer turn; the web layer re-arms. */
    private void startSpeechRecognition() {
        if (isFinishing() || isDestroyed()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingSpeech = true;
            requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
            return;
        }
        if (miseSpeech != null) miseSpeech.start();
    }

    private void stopSpeechRecognition() {
        pendingSpeech = false;
        if (miseSpeech != null) miseSpeech.stop();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_POST_NOTIFICATIONS
                && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                && pendingCook) {
            showCookNotification(pendingCookTitle, pendingCookStep, pendingCookTotal, pendingCookText);
        }
        pendingCook = false;
        if (requestCode == REQUEST_RECORD_AUDIO) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted && pendingSpeech && miseSpeech != null) {
                miseSpeech.start();
            } else if (!granted) {
                org.json.JSONObject json = new org.json.JSONObject();
                try {
                    json.put("code", "denied");
                } catch (org.json.JSONException ignored) { }
                emitJavascript("__miseSpeechError", json);
            }
        }
        pendingSpeech = false;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String dest = destinationFrom(intent);
        if (dest == null) return;
        if (loadFailed) {
            pendingDestination = dest;
            loadStart();
            return;
        }
        navigateWebView(dest);
    }

    private void loadStart() {
        loadFailed = false;
        loading.setVisibility(View.VISIBLE);
        if (store != null) {
            Log.d(TAG, "Loading web content version " + store.getActiveVersion());
        }
        webView.loadUrl(START_URL);
    }

    private void revealWhenRendered(int attempt) {
        if (loadFailed || isFinishing() || isDestroyed() || webView == null) return;
        webView.evaluateJavascript(
                "(function(){var v=document.getElementById('view');"
                        + "return !!(v && v.children.length > 0 && document.readyState !== 'loading');})()",
                value -> {
                    if ("true".equals(value)) {
                        handler.postDelayed(this::revealContent, 120);
                    } else if (attempt < 30) {
                        handler.postDelayed(() -> revealWhenRendered(attempt + 1), 100);
                    } else {
                        revealContent();
                    }
                });
    }

    private void revealContent() {
        if (loadFailed || isFinishing() || isDestroyed() || webView == null) return;
        loading.setVisibility(View.GONE);
    }

    private void showLoadError(String description) {
        loadFailed = true;
        loading.setVisibility(View.VISIBLE);
        loadingHint.setText(R.string.load_error);
        Log.w(TAG, "Web content failed: " + description);
    }

    /** Exposes build and update state to the web layer as window.MiseNative. */
    private final class MiseBridge {

        @JavascriptInterface
        public String buildInfo() {
            org.json.JSONObject info = new org.json.JSONObject();
            try {
                info.put("versionName", BuildConfig.VERSION_NAME);
                info.put("versionCode", BuildConfig.VERSION_CODE);
                info.put("webVersionCode", store.getActiveVersion());
                info.put("app", true);
            } catch (org.json.JSONException ignored) { }
            return info.toString();
        }

        @JavascriptInterface
        public void speechStart() {
            handler.post(MainActivity.this::startSpeechRecognition);
        }

        @JavascriptInterface
        public void speechStop() {
            handler.post(MainActivity.this::stopSpeechRecognition);
        }

        @JavascriptInterface
        public void ttsSpeak(String text) {
            if (miseVoice != null) miseVoice.speak(text);
        }

        @JavascriptInterface
        public void ttsStop() {
            if (miseVoice != null) miseVoice.stop();
        }

        @JavascriptInterface
        public void cookStep(String title, int step, int total, String stepText) {
            int safeTotal = Math.max(1, total);
            int safeStep = Math.min(Math.max(1, step), safeTotal);
            handler.post(() -> showCookNotification(title, safeStep, safeTotal, stepText));
        }

        @JavascriptInterface
        public void cookClear() {
            handler.post(MainActivity.this::cancelCookNotification);
        }

        @JavascriptInterface
        public void checkNow() {
            handler.post(() -> updates.check(new UpdateManager.Listener() {
                @Override
                public void onResult(final UpdateManager.Manifest manifest, final boolean webUpdated) {
                    if (isFinishing() || isDestroyed() || webView == null) return;
                    if (webUpdated) {
                        String updatedName = manifest != null ? manifest.versionName : BuildConfig.VERSION_NAME;
                        int updatedContent = manifest != null && manifest.web != null ? manifest.web.versionCode : 0;
                        org.json.JSONObject json = new org.json.JSONObject();
                        try {
                            json.put("status", "updated");
                            json.put("versionName", updatedName);
                            json.put("webVersionCode", updatedContent);
                        } catch (org.json.JSONException ignored) { }
                        emit(json);
                        finishWebUpdateAfterLoad();
                        Toast.makeText(MainActivity.this,
                                "Mise content updated to " + updatedName, Toast.LENGTH_SHORT).show();
                        return;
                    }
                    boolean apkAvailable = manifest != null
                            && manifest.apk != null
                            && manifest.versionCode > BuildConfig.VERSION_CODE;
                    org.json.JSONObject json = new org.json.JSONObject();
                    try {
                        if (apkAvailable) {
                            pendingUpdate = manifest;
                            json.put("status", "apk");
                            json.put("versionName", manifest.versionName);
                            json.put("versionCode", manifest.versionCode);
                            json.put("webVersionCode", manifest.web != null ? manifest.web.versionCode : 0);
                            json.put("notes", manifest.notes);
                        } else {
                            json.put("status", "uptodate");
                            json.put("versionName", BuildConfig.VERSION_NAME);
                            json.put("versionCode", BuildConfig.VERSION_CODE);
                            json.put("webVersionCode", store.getActiveVersion());
                        }
                    } catch (org.json.JSONException ignored) { }
                    emit(json);
                }

                @Override
                public void onError(final String message) {
                    org.json.JSONObject json = new org.json.JSONObject();
                    try {
                        json.put("status", "error");
                        json.put("message", message == null ? "unknown error" : message);
                    } catch (org.json.JSONException ignored) { }
                    emit(json);
                }
            }, /* force */ true));
        }

        @JavascriptInterface
        public void applyUpdate() {
            handler.post(() -> {
                if (pendingUpdate != null && !isFinishing() && !isDestroyed()) {
                    showUpdateDialog(pendingUpdate);
                }
            });
        }

        private void emit(final org.json.JSONObject payload) {
            handler.post(() -> {
                if (webView == null) return;
                final String argument = payload.toString();
                webView.evaluateJavascript(
                        "window.__miseUpdateResult && window.__miseUpdateResult(" + argument + ")", null);
            });
        }

        /** Mirrors the reload the silent startup check does after a content update. */
        private void finishWebUpdateAfterLoad() {
            handler.post(() -> {
                if (webView == null) return;
                String current = webView.getUrl();
                webView.clearCache(true);
                if (current != null && current.startsWith("https://" + WebContentStore.HOST + "/")) {
                    webView.loadUrl(current);
                } else {
                    loadStart();
                }
            });
        }
    }

    private void checkForUpdates() {
        if (isFinishing() || isDestroyed() || updates == null) return;
        updates.check(new UpdateManager.Listener() {
            @Override
            public void onResult(UpdateManager.Manifest manifest, boolean webUpdated) {
                if (isFinishing() || isDestroyed()) return;
                if (webUpdated) {
                    String current = webView.getUrl();
                    webView.clearCache(true);
                    if (current != null && current.startsWith("https://" + WebContentStore.HOST + "/")) {
                        webView.loadUrl(current);
                    } else {
                        loadStart();
                    }
                    Toast.makeText(MainActivity.this,
                            "Mise content updated" + (manifest != null ? " to " + manifest.versionName : ""),
                            Toast.LENGTH_SHORT).show();
                }
                if (updates.shouldOffer(manifest)) showUpdateDialog(manifest);
            }

            @Override
            public void onError(String message) {
                Log.d(TAG, "No update applied: " + message);
            }
        });
    }

    private void showUpdateDialog(UpdateManager.Manifest manifest) {
        String message = (manifest.notes.isEmpty()
                ? "A new version of Mise is ready."
                : manifest.notes)
                + "\n\nAndroid will download and verify the package before opening the installer. Your saved recipes stay on this device.";
        new AlertDialog.Builder(this)
                .setTitle("Mise " + manifest.versionName)
                .setMessage(message)
                .setPositiveButton("Download update", (dialog, which) -> updates.startApkDownload(this, manifest))
                .setNegativeButton("Later", (dialog, which) -> updates.dismiss(manifest))
                .show();
    }

    // On API 32 and below ContextCompat is not available in this project, so the
    // no-flags overload is the supported path there. The exported receiver path is
    // used on Android 13+, and the pending download is verified before use.
    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    private void registerDownloadReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                    if (id >= 0L) updates.handleDownloadComplete(MainActivity.this, id);
                }
            }
        };
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ only delivers this system broadcast to an exported receiver.
            // The receiver matches the pending download id and verifies the SHA-256
            // before doing anything with the file.
            registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, filter);
        }
    }

    private void openExternally(Uri uri) {
        if (uri == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No app can open that link.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
        if (updates != null) updates.resumePendingInstall(this);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        stopSpeechRecognition();
        super.onPause();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (root != null) root.requestApplyInsets();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    private void registerBackCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        finish();
    }

    // API 32 and below do not dispatch OnBackInvokedCallback.
    @Override
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (downloadReceiver != null) {
            try {
                unregisterReceiver(downloadReceiver);
            } catch (IllegalArgumentException ignored) {
                /* already unregistered */
            }
            downloadReceiver = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        stopSpeechRecognition();
        super.onDestroy();
    }
}
