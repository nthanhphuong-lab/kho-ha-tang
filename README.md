# Kho Hạ Tầng — JSON on GitHub + role-based API + Android native

## Architecture
- Static web: GitHub Pages (`web/`)
- API/auth: Cloudflare Worker (`worker/`)
- Persistent data: `data/kho.json` in a GitHub repository
- Android native: Kotlin starter guide in `android/README.md`

**Do not put a GitHub token in browser JavaScript or an APK.** The Worker keeps the GitHub token as a secret and checks roles before writes.

## 1. Create a GitHub data repository
Create a repository, preferably private, e.g. `agu-kho-data`. Add `data/kho.json` with:
```json
{
  "schemaVersion": 1,
  "updatedAt": "",
  "devices": [],
  "movements": [],
  "categories": [
    "Router / Firewall", "Switch mạng", "Access Point Wi-Fi",
    "Thiết bị quang / SFP", "ONT / Modem", "Server / Máy chủ",
    "Lưu trữ NAS / SAN", "UPS / nguồn điện", "Tủ rack / phụ kiện",
    "Cáp mạng / patch cord", "Camera / NVR", "Máy tính / máy trạm",
    "Điện thoại IP", "License / phần mềm", "Công cụ đo kiểm", "Khác"
  ]
}
```
Use a separate repository from the public website repository.

## 2. Deploy API Worker
1. Create/sign in at https://dash.cloudflare.com/ and open Workers & Pages.
2. Create a Worker named `kho-ha-tang-api`.
3. Paste `worker/src/index.js` into its editor and deploy.
4. Settings → Variables and Secrets, add:
   - `GITHUB_TOKEN` (Secret): fine-grained PAT for the data repo only, Contents read/write; minimum repository access.
   - `GITHUB_OWNER` (Text): GitHub username/org that owns the data repo.
   - `GITHUB_REPO` (Text): repository name, e.g. `agu-kho-data`.
   - `GITHUB_BRANCH` (Text): `main`.
   - `DATA_PATH` (Text): `data/kho.json`.
   - `JWT_SECRET` (Secret): a long random secret (at least 32 random bytes).
   - `USERS_JSON` (Secret): JSON array of users with password hashes, see below.
   - `ALLOWED_ORIGINS` (Text): exact GitHub Pages origin, e.g. `https://YOURNAME.github.io`. No path.
5. After changing variables, redeploy/restart Worker as prompted.

### Create password hashes
Use a local terminal with Node.js 18+ in the `worker` folder:
```bash
node tools/hash-password.mjs "YourStrongPassword"
```
Copy the printed PBKDF2 hash into `USERS_JSON`. Example structure:
```json
[
  {"username":"admin","displayName":"Quản trị","role":"admin","salt":"PASTE_SALT","passwordHash":"PASTE_HASH","enabled":true},
  {"username":"thukho","displayName":"Thủ kho","role":"storekeeper","salt":"PASTE_SALT","passwordHash":"PASTE_HASH","enabled":true},
  {"username":"kythuat","displayName":"Kỹ thuật","role":"technician","salt":"PASTE_SALT","passwordHash":"PASTE_HASH","enabled":true},
  {"username":"xem","displayName":"Chỉ xem","role":"viewer","salt":"PASTE_SALT","passwordHash":"PASTE_HASH","enabled":true}
]
```
Run the hash command separately for each user's password and copy the corresponding salt and hash. Do not use the example placeholders. Keep the `USERS_JSON` secret private. Changing passwords means generating and deploying updated user hashes. This starter stores users in a Worker secret; for frequent user administration, move accounts to a proper identity provider/database.

Roles:
- `admin`: full access, manage users through deployment secret, CRUD, movements and categories.
- `storekeeper`: CRUD devices and create movements; cannot manage categories or user accounts.
- `technician`: read devices and create/update technical/device records; no category management. (This starter's API allows device writes.)
- `viewer`: read-only.

## 3. Publish website
1. Upload all contents of `web/` to the root of the GitHub Pages website repository.
2. Edit `web/config.js`: set `API_BASE` to your deployed Worker URL, e.g. `https://kho-ha-tang-api.YOURSUBDOMAIN.workers.dev`.
3. Enable GitHub Pages for the website repository.
4. Test login with the `admin` account configured in `USERS_JSON`.
5. Test each role with separate accounts. Do not use production data until you verify authorization.

## 4. Important data safety
- This starter serializes updates through GitHub's SHA-based file update, with retries for conflicts. GitHub file storage is not designed for high concurrency; if many users write at once, use a database instead.
- Each successful write creates a Git commit, which provides version history. Still, set repository permissions and branch protections appropriately.
- Keep the data repo private if the inventory is confidential. A public JSON file exposes all its contents even if the website requires login.
- Do not store device passwords, API secrets, Wi-Fi PSKs or other credentials in this inventory JSON.
- Configure `ALLOWED_ORIGINS` narrowly. CORS is not authentication; the Worker also validates signed tokens and roles.
- This is a starter implementation, not a certified inventory/accounting system. It does not yet implement approval workflows, immutable audit events, attachment storage, QR printing, or serial-level stock ledgers.

## 5. Android native
Read `android/README.md`. Native app should call the same Worker API and store only the short-lived login token in Android's secure storage. Never include `GITHUB_TOKEN` or `JWT_SECRET` in Android code. Use HTTPS.
