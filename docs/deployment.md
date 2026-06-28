# Deployment

## Local first run

If `http://127.0.0.1:5174` shows a blank page, the usual cause is that
`web-netlify/.env` does not exist or Firebase values are empty. Vite serves the
HTML file, but the React app cannot finish Firebase initialization.

### 1. Create the Firebase project

1. Open Firebase Console.
2. Create a project, for example `brainok-app`.
3. Enable these products:
   - Authentication
   - Firestore Database
   - Functions
   - Storage
4. In Authentication, enable:
   - Google
   - Email/Password

### 2. Create a Firebase Web App

1. In Firebase Console, open Project settings.
2. In "Your apps", click the Web icon.
3. Register a web app, for example `brainok-web`.
4. Copy the generated config:

   ```ts
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### 3. Create local environment files

From the repository root:

```powershell
Copy-Item web-netlify\.env.example web-netlify\.env
Copy-Item app-electron\.env.example app-electron\.env
Copy-Item firebase-functions\.env.example firebase-functions\.env
Copy-Item .firebaserc.example .firebaserc
```

Fill `web-netlify/.env`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_FUNCTIONS_REGION=asia-northeast3
VITE_USE_FIREBASE_EMULATORS=false
VITE_RELEASES_URL=https://github.com/YOUR_GITHUB_ORG/YOUR_REPO/releases/latest
```

Fill `app-electron/.env` with the same `VITE_FIREBASE_*` values.

Edit `.firebaserc` and replace `brainok-app` with your real Firebase project id.

### 4. Restart the Vite server

Vite reads `.env` only when the dev server starts. After changing `.env`, stop
the server with `Ctrl+C`, then restart it:

```powershell
npm --workspace web-netlify run dev
```

Open:

```text
http://127.0.0.1:5174
```

### 5. If it is still blank

Open Chrome DevTools with `F12`, then check Console. The most common messages are:

- `Firebase: Error (auth/invalid-api-key)`: `VITE_FIREBASE_API_KEY` is wrong or empty.
- `auth/unauthorized-domain`: add `127.0.0.1` and your Netlify domain to Firebase Auth authorized domains.
- `functions/internal`: Functions are not deployed yet or the region is wrong.

## Firebase

1. Create a Firebase project.
2. Enable Auth providers:
   - Google
   - Email/Password
3. Create Firestore in production mode.
4. Enable Functions and Storage.
5. Copy `.firebaserc.example` to `.firebaserc` and set the project id.
6. Sign in with the local Firebase CLI:

   ```bash
   npx firebase login
   npx firebase use braionk-lab
   ```

7. Deploy rules:

   ```bash
   npm run deploy:rules
   ```

8. Set the Lemon Squeezy signing secret:

   ```bash
   npx firebase functions:secrets:set LEMONSQUEEZY_WEBHOOK_SECRET
   ```

9. Set the QnA email password secret. For Gmail, use an app password, not the account password:

   ```bash
   npx firebase functions:secrets:set QNA_SMTP_PASSWORD
   ```

10. Add `LEMONSQUEEZY_CHECKOUT_URL` and QnA SMTP settings to `firebase-functions/.env`.
11. Deploy functions:

   ```bash
   npm run deploy:functions
   ```

12. Seed your first invite admin account:

   - Sign in once on the website with `brainok777@gmail.com`.
   - Open Firestore > `users/{yourUid}`.
   - Confirm `accountRole` is `"admin"`.
   - Set `accessStatus` to `"active"`.
   - Set `inviteQuota` to a number such as `50`.

   After that, use the Apps tab on the website to edit site settings, create apps,
   upload release files, and create invite codes.

## Netlify

Set the build base to `web-netlify`.

Build command:

```bash
npm run build
```

Publish directory:

```text
web-netlify/dist
```

Add the same `VITE_FIREBASE_*` environment variables used by the Electron renderer.

## Electron release

1. Set real `appId`, `productName`, GitHub `owner`, and GitHub `repo` in `app-electron/package.json`.
2. Add Firebase client values to `app-electron/.env`.
3. Build:

   ```bash
   npm --workspace app-electron run dist
   ```

4. Upload `app-electron/release` artifacts to GitHub Releases or configure electron-builder publishing.
