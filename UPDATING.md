# Updating ShiftClocker (without losing user data)

User data (shifts, jobs, quick shifts, settings, theme) lives in **AsyncStorage on the
device**. It survives updates as long as two things stay the same:

1. **Package ID** — `com.shiftclocker.app` (in `app.json`). Never change this after release.
2. **Signing key** — EAS uses one managed keystore per project, so every build is signed
   the same way automatically. Don't reset credentials.

If both stay the same, Android treats a new install as an *update* and keeps all data.
Changing either one makes Android see a different app and the old data is gone.

## Every release, bump two numbers in `app.json`

```
"version": "2.0.1",          // shown to users
"android": { "versionCode": 3 }   // MUST go up by 1 each store/APK release
```

## A) Sideloaded APK (sharing the file directly)

```
npx eas build -p android --profile preview
```

Send the new APK. Installing it over the old one keeps all data (same package + key).
Tip: keep a JSON backup anyway (Settings → Backups → Backup now).

## B) Google Play Store

```
npx eas build -p android --profile production   # builds an .aab
npx eas submit -p android                        # or upload the .aab in Play Console
```

- First upload: Google enables **Play App Signing** and holds the signing key.
- Each later release: bump `versionCode`, build, upload. Users auto-update with data intact.
- Rollout is staged/automatic — you don't ship files yourself.

## C) Optional: instant JS updates (OTA) without a new APK

For JS/asset-only fixes (no native change), `expo-updates` lets you push instantly:

```
npx expo install expo-updates
eas update:configure
eas update --branch production -m "fix typo"
```

Native changes (new permission, new native module) still need a full build (A or B).

## Safety net

The built-in **JSON backup/restore** (Settings → Backups) is the cross-device and
factory-reset recovery path. Restore accepts both new `shiftclocker-backup` files and
legacy `shiftylog-backup` files.
