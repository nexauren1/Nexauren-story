# Nexauren

Ferramentas online para imagem, PDF, áudio e texto, com conta pessoal para favoritos e histórico.

## Stack
- Astro 7 + TypeScript
- React islands
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages
- pdf-lib for local PDF structure optimization

## Current tools
- Image Resizer: resize and convert images to JPG, PNG or WebP with a quality setting. Processing runs in the browser.
- PDF Compressor: reserializes PDF objects using object streams in the browser. This version does not downsample embedded images, so file-size reduction depends on each document and is not guaranteed.
- Audio Cutter: trim a selected time range and export uncompressed WAV audio in the browser.

The tools page also lists planned text and document utilities. Items marked "Em breve" are not yet active.

## Account features
- Firebase sign-in with Google or email/password.
- Password reset by email.
- User profile synchronization in `users/{uid}`.
- User-scoped favourites and recent activity in Firestore.

## Local development
Requires Node.js 24.12.0 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Fill the `PUBLIC_FIREBASE_*` values in `.env` with the Firebase Web app configuration.

## Cloudflare Pages
- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: 24.12.0 or newer

Add the `PUBLIC_FIREBASE_*` values as build environment variables in Cloudflare Pages. The repository is configured for automatic builds on pushes to `main`; a successful GitHub build does not by itself prove that the Cloudflare deployment or custom domain is active.

## Firebase setup
- Project ID: `nexauren-story-e8327`
- Firestore location: `africa-south1`
- Authentication providers: Google and Email/Password

1. Publish the repository's `firestore.rules` in Cloud Firestore.
2. In Firebase Console, open Authentication → Settings → Authorized domains.
3. Add each production hostname without `https://` or a path: `nexaurenstory.com` and `www.nexaurenstory.com`.
4. Also add the exact Cloudflare Pages hostname (the `*.pages.dev` address shown in the Pages project) if you use that address for testing or login.
5. Confirm Google and Email/Password are enabled under Authentication → Sign-in method.

Never place service-account keys in browser code.

## Routes
- `/` — tools home and account panel
- `/tools` — searchable categories of online tools
- `/tools/image-resizer` — image resizing and conversion
- `/tools/pdf-compressor` — structural PDF optimization
- `/tools/audio-cutter` — audio trimming and WAV export
- `/apps` — Android application catalogue
- `/blog` — blog landing page
- `/privacy` — privacy information
- `/terms` — terms of use
