# Nexauren Story

Premium digital ecosystem for Nexauren apps, browser tools and technology articles.

## Stack
- Astro 7 + TypeScript
- React islands
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages

## Current features
- Public Android app catalogue with links to the APKPure listings.
- Firebase account registration and sign-in with Google or email/password.
- Password reset by email.
- User profile synchronization in `users/{uid}`.
- User-scoped favourites and recent activity in Firestore.
- Dark/light theme and responsive layouts.

## Local development
This project requires Node.js 24.12.0 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Fill the `PUBLIC_FIREBASE_*` values in `.env` using the Firebase Web app configuration.

## Cloudflare Pages
- Framework preset: Astro
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: 24.12.0 or newer

Set the Pages build environment to Node 24.12.0 or newer. Add the `PUBLIC_FIREBASE_*` values as build environment variables.

## Firebase
- Project ID: `nexauren-story-e8327`
- Firestore location: `africa-south1`
- Authentication providers: Google and Email/Password

Publish the repository's `firestore.rules` to Cloud Firestore before enabling account features. Add the production domain and the Cloudflare Pages `pages.dev` hostname to Firebase Authentication's authorized domains. Never place service-account keys in browser code.

## Routes
- `/` — home and account panel
- `/apps` — application catalogue
- `/tools` — browser utilities (catalogue in preparation)
- `/blog` — articles and guides (catalogue in preparation)
- `/privacy` — privacy information
- `/terms` — terms of use
