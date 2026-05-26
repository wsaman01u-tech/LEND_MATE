# SGMI LendMate — Mobile App Build Guide

## EASIEST WAY: Install as App from Browser (PWA)

Your app is now a **Progressive Web App (PWA)**. This means it can be installed directly from the browser on any Android phone — **no APK needed**.

### Steps:
1. **Deploy your app** to any hosting (Netlify, Vercel, Firebase Hosting, etc.)
2. **Open the URL** on your Android phone in Chrome
3. Chrome will show **"Add to Home Screen"** banner OR tap the **⋮ menu → "Install app"**
4. The app installs with your icon and opens full-screen like a native app
5. It works **offline** automatically (service worker caches everything)

That's it. No Android Studio, no APK building.

---

## WANT AN APK? Use PWABuilder (No Android Studio needed)

1. Deploy your app to a public URL
2. Go to **[pwabuilder.com](https://www.pwabuilder.com/)**
3. Enter your app URL
4. Click **"Package for stores"** → Choose **Android**
5. Download the generated APK
6. Install on any Android phone

This creates a real APK that wraps your PWA in a native shell (TWA - Trusted Web Activity).

---

## ADVANCED: Capacitor + Android Studio (for native features)

The app also has **Capacitor** set up for building a full native APK with native plugins.

### Architecture

The app uses **Capacitor** to wrap the existing React + Vite web app into a native Android shell.
No code rewrite — the same codebase runs on web AND mobile.

```
┌─────────────────────────────┐
│   React + Vite + Tailwind   │  ← Your existing web app
├─────────────────────────────┤
│   Capacitor Bridge Layer    │  ← Native APIs (Network, Storage, etc.)
├─────────────────────────────┤
│   Android WebView (Native)  │  ← APK shell
└─────────────────────────────┘
```

## Prerequisites

- **Node.js** 18+
- **Android Studio** (latest stable) — [Download](https://developer.android.com/studio)
- **Java JDK 17** — Android Studio installs this
- After installing Android Studio:
  1. Open it → SDK Manager → Install **Android SDK 34**
  2. Tools tab → Install **Android SDK Build-Tools**, **Android SDK Command-line Tools**
  3. Set `ANDROID_HOME` environment variable to your SDK path

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build web app
npm run build

# 3. Sync to Android
npx cap sync android

# 4. Open in Android Studio
npx cap open android
```

Then in Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

## Development Workflow

### Live reload on device/emulator
```bash
npm run dev              # Start Vite dev server
npx cap run android      # Run on device with live reload
```

### Build production APK
```bash
npm run build            # Build optimized web assets
npx cap sync android     # Copy to Android project
npx cap open android     # Open Android Studio → Build APK
```

The debug APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Build signed release APK/AAB
1. In Android Studio: **Build → Generate Signed Bundle / APK**
2. Create or use a keystore file
3. Choose **APK** for direct install or **AAB** for Play Store

## Key Files

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor settings (app ID, plugins, splash screen) |
| `src/lib/capacitor.js` | Native bridge init, network status, offline queue |
| `src/lib/updater.js` | OTA update system (Capgo + Firebase version check) |
| `src/lib/data.js` | Data layer with offline-first sync |
| `src/components/UpdateBanner.jsx` | In-app update prompt UI |
| `android/` | Android native project (auto-generated) |

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an Android app with package name `com.sgmi.lendmate`
3. Download `google-services.json` → place in `android/app/`
4. Create `.env` file from `.env.example` with your Firebase config
5. Enable Authentication (Email/Password) and Firestore

### Firebase Version Tracking (for OTA)

Create a Firestore document at `appConfig/version`:
```json
{
  "latestVersion": "1.0.0",
  "patchVersion": "1.0.0-p1",
  "forceUpdate": false,
  "releaseNotes": "Bug fixes and improvements"
}
```

- Set `forceUpdate: true` to block app usage until update
- Change `latestVersion` to trigger update banner

## OTA Updates (Capgo)

Capgo enables pushing JavaScript/CSS updates without reinstalling APK.

### Setup
1. Sign up at [capgo.app](https://capgo.app)
2. Install CLI: `npm i -g @capgo/cli`
3. Login: `npx @capgo/cli login`
4. Add app: `npx @capgo/cli app add`
5. Upload bundle: `npx @capgo/cli bundle upload`

### What OTA can update
- UI changes
- Dashboard redesigns
- EMI calculation logic
- Bug fixes
- New features (JS/CSS only)

### What requires full APK update
- New native plugins
- Android permission changes
- Native code changes
- Capacitor version upgrades

## Offline Support

The app works offline automatically:

1. **Reads**: Firestore snapshots are cached locally. When offline, cached data is served.
2. **Writes**: When offline, writes are applied locally (instant UI) and queued.
3. **Sync**: When internet returns, queued operations replay to Firebase.
4. **Settings**: Shows online/offline status, pending sync count, manual sync button.

## App Icon & Splash Screen

### Replace app icon
Put your icon files in:
```
android/app/src/main/res/mipmap-hdpi/ic_launcher.png      (72x72)
android/app/src/main/res/mipmap-mdpi/ic_launcher.png      (48x48)
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png     (96x96)
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png    (144x144)
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png   (192x192)
```

Or use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) to generate all sizes.

### Splash screen
Configured in `capacitor.config.ts`:
- Background color: `#059669` (primary green)
- Duration: 2 seconds
- Auto-hide after app loads

## Useful Commands

```bash
npx cap sync android      # Sync web assets + plugins
npx cap copy android      # Copy web assets only (faster)
npx cap open android      # Open in Android Studio
npx cap run android       # Build + run on device
npx cap run android -l    # Live reload mode
```

## Troubleshooting

**Build fails with Gradle error**: Open `android/` in Android Studio, let it sync Gradle, then build.

**White screen on app start**: Run `npm run build` then `npx cap sync android` — web assets may be missing.

**Offline ops not syncing**: Check Settings → App Info → Pending Sync count. Tap "Sync Now" when online.

**OTA update not applying**: Capgo auto-update is enabled. Check `capacitor.config.ts` → `CapacitorUpdater.autoUpdate`.
