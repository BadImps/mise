# OTA and release contract

Mise uses GitHub Releases as its only update channel. There is no update server to operate.

## Release assets

Every release must publish these files together:

```text
mise-<versionName>.apk
mise-web-<webVersionCode>.zip
mise-manifest.json
```

The manifest URL is stable across releases:

```text
https://github.com/BadImps/mise/releases/latest/download/mise-manifest.json
```

GitHub's `releases/latest` redirect always points at the most recent non-draft, non-prerelease release. The app follows the redirect.

## Manifest schema

```json
{
  "applicationId": "com.badimps.mise",
  "versionCode": 1,
  "versionName": "1.0.0",
  "publishedAt": "2026-11-11T00:00:00.000Z",
  "notes": "Short plain-text notes shown in the in-app dialog.",
  "apk": {
    "url": "https://github.com/BadImps/mise/releases/download/v1.0.0/mise-1.0.0.apk",
    "sha256": "64 lowercase hex characters",
    "sizeBytes": 1234567,
    "versionCode": 1
  },
  "web": {
    "url": "https://github.com/BadImps/mise/releases/download/v1.0.0/mise-web-1.zip",
    "sha256": "64 lowercase hex characters",
    "sizeBytes": 2345678,
    "versionCode": 1
  }
}
```

`web` may be omitted for releases that only change native code. Both asset URLs must begin with:

```text
https://github.com/BadImps/mise/releases/download/
```

## Validation performed on the device

### Manifest

- `applicationId` must equal `com.badimps.mise`.
- `versionCode` must be positive and `versionName` must be non-empty.
- Both asset URLs must use the approved GitHub release prefix.
- Every `sha256` must be 64 lowercase hex characters.
- Every `sizeBytes` must be positive and within the configured limit.
- The manifest itself is limited to 64 KiB.

### Web content update

- The zip is downloaded over HTTPS and limited to 48 MiB.
- Its SHA-256 and byte count must match the manifest.
- It is unpacked into a staging directory, never over the running copy.
- Entry paths are normalized; absolute paths, `..`, backslashes, and `__MACOSX` entries are rejected or skipped.
- The archive is limited to 1,600 entries and 48 MiB uncompressed.
- `index.html` must exist at the archive root.
- Only then is the staging directory renamed into place and the active version switched.

If any step fails, the previous content stays active. The next check retries after the six-hour throttle.

### Native app update

- Android `DownloadManager` owns the transfer so it survives a brief network loss or app backgrounding.
- The APK's SHA-256 is checked immediately before the installer opens.
- A mismatch deletes the file and reports that nothing was installed.
- The verified file and checksum are recorded in preferences so the installer can be resumed after a process restart or a trip to Android's install-permission settings.
- Android's system installer remains the final authority on package signature and compatibility.

## Versioning rules

`versionCode` is the Android package version. It must increase for every APK published to the same application ID.

`web.versionCode` is an independent content counter. The app compares it with the active web version and only installs a strictly greater value. The APK records its bundled web version in `BuildConfig`, so a new installation starts with that version instead of re-downloading an equivalent bundle.

- Normal app release: leave `web_version_code` empty. The workflow uses `versionCode`.
- Content-only release: keep the APK version unchanged and set a higher `web_version_code`, such as `2` after `1`.
- Never lower a web version. A lower manifest is ignored, not downloaded.
- A web version higher than the app's `versionCode` is normal; it is what makes content OTA possible without reinstalling.

## Rollback

To roll back a bad content update, publish a new release with a **higher** web version containing the previous web files. Android app rollback requires a higher `versionCode` and the same signing key; installing a lower version is rejected by the platform.

Do not delete a release that devices may still be downloading. If a release must be withdrawn, publish a replacement with a higher version and leave the old assets reachable until the replacement is fully rolled out.

## Signing

Release APKs are signed with a keystore stored outside the repository. GitHub Actions restores it from four repository secrets and writes `android/signing/upload-signing.properties` only inside the runner.

The release build fails if the signing properties file is missing. This prevents a debug-signed APK from being published accidentally.

Keep an offline backup of the keystore and its passwords. Losing the key means existing installations cannot receive native updates without an uninstall and reinstall.

## First-run behavior

The app ships with the web content bundled in the APK. On startup it waits briefly, then checks the manifest at most once every six hours. A missing release or offline device is not an error; the bundled copy remains available and the check is retried later.
