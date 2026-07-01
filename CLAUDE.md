# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`expo-utils` is a CLI tool and utility library that automates 90% of the initial setup for Expo/React Native projects. It provides:

- Automated dependency installation via a custom CLI (`expo-utils-install`)
- Pre-built utilities for ads (AdMob), Firebase integration, internationalization, and analytics
- Template scaffolding for common Expo patterns
- Configuration management for complex integrations (Firebase, RevenueCat, Facebook SDK, etc.)

This is a **library package** that gets installed into user projects, not a standalone application.

## Package Manager Support

The CLI auto-detects the package manager via `detectPackageManager()` in `bin/install.js`. Detection priority:

1. **Lockfile** (most reliable): yarn.lock → pnpm-lock.yaml → package-lock.json → bun.lockb/bun.lock
2. **User agent** (`npm_config_user_agent`): yarn → pnpm → bun → npm
3. **Default**: **bun**

The detected PM controls both the install command (`bun add`, `yarn add`, etc.) and the exec runner (`bunx`, `npx -y`, etc.) used for `expo install`.

## Development Commands

### Building/Testing

- This project has **no build step** - it's distributed as plain TypeScript/JavaScript
- TypeScript is only used for type checking in development
- To test locally: `npm pack` then `bun add ./expo-utils-X.X.X.tgz` in a test project (avoids symlink issues)

### Running the CLI

