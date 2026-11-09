# Nexauren

Plataforma de ferramentas digitais para imagem, PDF, texto e áudio, com uma área de conta pessoal.

## Stack
- Astro 7 + TypeScript
- React components (client islands)
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages
- pdf-lib for browser-based PDF operations

## Active tools

### Images
- **Image Studio** — resize, compress and convert JPG, PNG and WebP, with dimensions, quality and output format controls.
- **Image Cropper** — crop by pixel coordinates and export PNG, JPG or WebP.

### PDF
- **PDF Optimizer** — reserializes document structure using PDF object streams. It does not downsample embedded images, so size reduction depends on the document and is not guaranteed.
- **PDF Merger** — combines multiple PDFs in the selected order.
- **PDF Splitter** — extracts selected pages and page ranges into a new PDF.
- **PDF Rotator** — changes the page rotation for all pages or one selected page.

### Text
- **Text Toolbox** — live word/character/line statistics, uppercase, lowercase, title case, whitespace cleanup, alphabetical line sorting, duplicate-line removal and reverse line order. Copy or download the output as TXT.

### Audio
- **Audio Cutter** — select a time range, preview the segment and export WAV PCM 16-bit.
- **Audio Normalizer** — analyse peak level, set a target peak and export WAV PCM 16-bit.

All the tools above process the selected files locally in the browser. The files are not uploaded to Nexauren's server by these tool components.

## Account and synchronization
- Firebase sign-in with Google or email/password.
- Browser-local session persistence.
- User profiles stored under `users/{uid}`.
- Favorites and recent tool activity stored in user-scoped Firestore subcollections.
- Account dashboard and favorite buttons use Firestore real-time listeners, so remote changes can appear while the user is signed in.
- To see the same data on multiple devices, sign in with the same Firebase account (the same Firebase UID) on each device. A browser session itself is not shared between devices.
- If Google and email/password were created as separate Firebase identities, those identities need to be linked in Firebase Authentication before their data can be shared under one UID.

## Local development

Requires Node.js 24.12.0 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Set the `PUBLIC_FIREBASE_*` variables in `.env` using the Firebase Web app configuration.

## Cloudflare Pages

- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `24.12.0` or newer
- Add all `PUBLIC_FIREBASE_*` variables as Cloudflare Pages build environment variables.
- Confirm the production branch is `main` and that automatic deployments are enabled.
- A green GitHub Actions build confirms the repository compiles; it does not prove that Cloudflare Pages has deployed the commit or that the custom domain is serving it.

## Firebase setup

- Project ID: `nexauren-story-e8327`
- Firestore location: `africa-south1`

1. Publish `firestore.rules` in Cloud Firestore.
2. Enable Google and Email/Password under Authentication → Sign-in method.
3. Add `nexaurenstory.com` and `www.nexaurenstory.com` under Authentication → Settings → Authorized domains.
4. Add the exact Cloudflare Pages `*.pages.dev` hostname if it is used for testing or sign-in.
5. Verify Firestore security rules allow an authenticated user to read and write only their own `users/{uid}` data.

Never place service-account keys in browser code or commit them to this repository.

## Routes

- `/` — redesigned tools home
- `/tools` — tools directory
- `/tools/image`, `/tools/pdf`, `/tools/text`, `/tools/audio` — category pages
- `/tools/image-resizer`, `/tools/image-cropper`
- `/tools/pdf-compressor`, `/tools/pdf-merger`, `/tools/pdf-splitter`, `/tools/pdf-rotator`
- `/tools/text-toolbox`
- `/tools/audio-cutter`, `/tools/audio-normalizer`
- `/account` — account, favorites and activity
- `/apps` — Android app catalogue
- `/blog` and individual guide articles
- `/privacy`, `/terms`
