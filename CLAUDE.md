# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`expo-utils` is a CLI tool and utility library that automates 90% of the initial setup for Expo/React Native projects. It provides:

- Automated dependency installation via a custom CLI (`expo-utils-install`)
- Pre-built utilities for ads (AdMob), Firebase integration, internationalization, and analytics
- Template scaffolding for common Expo patterns
- Configuration management for complex integrations (Firebase, RevenueCat, Facebook SDK, etc.)

This is a **library package** that gets installed into user projects, not a standalone application.

## Development Commands

### Building/Testing

- This project has **no build step** - it's distributed as plain TypeScript/JavaScript
- TypeScript is only used for type checking in development
- To test locally, install it in a test Expo project: `npm install /path/to/expo-utils`

### Running the CLI

- Test CLI installation: `node bin/install.js` (from within a test project that has expo-utils installed)
- CLI flags:
    - `--new`: Full setup for new projects (runs all scaffolding with confirmation prompts)
    - `--config`: Add standard plugins to app.json
    - `--layout`: Replace root \_layout.tsx with template
    - `--srcapp`: Move app/ to src/app/
    - `--languages`: Setup i18n with pt/en/es translations
    - `--firebase-placeholders`: Create placeholder Firebase config files
    - `--skadnetwork`: Add SKAdNetwork IDs for iOS
    - `--constants`: Create constants folder and copy Strings.ts template
    - `--eas-config`: Setup EAS Build and Updates configuration
    - `--tracking-permission`: Add iOS tracking transparency permission

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
- `RemoteConfigSettings`: Firebase remote config schema
- `FacebookConfig`: Facebook SDK configuration
- `RevenueCatKeys`: Platform-specific RevenueCat API keys

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

These flags suppress console output from expo-utils in production.

## File Structure

```
/bin
  install.js          # CLI entry point
/constants
  Strings.ts          # AdMob unit ID template
/data
  skadnetwork_ids.json       # iOS SKAdNetwork IDs for ad attribution
  standard_plugins.json       # Default plugin configurations
/templates
  RootLayout.tsx              # Template _layout.tsx with Utils.prepare() call
  index.tsx                   # Basic index screen template
  google-services.template.json    # Android Firebase placeholder
  GoogleService-Info.template.plist # iOS Firebase placeholder
  eas_login.sh                # EAS authentication script
/utils
  Utils.ts            # Core initialization logic
  LoadAdsManager.ts   # Ad display helpers (interstitial, rewarded)
  banner-ad.tsx       # Banner ad React component
  safe-banner-ad.tsx  # Safe banner with error boundaries
  i18n.ts            # Translation system
  styles.ts          # Pre-built StyleSheet helpers
  types.ts           # TypeScript interfaces
  PremiumUtils.ts    # Premium user utilities
  peer-deps.d.ts     # Type definitions for peer dependencies
app.plugin.js        # Expo config plugin (currently minimal)
index.ts            # Main package exports
index.d.ts          # TypeScript declarations
```

## Common Patterns

### Adding a New CLI Flag

1. Create a `handle*Flag()` function in `bin/install.js`
2. Add flag handling in `main()` function
3. Document the flag in README.md
4. If creating files, add templates to `/templates` directory

### Adding a New Utility Function

1. Add to existing utility files in `/utils` or create a new one
2. Export from `index.ts` if it should be public API
3. Use dynamic imports for any peer dependencies
4. Add proper TypeScript types in `types.ts` or inline

### Modifying app.json via CLI

Use the helper functions:

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
- The package uses Firebase v22+ modular API (getRemoteConfig, getAnalytics, etc.)
- Placeholder files work for development but must be replaced with real configs for production

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

1. Create a test Expo project: `npx create-expo-app test-project`
2. Install expo-utils locally: `cd test-project && npm install /path/to/expo-utils`
3. Run CLI: `npx expo-utils-install --new`
4. Test the generated structure, imports, and runtime behavior
5. Verify that ads, Firebase, and other integrations work correctly

## Key Dependencies to Know

- `@expo/config-plugins`: Expo plugin system (used minimally)
- `chalk`: Terminal colors for CLI output
- `react-native-google-mobile-ads`: AdMob integration
- `@react-native-firebase/*`: Firebase modules (all optional)
- `react-native-purchases`: RevenueCat for IAP
- `react-native-fbsdk-next`: Facebook SDK
- `expo-tracking-transparency`: iOS ATT framework

All peer dependencies are listed in package.json with minimum version constraints.
