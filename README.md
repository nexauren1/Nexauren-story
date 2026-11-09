# Nexauren

Plataforma de ferramentas digitais para imagem, PDF, texto e áudio, com conta pessoal, favoritos, blog e catálogo de aplicações Android.

## Stack
- Astro 7 + TypeScript
- React components (client islands)
- Tailwind CSS 4
- Firebase Authentication (Google and email/password)
- Cloud Firestore
- Cloudflare Pages
- pdf-lib for browser-based PDF operations

## Public tools

O catálogo público é definido em src/data/activeTools.json. Só entram no catálogo ferramentas com uma página dedicada e um motor de processamento implementado.

### Image
- **Resize Image** — resize, compress and convert JPG, PNG and WebP; includes social-media presets, custom dimensions, quality control and JPG background.
- **Image Cropper** — crop by pixel coordinates or aspect-ratio presets (1:1, 4:5, 16:9, 3:2); export PNG, JPG or WebP.

### PDF
- **PDF Optimizer** — reserializes document structure using PDF object streams. It does not downsample embedded images, so size reduction depends on the document and is not guaranteed.
- **PDF Merger** — combines multiple PDFs; reorder files before merging.
- **PDF Splitter** — extracts selected pages and ranges, with shortcuts for all, odd, even, first and last pages.
- **PDF Rotator** — rotates all pages or selected page numbers/ranges by 90° left, 90° right or 180°.

### Text
- **Text Toolbox** — word/character/line/paragraph/reading-time statistics plus 14 operations: case conversion, title and sentence case, whitespace and blank-line cleanup, accent removal, line sorting, duplicate removal, line/text reversal, slug generation, find-and-replace and word frequency.

### Audio
- **Audio Cutter** — select and preview a time range, apply fade-in/fade-out and output gain, then export WAV PCM 16-bit.
- **Audio Normalizer** — scan the true sample peak, set a target level and amplification limit, prevent boost when required, choose mono/stereo and export WAV PCM 16-bit.

All public tools process the selected files or text locally in the browser. These tool components do not upload source files to Nexauren servers.

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
- / — home page
- /tools — public catalogue (only verified tools)
- /tools/image, /tools/pdf, /tools/text, /tools/audio — category pages
- /tools/image-resizer, /tools/image-cropper
- /tools/pdf-compressor, /tools/pdf-merger, /tools/pdf-splitter, /tools/pdf-rotator
- /tools/text-toolbox
- /tools/audio-cutter, /tools/audio-normalizer
- /account — account, favorites and activity
- /apps — Android app catalogue
- /blog and individual articles
- /highlights — featured tools and achievements
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
