package com.badimps.mise;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Update channel backed by GitHub Releases.
 *
 * <p>Every release attaches an APK, a web bundle and a small manifest. Content
 * updates install inside the app without a reinstall. Native updates are offered
 * through the system download manager and installer. The manifest's AES-free
 * SHA-256 checks and HTTPS URLs are validated before anything is opened.</p>
 */
final class UpdateManager {

    private static final String TAG = "MiseOta";
    private static final String MANIFEST_URL =
            "https://github.com/BadImps/mise/releases/latest/download/mise-manifest.json";
    static final String RELEASES_URL = "https://github.com/BadImps/mise/releases/latest";
    private static final String ASSET_PREFIX = "https://github.com/BadImps/mise/releases/download/";
    private static final String APK_MIME = "application/vnd.android.package-archive";

    private static final String PREFS = "mise_updates";
    private static final String KEY_LAST_CHECK = "last_check";
    private static final String KEY_DISMISSED = "dismissed_version";
    private static final String KEY_DOWNLOAD_ID = "download_id";
    private static final String KEY_DOWNLOAD_SHA = "download_sha";
    private static final String KEY_DOWNLOAD_NAME = "download_name";
    private static final String KEY_DOWNLOAD_PATH = "download_path";
    private static final String KEY_DOWNLOAD_VERSION = "download_version";
    private static final String KEY_READY = "verified_ready";
    private static final String KEY_CONSUMED = "installer_consumed";

    private static final long CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L;
    private static final long MAX_WEB_BYTES = 48L * 1024L * 1024L;
    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;
    private static final long MAX_MANIFEST_BYTES = 64L * 1024L;

    private final Context context;
    private final WebContentStore store;
    private final SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean permissionDialogShowing;

    UpdateManager(Context context, WebContentStore store) {
        this.context = context.getApplicationContext();
        this.store = store;
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    interface Listener {
        /** manifest is null when the check was skipped by the six-hour throttle. */
        void onResult(Manifest manifest, boolean webUpdated);
        void onError(String message);
    }

    static final class Manifest {
        final int versionCode;
        final String versionName;
        final String notes;
        final Asset apk;
        final Asset web;

        Manifest(int versionCode, String versionName, String notes, Asset apk, Asset web) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.notes = notes == null ? "" : notes;
            this.apk = apk;
            this.web = web;
        }
    }

    static final class Asset {
        final String url;
        final String sha256;
        final long sizeBytes;
        final int versionCode;

        Asset(String url, String sha256, long sizeBytes, int versionCode) {
            this.url = url;
            this.sha256 = sha256;
            this.sizeBytes = sizeBytes;
            this.versionCode = versionCode;
        }
    }

    void check(Listener listener) {
        long last = prefs.getLong(KEY_LAST_CHECK, 0L);
        if (System.currentTimeMillis() - last < CHECK_INTERVAL_MS) {
            listener.onResult(null, false);
            return;
        }
        new Thread(() -> {
            try {
                Manifest manifest = fetchManifest();
                prefs.edit().putLong(KEY_LAST_CHECK, System.currentTimeMillis()).apply();
                boolean webUpdated = false;
                if (manifest.web != null && manifest.web.versionCode > store.getActiveVersion()) {
                    File bundle = download(manifest.web, "web");
                    try {
                        store.install(manifest.web.versionCode, bundle);
                        webUpdated = true;
                    } finally {
                        WebContentStore.deleteRecursively(bundle);
                    }
                }
                final boolean updated = webUpdated;
                main.post(() -> listener.onResult(manifest, updated));
            } catch (Exception error) {
                Log.w(TAG, "Update check failed", error);
                main.post(() -> listener.onError(safeMessage(error)));
            }
        }, "mise-update-check").start();
    }

    boolean shouldOffer(Manifest manifest) {
        return manifest != null
                && manifest.apk != null
                && manifest.versionCode > BuildConfig.VERSION_CODE
                && prefs.getInt(KEY_DISMISSED, -1) != manifest.versionCode;
    }

    void dismiss(Manifest manifest) {
        prefs.edit().putInt(KEY_DISMISSED, manifest.versionCode).apply();
    }