- Test CLI installation: `node bin/install.js` (from within a test project that has expo-utils installed)
- CLI flags:
    - `--new`: Full setup for new projects (runs all scaffolding with confirmation prompts). During the app-reset step (behind the `Y/n` prompt) it cleans `assets/images/` down to an **allowlist** — keeps only `icon.png`, `splash-icon.png`, `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`; removes **everything else** — every other loose file (`react-logo*`, `favicon`, `partial-react-logo`, `expo-badge*`, `expo-logo`, …) **and subfolders** (e.g. the template's `tabIcons/` with the example `explore`/`home` icons), recursively. Since `--new` targets new projects, any subfolder there is template junk, not your asset. It also deletes the broken `assets/expo.icon/` Icon Composer folder (pairs with `--expo-icon`, which strips the matching `ios.icon` from app.json).
    - `--config`: Add standard plugins to app.json, including the default `expo-splash-screen` config. Also sets `ios.supportsTablet: true` (iPad support) and the Android `AD_ID` permission.
    - `--layout`: Replace root \_layout.tsx with template
    - `--srcapp`: Move app/ to src/app/
    - `--languages`: Setup i18n with pt/en/es translations. Also writes localized iOS purpose strings (`NSUserTracking`/`NSPhotoLibrary`/`NSPhotoLibraryAdd`/`NSCamera` usage descriptions) into each `languages/<locale>.json` for `expo.locales` → `InfoPlist.strings`, **merging** into existing files (adds only missing keys, preserves your translations). The Info.plist base keys themselves are injected by the config plugin (see Configuration System).
    - `--firebase-placeholders`: Create placeholder Firebase config files
    - `--skadnetwork`: Remove SKAdNetworkItems from app.json (the IDs are now injected into Info.plist by the expo-utils config plugin at prebuild — see `app.plugin.js`). Keeps any custom IDs not in the plugin list.
    - `--constants`: Create constants folder with Strings.ts template
    - `--eas-config`: Setup EAS Build, build cache, remove updates block
    - `--tracking-permission`: Add iOS tracking transparency permission
    - `--fix-ios-build`: Apply iOS build fixes (expo-build-properties, static frameworks). Also dedupes string arrays in `infoPlist` (e.g. `UIBackgroundModes`), preserving order — object arrays like `SKAdNetworkItems` are left to `--skadnetwork`.
    - `--expo-icon`: Removes a broken `ios.icon` — one pointing at a path that doesn't exist on disk (e.g. a deleted `./assets/expo.icon`), which makes `actool` fail at prebuild with `attempt to insert nil object from objects[0]`. The iOS then falls back to the valid root `icon`. Removed **only** when a valid root `icon` exists; otherwise it just warns (never leaves the app icon-less). Runs automatically in `--new` — and **again right after the app-reset step**, because `handleAppReset()` is what deletes `assets/expo.icon`, so the first (pre-reset) pass can't yet see the now-orphaned `ios.icon` (the directory still existed). The post-reset pass strips it.
    - `--gitignore`: Update .gitignore with ios/, android/, etc.
    - `--hot-updater`: Setup Hot Updater (babel.config.js, .env files, dependencies)
    - `--sort-plugins`: Reorder app.json `plugins` so string plugins come first, then array (`[name, config]`) plugins (stable within each group). Also runs automatically at the end of `--config` and `--new`.
    - `--pin-deps`: Pin every project dependency in `package.json` to an **exact** version so installs are identical across machines. Strips range operators (`^`, `~`, `>=`, `>`, `<=`, `<`, `=`) from `dependencies`/`devDependencies`/`optionalDependencies` and, whenever the package is installed, rewrites the spec to the version actually resolved in `node_modules` (otherwise falls back to the range's floor). Non-registry specs are **preserved untouched** — git/GitHub (incl. shorthand `owner/repo`), `file:`/`link:`/`workspace:`/`npm:` and tarball/URL/path specs (anything containing `:` or `/`), so e.g. `expo-utils` installed via a GitHub link is never overwritten. Composite ranges (`>=1 <2`) on not-installed packages are left as-is. Runs automatically near the end of `--new` (after all handlers that modify `package.json`).

## Architecture

### Core Components

#### 1. CLI System (`bin/install.js`)

The CLI is a Node.js script that scaffolds Expo projects. It:

- Detects and installs missing peer dependencies (using expo install when possible)
- Modifies `app.json` to add plugins and configurations
- Creates template files from `templates/` directory
- Handles project structure transformations (moving app/ to src/app/, etc.)

**Key Pattern**: Each CLI flag has a dedicated `handle*Flag()` function. The `--new` flag orchestrates multiple operations with user confirmation for destructive changes.

#### 2. Utils Module (`utils/Utils.ts`)

Central initialization module with a `prepare()` function that:

- Loads Firebase Remote Config settings
- Configures RevenueCat (in-app purchases)
- Initializes Firebase (Analytics, Crashlytics, Push Notifications)
- Sets up Facebook SDK with App Events
- Configures Microsoft Clarity analytics
- Requests iOS tracking permissions
- Checks for required app updates
- Subscribes to Firebase topic based on app slug

**Important**: Uses dynamic imports with fallbacks for optional dependencies to avoid crashes when packages aren't installed.

**Global Variables Set by prepare()**:

```typescript
global.remoteConfigs; // Firebase Remote Config values
global.isAdsEnabled; // Master ad toggle
global.adUnits; // AdMob unit IDs per platform
```

#### 3. Ad System (`utils/LoadAdsManager.ts`, `utils/banner-ad.tsx`)

Handles Google Mobile Ads with automatic premium user detection:

- Checks `@isPremium` in AsyncStorage - if true, skips ads
- Respects `global.isAdsEnabled` and `global.remoteConfigs.is_ads_enabled`
- Provides `showInterstitial()` and `showRewarded()` methods
- `BannerAdComponent` supports customizable styling via `useFooterStyle` prop

#### 4. Internationalization (`utils/i18n.ts`)

Provides translations in 12 languages (pt, en, es, fr, de, it, ja, ko, zh, ru, ar, nl). Auto-detects system language via `expo-localization` with fallback to 'en'.

#### 5. Type System (`utils/types.ts`)

Defines core interfaces:

- `AppConfig`: Expo app.json structure
- `AppStrings`: Local app strings with `rckey` (RevenueCat key) and `adUnits` (AdMob unit IDs)
- `AdUnits`: AdMob unit IDs (appOpen, banner, interstitial, rewarded)
- `RemoteConfigUtilsType`: Firebase remote config schema (all fields flat: ads, version, review, promotional, tiktokads, clarity, etc.)
- `FacebookConfig`: Facebook SDK configuration
- `RevenueCatKeys`: Platform-specific RevenueCat API keys
- `PromotionalConfig`: Promotional content configuration

### Peer Dependencies Strategy

This package uses **peer dependencies** extensively to avoid duplication. All major dependencies (Firebase, Expo modules, React Native packages) are peer deps. The package:

- Uses dynamic `require()` with try-catch for optional features
- Provides helpful warnings when features are unavailable
- Never crashes due to missing dependencies

### Configuration System

The package can be configured via the Expo config plugin in app.json:

```json
["expo-utils", {"disableWarnings": true, "disableLogs": true}]
```

These flags suppress console output from expo-utils in production (read at **runtime** from app.json via `plugin[1]?.disableWarnings`/`disableLogs` in `Utils.ts`).

The same config plugin (`app.plugin.js`) also injects all SKAdNetwork IDs (`data/skadnetwork_ids.json`) into the iOS `Info.plist` at **prebuild** via `withInfoPlist`, so the ~160 IDs no longer need to live in `app.json`. The merge is case-insensitive and preserves any custom `SKAdNetworkItems` already present. The plugin is wrapped in `createRunOncePlugin` to avoid double-application. Just keep `["expo-utils", { ... }]` in the `plugins` array.

By default the same plugin also hides the `expo-dev-menu` onboarding overlay **and** the floating action button (FAB) in **DEBUG** dev builds, by injecting flags into native boot at **prebuild** (tag `skip-devmenu-onboarding`, via `mergeContents`): iOS `AppDelegate.swift` (`#if DEBUG` → `UserDefaults.standard.set(true, "EXDevMenuIsOnboardingFinished")` + `set(false, "EXDevMenuShowFloatingActionButton")`) with `withAppDelegate`; Android `MainApplication.kt` (`if (BuildConfig.DEBUG)` → SharedPreferences `expo.modules.devmenu.sharedpreferences`, `isOnboardingFinished=true` / `showFab=false`) with `withMainApplication`. It runs before the first frame, so neither overlay nor FAB ever appears; inert in release (compiled out). The FAB only shows once onboarding is finished, so both flags are set together. Opt out with `["expo-utils", { "skipDevMenuOnboarding": false }]` — this option is read at **prebuild** (unlike `disableWarnings`/`disableLogs`, read at runtime).

The plugin also accepts an **opt-in** `firebaseLogLevel` option (`"error" | "warn" | "info" | "debug"`, or `true` = `"error"`) that quiets the **native** Firebase iOS SDK logs (e.g. `[FirebaseAnalytics][I-ACS...]`). At **prebuild** (`withDangerousMod` → `withFirebaseLogLevel`) it writes/merges `react-native.app_log_level` into a `firebase.json` at the **project root**, so you never have to create that file by hand — RNFirebase's `ios_config.sh` walks up from `ios/` and reads it, applying `[FIRConfiguration setLoggerLevel:]`. The merge **preserves** other `firebase.json` keys and does **not** overwrite a manually-set `app_log_level` (idempotent across re-prebuilds). It's iOS-only (the key only applies to iOS) so it runs in the iOS mod. Note: this does **not** silence RNFirebase's own `DLog` lines (`RNFBMessaging getAPNSToken`, `RNFBCrashlyticsInit`) — those are `#ifdef DEBUG NSLog` and vanish in release builds. Example: `["expo-utils", { "disableWarnings": true, "firebaseLogLevel": "error" }]`.

The plugin also injects two **RNFirebase Analytics Podfile globals** at **prebuild** (`withDangerousMod` → `withAnalyticsPodfileGlobals`, anchored after `require 'json'`, one tagged block, idempotent + try/catch), both **on by default** (opt-out):

- `analyticsAdSupport` → `$RNFirebaseAnalyticsEnableAdSupport = true` → `RNFBAnalytics.podspec` links `AdSupport.framework` → Firebase Analytics gets IDFA access → audience demographics/interests on iOS (parity with Android). **Privacy:** collects IDFA in production — requires ATT (expo-utils already prompts) + IDFA declared in the privacy manifest / App Store. Default-on because expo-utils is ads-first (AdMob apps already collect IDFA); turn **off** for a no-ads app with `{ "analyticsAdSupport": false }`.
- `analyticsOnDeviceConversion` → `$RNFirebaseAnalyticsGoogleAppMeasurementOnDeviceConversion = true` → podspec adds the `GoogleAdsOnDeviceConversion` pod, resolving the `[FirebaseAnalytics] Failed to initiate on-device conversion measurement... dependency does not support this feature` log. Opt-out with `{ "analyticsOnDeviceConversion": false }`.

**Why the Podfile (not the analytics config plugin):** `@react-native-firebase/analytics` only ships a config plugin in newer RNFirebase — in **v24** (the supported peer range here) it has **no** `app.plugin.js`, so referencing `["@react-native-firebase/analytics", { ... }]` in `app.json` **crashes `expo prebuild`**. The Podfile globals (read by `RNFBAnalytics.podspec`) work on any version. Needs `prebuild --clean` + rebuild to take effect.

The plugin also injects **iOS privacy purpose strings** into the Info.plist at **prebuild** (`withInfoPlist` → `withIosUsageDescriptions`), **on by default**. Common SDKs reference sensitive APIs even when your app never uses them — `expo-image`/`expo-video`/`expo-file-system` and `FBSDKShareKit` reference the Photo Library — so Apple rejects the build with **ITMS-90683** ("Missing purpose string") unless the key is present in the Info.plist (localized `InfoPlist.strings` alone aren't enough for Apple's static check). It adds `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` and `NSCameraUsageDescription` **only if the dev hasn't already set them** (preserves anything in `app.json` `ios.infoPlist`). Per-language translation comes from `expo.locales` (the `languages/*.json` written by `--languages`, mirroring the same three keys, with pt/en/es). Base default text is **English** (neutral fallback for locales without an `.lproj`). Opt out entirely with `{ "usageDescriptions": false }`, or per key: `{ "usageDescriptions": { "NSCameraUsageDescription": false } }` (pass a string to override the default text). **Android has no equivalent** — ITMS-90683 is iOS-only; the Play Store doesn't require purpose strings.

## Common Patterns

### Adding a New CLI Flag

1. Create a `handle*Flag()` function in `bin/install.js`
2. Add flag handling in `main()` function (both in `--new` block and individual flags section)
3. Document the flag in this file and README.md
4. If creating files, add templates to `/templates` directory

### Adding a New Utility Function

1. Add to existing utility files in `/utils` or create a new one
2. Export from `index.ts` if it should be public API
3. Use dynamic imports for any peer dependencies
4. Add proper TypeScript types in `types.ts` or inline

### Modifying app.json via CLI

Use the helper functions in `bin/install.js`:

- `getAppConfig()`: Read current app.json
- `writeAppConfig(config)`: Write back to app.json
- Always check if values exist before adding to avoid duplicates

### Working with Templates

Templates in `/templates` can use placeholders:

- `${androidPackage}` - replaced in google-services.template.json
- `${iosBundleId}` - replaced in GoogleService-Info.template.plist

## Important Notes

### Firebase Integration

- Firebase is **optional** - all Firebase code has null checks
- The package uses Firebase v23+ modular API (getRemoteConfig, getAnalytics, etc.)
- Placeholder files work for development but must be replaced with real configs for production

#### APNS / FCM gate (`Utils.ensureApnsReady`)

iOS push only works once the **APNS token** arrives (a native async callback). All FCM call sites (`requestFCMToken`, `setupMessagingTopics`, `updateRCStatusMessagingTopic`, `setupAttribution`) gate on `Utils.ensureApnsReady()` before calling `getToken`/`subscribeToTopic`, so they never throw "No APNS token specified" / `[messaging/unregistered]`. The gate:
1. **Simulator/emulator skip** — if `expo-device` is installed and `Device.isDevice === false`, it returns `false` immediately **without calling `getAPNSToken`**, so the native DLog spam (`getAPNSToken - Simulator without APNS support`, ~8 lines) drops to ~0 and boot isn't blocked 10s. `expo-device` is an **optional** peer dep (guarded `require` in try/catch → Metro treats it as optional; without it, behaves as a physical device).
2. **Physical device** — polls `getAPNSToken` with backoff (300→2000ms) until the token appears or a 10s timeout. Memoized once per session via `apnsReadyPromise`.

### Premium User Detection

Premium status is checked in two ways:

1. AsyncStorage key `@isPremium` (set by user project)
2. Firebase Remote Config `is_ads_enabled` flag

Both LoadAdsManager and BannerAdComponent respect these checks.

### iOS App Store Review Detection

`Utils.openReviewURL()` automatically:

- Detects iOS App ID via iTunes API lookup using bundle ID
- Falls back to `remoteConfigs.ios_app_id` if lookup fails
- Uses `Application.applicationId` for Android package name
- Supports both native store and browser URLs

### Language/Localization System

The CLI creates `languages/` folder with JSON files per locale that override app.json values (app name, etc.) for each language. This integrates with Expo's built-in localization system.

## Testing Strategy

Since this is a library:

1. Create a test Expo project: `bunx create-expo-app test-project --template default@sdk-55`
2. Build .tgz: `cd /path/to/expo-utils && npm pack`
3. Install in test project: `cd test-project && bun add ../expo-utils/expo-utils-X.X.X.tgz`
4. Run CLI: `bunx expo-utils-install --new`
5. Build iOS: `npx expo run:ios`
6. Verify: Strings.ts, CLAUDE.md, app.json (no updates block, has buildCacheProvider), .gitignore/.easignore (has bun.lock)
