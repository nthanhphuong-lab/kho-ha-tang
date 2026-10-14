# Android native — Kotlin + Jetpack Compose

This is the implementation plan for the native Android companion. It calls the same Cloudflare Worker API as the web app. Do not embed the GitHub token in Android.

## 1. Create project
1. Install the latest stable Android Studio.
2. New Project → Empty Activity (Jetpack Compose), Kotlin.
3. Minimum SDK: API 26 or newer.
4. Package example: `vn.edu.agu.khohang`.

## 2. Add network permission
In `app/src/main/AndroidManifest.xml`, inside `<manifest>` and before `<application>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```
Use HTTPS Worker URL only.

## 3. Dependencies
In `app/build.gradle.kts`, add current stable versions from Android Studio's version catalog / official docs:
- `androidx.lifecycle:lifecycle-viewmodel-compose`
- `androidx.navigation:navigation-compose`
- `com.squareup.retrofit2:retrofit`
- `com.squareup.retrofit2:converter-moshi`
- `com.squareup.okhttp3:okhttp`
- `androidx.security:security-crypto` (or the current recommended Android secure storage option)

Do not paste old version numbers blindly; use the latest compatible stable versions offered by Android Studio.

## 4. API contract
Base URL: your deployed Worker URL.
- `POST /api/login` JSON `{ "username": "...", "password": "..." }` → `{ "token": "...", "user": {"username":"...","displayName":"...","role":"storekeeper"} }`
- Authenticated `GET /api/state` → `{ "schemaVersion":1, "devices":[], "movements":[], "categories":[] }`
- `POST /api/devices`, `PUT /api/devices/{id}`, `DELETE /api/devices/{id}`
- `POST /api/movements`
- `POST|PUT|DELETE /api/categories` (admin only)
Send `Authorization: Bearer <token>` on protected endpoints.

## 5. Recommended app screens
- Login
- Dashboard / counts
- Device list + search/filter
- Device detail + edit
- Create inbound/outbound/return/transfer slip
- Report and CSV export
- Category management (admin only)
- Profile / logout

## 6. Role mapping
- admin: all actions
- storekeeper: devices and warehouse slips
- technician: device records, technical fields; no category/user admin
- viewer: read-only

The Worker is authoritative for permissions; hiding buttons in the app is only a UI convenience.

## 7. Before releasing APK
- Store tokens in encrypted/secure storage; never log passwords/tokens.
- Add token expiry handling and logout.
- Test every role against the API, not just UI.
- Test slow network, API errors, duplicate asset code, insufficient stock and concurrent updates.
- Add QR/barcode scanning, file/photo attachments and offline sync only after core flows are stable.
