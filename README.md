# Nexauren Story Story

Portal de ferramentas online gratuitas e conteúdo tecnológico, com conta pessoal, favoritos, blog e catálogo de aplicações Android.

## Stack
- Astro 7 + TypeScript
- React components (client islands)
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages
- pdf-lib for browser-based PDF operations

## Public tools

O catálogo público tem **50 ferramentas activas**, distribuídas por quatro categorias. Cada ferramenta tem uma página dedicada e operações próprias; os cartões só são publicados depois de existir um motor de processamento.

### Image — 10 tools
- Resize image; crop image; image watermark; rotate and flip image.
- Image information; grayscale conversion; colour inversion; image format conversion; horizontal flip; image-to-Base64.

### PDF — 13 tools
- PDF optimiser; merge PDFs; split PDFs; rotate PDFs; PDF inspection.
- Page count; metadata viewer; extract page ranges; remove pages; reorder pages; rotate pages; duplicate pages; clear metadata.

### Text — 18 tools
- Text toolbox; text case converter; find and replace.
- Uppercase; lowercase; title case; clean spaces and lines; sort lines; remove duplicate lines; reverse lines; URL slug; Base64 encode/decode; URL encode/decode; JSON formatter/minifier; CSV to JSON.

### Audio — 9 tools
- Audio cutter; volume normaliser; audio information; silence trimming; gain adjustment; fade-in; fade-out; reverse audio; speed adjustment.

The image, PDF, audio and text operations run in the browser. Tool descriptions state format and output limitations; file processing does not upload source files to Nexauren servers.

## Languages
- English is the default language for first-time visitors; Portuguese is the secondary language.
- The language selector is available in the desktop header and mobile menu.
- The selected language is saved in the browser and applied across navigation, tool pages, descriptions, controls, account screens and legal information.
- Articles written by site administrators remain in their original publishing language.

## Catalogue rules

- src/data/activeTools.json is the source of truth for public tool and category cards.
- Every public tool must have a dedicated Astro page at the exact path declared in that file.
- The wider src/data/toolCatalog.json is retained for future development, but its entries are not advertised as live tools until they have a dedicated, tested page.
- npm run check:catalog validates IDs, categories and the presence of each dedicated page.
- scripts/verify-output.mjs validates generated tool pages, catalogue links, sitemap entries and private admin exclusion.

## Account and synchronization
- Firebase sign-in with Google or email/password.
- Browser-local session persistence.
- User profiles stored under users/{uid}.
- Favorites and recent tool activity stored in user-scoped Firestore subcollections.
- Account dashboard and favorite buttons use Firestore real-time listeners.
- Use the same Firebase account (the same Firebase UID) on each device to see synchronized data.
- If Google and email/password were created as separate Firebase identities, those identities need to be linked in Firebase Authentication before their data can be shared under one UID.

## Local development

Requires Node.js 24.12.0 or newer.

    npm install
    cp .env.example .env
    npm run dev

Set the PUBLIC_FIREBASE_* variables in .env using the Firebase Web app configuration.

## Cloudflare Pages
- Framework preset: Astro
- Build command: npm run build
- Build output directory: dist
- Node.js version: 24.12.0 or newer
- Add all PUBLIC_FIREBASE_* variables as Cloudflare Pages build environment variables.
- Production branch: main
- A successful build does not replace testing the deployed domain and tool pages.

## Routes
- / — bilingual home page (English default, Portuguese available)
- /tools — searchable public catalogue with category filters
- /tools/image, /tools/pdf, /tools/text, /tools/audio — category pages
- 50 dedicated tool pages across image, PDF, text and audio categories
- /account — account, favorites and activity
- /apps — Android app catalogue
- /blog and individual articles
- /about and /contact — public information pages
- /privacy, /terms
- /nexauren-control — private editorial admin page; excluded from indexing

## Firebase setup
- Project ID: nexauren-story-e8327
- Firestore location: africa-south1

1. Publish firestore.rules in Cloud Firestore.
2. Enable Google and Email/Password under Authentication → Sign-in method.
3. Add nexaurenstory.com and www.nexaurenstory.com under Authentication → Settings → Authorized domains.
4. Add the exact Cloudflare Pages *.pages.dev hostname if it is used for testing or sign-in.
5. Verify Firestore security rules allow an authenticated user to read and write only their own users/{uid} data.

Never place service-account keys in browser code or commit them to this repository.
