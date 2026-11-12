# Keep WebView JavaScript bridge classes if one is added later.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
