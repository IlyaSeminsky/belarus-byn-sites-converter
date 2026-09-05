# Chrome Web Store CI/CD — one-time setup

This is done **once, by hand**. Google's API cannot create a brand-new
store listing or a Google Cloud project — a human has to. Everything
after this is automatic on every push to `main`
(see `.github/workflows/publish-chrome-webstore.yml`).

## 1. Create the store listing (manual, dashboard only)

1. Zip the extension yourself once: `manifest.json`, `background.js`,
   `content.js`, `options.html`, `options.js`, `options.css`, `icons/`.
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
   click **New item**, upload that zip.
3. Fill in the **Store listing** and **Privacy** tabs (description,
   screenshots, category, and the privacy practices — point it at
   `PRIVACY.md` / `README.md`), then submit for the first review.
4. Once the item exists, copy the **extension ID** from the dashboard
   URL (`.../detail/<EXTENSION_ID>/edit`).
5. Copy your **publisher ID** from **Account → Publisher settings**.

CI can update this listing from now on, but it cannot create it and it
cannot edit the store-listing text/screenshots — only ship new code
versions.

## 2. Create a Google Cloud OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), create
   (or reuse) a project.
2. **APIs & Services → Library** — enable **Chrome Web Store API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App info: any name/contact email is fine (only you will ever
     authorize it).
   - Scopes: add `https://www.googleapis.com/auth/chromewebstore`.
   - Add your own Google account as a test user.
   - **Publish the app to "In production"** once configured. This step
     matters: while the consent screen stays in **Testing**, Google
     expires the refresh token after 7 days, which would silently break
     the pipeline every week. "In production" gives a refresh token
     that keeps working indefinitely (until revoked or unused for 6
     months). You may see an "unverified app" warning when you
     authorize in step 3 below — that's expected for a single-user tool
     and safe to click through, since you are the only person who will
     ever consent.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `https://developers.google.com/oauthplayground`.
   - Save the generated **Client ID** and **Client secret**.

## 3. Generate a refresh token

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon → check **Use your own OAuth credentials** →
   paste your Client ID / Client secret.
3. In the scopes box, enter `https://www.googleapis.com/auth/chromewebstore`,
   click **Authorize APIs**, sign in with the account that owns the
   Chrome Web Store listing.
4. Click **Exchange authorization code for tokens**.
5. Copy the **Refresh token** shown. (The access token shown alongside
   it expires in an hour and is not needed — the CI workflow requests
   fresh access tokens itself using the refresh token.)

## 4. Add the GitHub repo secrets

**Repo → Settings → Secrets and variables → Actions → New repository secret.**
Add all five:

| Secret name | Value |
|---|---|
| `CHROME_CLIENT_ID` | OAuth client ID from step 2 |
| `CHROME_CLIENT_SECRET` | OAuth client secret from step 2 |
| `CHROME_REFRESH_TOKEN` | Refresh token from step 3 |
| `CHROME_PUBLISHER_ID` | Publisher ID from step 1.5 |
| `CHROME_EXTENSION_ID` | Extension ID from step 1.4 |

## 5. Day-to-day workflow after this

- Every PR that changes extension code **must bump `version` in
  `public/manifest.json`** (e.g. `1.5` → `1.6`). The workflow fails the
  build if it doesn't, since the Chrome Web Store rejects re-uploading an
  unchanged version.
- On merge to `main`, GitHub Actions builds and zips the extension, uploads it,
  and **publishes it live immediately** — no manual approval step, per
  your choice. Google's own review queue still runs after that (usually
  minutes to a few days for a listed extension); until it clears, the
  new version is "Pending review" and existing users keep the old one.
- If you'd rather have CI upload a draft and publish yourself from the
  dashboard, drop `--auto-publish`-equivalent behavior by splitting the
  workflow's upload step into `upload` then a separate manual `publish`
  run — ask and I'll switch it.

## Rotation / expiry notes

- Refresh token: effectively indefinite once the app is "In
  production", but Google invalidates it if unused for 6 months or if
  you revoke access in your Google Account's
  [connected apps](https://myaccount.google.com/connections) page.
- If the token ever stops working, redo step 3 only and update the
  `CHROME_REFRESH_TOKEN` secret.
