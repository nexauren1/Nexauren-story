# Nexauren Story
Premium digital ecosystem for Nexauren apps, browser tools and technology articles.

## Stack
- Astro 7 + TypeScript
- React islands
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages

## Local development
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
- Node.js: 22+

Add the `PUBLIC_FIREBASE_*` values to Cloudflare Pages environment variables before enabling account features in production.

## Firebase
Project ID: `nexauren-story-e8327`
Firestore location: `africa-south1`
Google and Email/Password providers are enabled. Deploy restrictive Firestore Security Rules before storing user data. Never place service-account keys in browser code.

## Planned routes
- `/apps` — application catalogue
- `/tools` — browser utilities
- `/blog` — articles and guides
- `/account` — user account area
