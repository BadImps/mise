package com.badimps.mise;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Serves the bundled web app and an installed OTA copy from one virtual origin.
 *
 * <p>Both the bundle and OTA content are returned from {@code https://mise.local}
 * so localStorage, history and the app's hash routes survive an update. A new
 * bundle is unpacked into a staging directory, checked for index.html, and only
 * then switched live. A failed or partial download never replaces the copy that
 * is currently running.</p>
 */
final class WebContentStore {

    static final String HOST = "mise.local";

    private static final String PREFS = "mise_web_content";
    private static final String KEY_VERSION = "active_version";
    private static final long MAX_BUNDLE_BYTES = 48L * 1024L * 1024L;
    private static final int MAX_ENTRIES = 1600;

    private final Context context;
    private final AssetManager assets;
    private final SharedPreferences prefs;
    private final File root;

    private volatile int activeVersion;
    private volatile File activeDir;

    WebContentStore(Context context) {
        this.context = context.getApplicationContext();
        this.assets = this.context.getAssets();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        this.root = new File(this.context.getFilesDir(), "web");
        resolveActive();
    }

    int getActiveVersion() {
        return activeVersion;
    }

    private void resolveActive() {
        int bundled = BuildConfig.WEB_VERSION_CODE;
        int stored = prefs.getInt(KEY_VERSION, bundled);
        if (stored > bundled) {
            File candidate = versionDir(stored);
            if (new File(candidate, "index.html").isFile()) {
                activeVersion = stored;
                activeDir = candidate;
                return;
            }
        }
        activeVersion = bundled;
        activeDir = null;
        prefs.edit().putInt(KEY_VERSION, activeVersion).apply();
    }

    private File versionDir(int version) {
        return new File(root, "v" + version);
    }

    /**
     * Installs a verified web zip. The archive must contain index.html at its root.
     * Throws before switching the active version if anything is malformed.
     */
    // commit() is intentional: the active version must be durable before the
    // process can be killed, otherwise the next launch could serve a partial
    // or stale directory.
    @SuppressLint("ApplySharedPref")
    synchronized void install(int version, File zip) throws IOException {
        if (version <= 0) throw new IOException("Invalid bundle version");
        if (!zip.isFile() || zip.length() == 0L) throw new IOException("Empty update bundle");

        File staging = new File(root, "staging-" + version);
        deleteRecursively(staging);
        if (!staging.mkdirs()) throw new IOException("Could not prepare update storage");
        String stagingPath = staging.getCanonicalPath() + File.separator;

        long total = 0L;
        int entries = 0;
        try (ZipInputStream in = new ZipInputStream(new BufferedInputStream(new FileInputStream(zip)))) {
            ZipEntry entry;
            byte[] buffer = new byte[32 * 1024];
            while ((entry = in.getNextEntry()) != null) {
                String name = entry.getName().replace('\\', '/');
                while (name.startsWith("/")) name = name.substring(1);
                if (name.isEmpty() || name.startsWith("__MACOSX/") || name.contains("..")) continue;
                if (++entries > MAX_ENTRIES) throw new IOException("Update bundle has too many files");

                File out = new File(staging, name);
                String canonical = out.getCanonicalPath();
                if (!canonical.startsWith(stagingPath)) continue;

                if (entry.isDirectory()) {
                    if (!out.isDirectory() && !out.mkdirs()) throw new IOException("Could not create " + name);
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
                    throw new IOException("Could not create " + name);
                }
                try (FileOutputStream os = new FileOutputStream(out)) {
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        total += read;
                        if (total > MAX_BUNDLE_BYTES) throw new IOException("Update bundle is too large");
                        os.write(buffer, 0, read);
                    }
                }
            }
        }

        if (!new File(staging, "index.html").isFile()) {
            deleteRecursively(staging);
            throw new IOException("Update bundle has no index.html");
        }

        File target = versionDir(version);
        deleteRecursively(target);
        if (!staging.renameTo(target)) {
            deleteRecursively(staging);
            throw new IOException("Could not activate update bundle");
        }

        activeVersion = version;
        activeDir = target;
        prefs.edit().putInt(KEY_VERSION, version).commit();
        removeOtherVersions(version);
    }

    private void removeOtherVersions(int keep) {
        File[] children = root.listFiles();
        if (children == null) return;
        for (File child : children) {
            if (!child.isDirectory()) continue;
            String name = child.getName();
            if (name.startsWith("staging-")) {
                deleteRecursively(child);
                continue;
            }
            if (name.startsWith("v") && !name.equals("v" + keep)) {
                try {
                    if (Integer.parseInt(name.substring(1)) != keep) deleteRecursively(child);
                } catch (NumberFormatException ignored) {
                    deleteRecursively(child);
                }
            }
        }
    }

    WebResourceResponse open(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        try {
            path = Uri.decode(path);
        } catch (RuntimeException ignored) {
            /* keep the undecoded path */
        }
        if (!path.startsWith("/")) path = "/" + path;
        String relative = path.substring(1);
        if (relative.isEmpty()) relative = "index.html";
        if (relative.contains("..") || relative.indexOf('\\') >= 0) return notFound();

        InputStream stream = null;
        File directory = activeDir;
        if (directory != null) {
            try {
                File candidate = new File(directory, relative);
                String base = directory.getCanonicalPath() + File.separator;
                if (candidate.isFile() && candidate.getCanonicalPath().startsWith(base)) {
                    stream = new FileInputStream(candidate);
                }
            } catch (IOException ignored) {
                /* fall through to the APK bundle */
            }
        }
        if (stream == null) {
            try {
                stream = assets.open(relative);
            } catch (IOException ignored) {
                /* handled below */
            }
        }
        if (stream == null) return notFound();

        String mime = mimeOf(relative);
        boolean text = mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json")
                || mime.endsWith("svg+xml");
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(mime, text ? StandardCharsets.UTF_8.name() : null, 200, "OK", headers, stream);
    }

    private WebResourceResponse notFound() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse("text/plain", StandardCharsets.UTF_8.name(), 404, "Not Found", headers,
                new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
    }

    private static String mimeOf(String path) {
        int dot = path.lastIndexOf('.');
        String extension = dot >= 0 ? path.substring(dot + 1).toLowerCase(Locale.US) : "";
        switch (extension) {
            case "html":
            case "htm":
                return "text/html";
            case "css":
                return "text/css";
            case "js":
            case "mjs":
                return "application/javascript";
            case "json":
            case "map":
                return "application/json";
            case "svg":
                return "image/svg+xml";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            case "gif":
                return "image/gif";
            case "ico":
                return "image/x-icon";
            case "woff2":
                return "font/woff2";
            case "woff":
                return "font/woff";
            case "ttf":
                return "font/ttf";
            case "otf":
                return "font/otf";
            case "txt":
            case "md":
                return "text/plain";
            default:
                String guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                return guessed == null ? "application/octet-stream" : guessed;
        }
    }

    static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        // Best effort: a failed delete is retried on the next update attempt.
        file.delete();
    }
}