    // commit() is intentional: the download id and checksum must be durable
    // before DownloadManager can broadcast completion.
    @SuppressLint("ApplySharedPref")
    void startApkDownload(Activity activity, Manifest manifest) {
        if (manifest == null || manifest.apk == null) return;
        try {
            DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) throw new IOException("No download manager");

            long previous = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
            if (previous >= 0L) {
                try { manager.remove(previous); } catch (RuntimeException ignored) { /* already gone */ }
            }

            String fileName = "mise-" + safeName(manifest.versionName) + ".apk";
            String destination = "updates/" + fileName;

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(manifest.apk.url));
            request.setTitle("Mise " + manifest.versionName);
            request.setDescription("Downloading the verified app update");
            request.setMimeType(APK_MIME);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, destination);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);

            long id = manager.enqueue(request);
            prefs.edit()
                    .putLong(KEY_DOWNLOAD_ID, id)
                    .putString(KEY_DOWNLOAD_SHA, manifest.apk.sha256)
                    .putString(KEY_DOWNLOAD_NAME, manifest.versionName)
                    .putString(KEY_DOWNLOAD_PATH, destination)
                    .putInt(KEY_DOWNLOAD_VERSION, manifest.versionCode)
                    .putBoolean(KEY_READY, false)
                    .putBoolean(KEY_CONSUMED, false)
                    .commit();
            Toast.makeText(activity, "Downloading Mise " + manifest.versionName + "…", Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Log.w(TAG, "Could not start APK download", error);
            Toast.makeText(activity, "Could not start the update. Opening GitHub Releases.", Toast.LENGTH_LONG).show();
            openReleases(activity);
        }
    }

    long getDownloadId() {
        return prefs.getLong(KEY_DOWNLOAD_ID, -1L);
    }

    /** Called by the activity on DownloadManager.ACTION_DOWNLOAD_COMPLETE. */
    void handleDownloadComplete(Activity activity, long id) {
        if (id != prefs.getLong(KEY_DOWNLOAD_ID, -1L)) return;

        DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;
        int status = DownloadManager.STATUS_FAILED;
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor != null && cursor.moveToFirst()) {
                status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not read download status", error);
        }
        if (status != DownloadManager.STATUS_SUCCESSFUL) {
            prefs.edit().putBoolean(KEY_READY, false).remove(KEY_DOWNLOAD_ID).apply();
            Toast.makeText(activity, "The update download did not finish.", Toast.LENGTH_LONG).show();
            return;
        }

        String path = prefs.getString(KEY_DOWNLOAD_PATH, "");
        File apk = path.isEmpty() ? null : new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), path);
        if (apk == null || !apk.isFile()) {
            Toast.makeText(activity, "The update file is missing. Try again.", Toast.LENGTH_LONG).show();
            clearDownload();
            return;
        }

        try {
            String actual = sha256(apk);
            String expected = prefs.getString(KEY_DOWNLOAD_SHA, "");
            if (!actual.equalsIgnoreCase(expected)) {
                WebContentStore.deleteRecursively(apk);
                clearDownload();
                Toast.makeText(activity, "Update verification failed, so nothing was installed.", Toast.LENGTH_LONG).show();
                return;
            }
            prefs.edit().putBoolean(KEY_READY, true).apply();
            launchInstaller(activity, manager, id);
        } catch (Exception error) {
            Log.w(TAG, "Could not verify APK", error);
            clearDownload();
            Toast.makeText(activity, "Update verification failed, so nothing was installed.", Toast.LENGTH_LONG).show();
        }
    }

    /** Resume a verified download after a process restart or a trip to Settings. */
    void resumePendingInstall(Activity activity) {
        if (prefs.getBoolean(KEY_CONSUMED, true)) return;
        long id = prefs.getLong(KEY_DOWNLOAD_ID, -1L);
        if (id < 0L) return;
        if (prefs.getBoolean(KEY_READY, false)) {
            DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager != null) launchInstaller(activity, manager, id);
            return;
        }
        DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor != null && cursor.moveToFirst()) {
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                if (status == DownloadManager.STATUS_SUCCESSFUL) handleDownloadComplete(activity, id);
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not resume update installer", error);
        }
    }

    private void launchInstaller(Activity activity, DownloadManager manager, long id) {
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            showInstallPermissionDialog(activity);
            return;
        }
        Uri uri = manager.getUriForDownloadedFile(id);
        if (uri == null) {
            Toast.makeText(activity, "The verified file is no longer available. Opening GitHub Releases.", Toast.LENGTH_LONG).show();
            openReleases(activity);
            clearDownload();
            return;
        }
        prefs.edit().putBoolean(KEY_CONSUMED, true).apply();
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, APK_MIME);
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(install);
        } catch (ActivityNotFoundException error) {
            Log.w(TAG, "No package installer", error);
            Toast.makeText(activity, "No installer is available. Opening GitHub Releases.", Toast.LENGTH_LONG).show();
            openReleases(activity);
        }
    }

    private void showInstallPermissionDialog(Activity activity) {
        if (permissionDialogShowing || activity.isFinishing() || activity.isDestroyed()) return;
        permissionDialogShowing = true;
        AlertDialog dialog = new AlertDialog.Builder(activity)
                .setTitle("Finish the Mise update")
                .setMessage("Android needs permission to install apps from Mise. Open Settings, allow installs from Mise, then return here to finish.")
                .setPositiveButton("Open settings", (ignored, which) -> {
                    try {
                        Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + activity.getPackageName()));
                        activity.startActivity(settings);
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(activity, "No Settings screen is available. Opening GitHub Releases.", Toast.LENGTH_LONG).show();
                        openReleases(activity);
                    }
                })
                .setNegativeButton("Later", null)
                .create();
        dialog.setOnDismissListener(ignored -> permissionDialogShowing = false);
        dialog.show();
    }

    private void clearDownload() {
        prefs.edit()
                .remove(KEY_DOWNLOAD_ID)
                .remove(KEY_DOWNLOAD_SHA)
                .remove(KEY_DOWNLOAD_NAME)
                .remove(KEY_DOWNLOAD_PATH)
                .remove(KEY_DOWNLOAD_VERSION)
                .putBoolean(KEY_READY, false)
                .putBoolean(KEY_CONSUMED, true)
                .apply();
    }

    private Manifest fetchManifest() throws IOException, JSONException {
        String text = readLimited(MANIFEST_URL, "application/json", MAX_MANIFEST_BYTES);
        JSONObject json = new JSONObject(text);
        String applicationId = json.optString("applicationId", "");
        if (!BuildConfig.APPLICATION_ID.equals(applicationId)) {
            throw new JSONException("Update manifest is for a different application");
        }
        int versionCode = json.getInt("versionCode");
        String versionName = json.getString("versionName").trim();
        if (versionCode <= 0 || versionName.isEmpty()) throw new JSONException("Invalid update version");

        Asset apk = parseAsset(json.getJSONObject("apk"), versionCode);
        Asset web = null;
        if (json.has("web") && !json.isNull("web")) {
            web = parseAsset(json.getJSONObject("web"), versionCode);
        }
        return new Manifest(versionCode, versionName, json.optString("notes", "").trim(), apk, web);
    }

    private Asset parseAsset(JSONObject json, int fallbackVersion) throws JSONException {
        String url = json.getString("url");
        if (!url.startsWith(ASSET_PREFIX)) throw new JSONException("Unexpected update host");
        String sha = json.getString("sha256").toLowerCase(Locale.US);
        if (!sha.matches("[0-9a-f]{64}")) throw new JSONException("Invalid update checksum");
        long size = json.optLong("sizeBytes", -1L);
        if (size == 0L || size > MAX_APK_BYTES) throw new JSONException("Invalid update size");
        int version = json.optInt("versionCode", fallbackVersion);
        if (version <= 0) throw new JSONException("Invalid asset version");
        return new Asset(url, sha, size, version);
    }

    private File download(Asset asset, String label) throws Exception {
        if (asset.sizeBytes > MAX_WEB_BYTES) throw new IOException("Web update is too large");
        File target = new File(context.getCacheDir(), "mise-" + label + "-" + asset.versionCode + ".zip");
        WebContentStore.deleteRecursively(target);

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long total = 0L;
        HttpURLConnection connection = null;
        try {
            connection = open(asset.url, "application/octet-stream");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IOException("Update download returned HTTP " + code);
            try (InputStream in = connection.getInputStream();
                 OutputStream out = new FileOutputStream(target)) {
                byte[] buffer = new byte[32 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_WEB_BYTES) throw new IOException("Web update is too large");
                    digest.update(buffer, 0, read);
                    out.write(buffer, 0, read);
                }
            }
        } finally {
            if (connection != null) connection.disconnect();
        }

        if (asset.sizeBytes > 0L && total != asset.sizeBytes) {
            WebContentStore.deleteRecursively(target);
            throw new IOException("Web update size did not match the manifest");
        }
        String actual = toHex(digest.digest());
        if (!actual.equalsIgnoreCase(asset.sha256)) {
            WebContentStore.deleteRecursively(target);
            throw new IOException("Web update checksum did not match the manifest");
        }
        return target;
    }

    private String readLimited(String address, String accept, long limit) throws IOException {
        HttpURLConnection connection = null;
        try {
            connection = open(address, accept);
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IOException("Update manifest returned HTTP " + code);
            try (InputStream in = connection.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int read;
                long total = 0L;
                while ((read = in.read(buffer)) != -1) {
                    total += read;
                    if (total > limit) throw new IOException("Update manifest is too large");
                    out.write(buffer, 0, read);
                }
                return out.toString(StandardCharsets.UTF_8.name());
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private HttpURLConnection open(String address, String accept) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        connection.setInstanceFollowRedirects(true);
        connection.setUseCaches(false);
        connection.setRequestProperty("User-Agent",
                "Mise-Android/" + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")");
        connection.setRequestProperty("Accept", accept);
        return connection;
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        return toHex(digest.digest());
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value));
        return builder.toString();
    }

    private static String safeName(String value) {
        return value.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    private static void openReleases(Activity activity) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(RELEASES_URL)));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(activity, "Visit github.com/BadImps/mise/releases", Toast.LENGTH_LONG).show();
        }
    }

    private static String safeMessage(Throwable error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? error.getClass().getSimpleName() : message;
    }
}
