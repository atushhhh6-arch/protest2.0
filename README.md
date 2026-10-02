# Protest 2.0

Complete static website for Ayush's independent T-shirt sponsorship project, including the front/back image, X profile image, interactive placements, and all four policy pages.

## Run and build

Use Node.js 22.16.0 or a compatible newer version. No external packages are required.

```sh
npm install
npm run build
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080. Edit the website files in `public/` and rebuild to update `dist/`.

## Deploy

Build command: `npm run build`  
Static output directory: `dist`

The included `wrangler.jsonc` keeps the Cloudflare project name `protest2-0` and serves `dist/`. All pages and assets can also be served by any static host. Keep the directory structure intact.

## Files

- `public/index.html`: main website.
- `public/styles.css`: responsive styling and placement overlays.
- `public/app.js` and `public/auction-core.mjs`: placement interactions and pricing.
- `public/assets/`: full front/back portrait and X profile image.
- `public/terms.html`, `public/privacy.html`, `public/refund-policy.html`, `public/content-policy.html`: policy pages.

## Checkout status

Real payment checkout is not connected in this version. The active **Pay (test)** button completes a browser-local test transaction, shows a success receipt and applies the brand; it never collects money or reserves a real spot. No payment processor, shared auction database, or automated refund service is connected. Connect and verify those services before enabling real purchases.

This repository replaces the previous website implementation with the latest complete Site source (source revision `6fd6d3c525a18766a4ec85f7bb4a3c01f40406c2`).

## Brand profiles and test checkout

Choose an empty spot, enter your brand details and use **Pay (test)**. The brand is applied in this browser without charging money. Your profile appears in the header. Clicking an occupied logo on the T-shirt or poster wall opens a separate sponsor profile with website and X links, active placements, and transaction history. Use **Take over** in that profile to open the bidding form.

The logo editor supports dragging, mouse-wheel zoom, two-finger pinch, keyboard movement and zoom, and Fit/Fill controls. The wall shows clickable logos as scattered posters.

**Reset promos** in the footer clears all local profiles, placements and transaction history after confirmation. Test data stays in that browser; real payments and shared bookings require a connected backend.
