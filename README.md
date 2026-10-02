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

Payment checkout is closed in this version. Exploring a placement or preparing a logo does not reserve a spot or collect money. No payment processor, shared auction database, or automated refund service is connected. Connect and verify those services before enabling real purchases.

This repository replaces the previous website implementation with the latest complete Site source (source revision `6fd6d3c525a18766a4ec85f7bb4a3c01f40406c2`).

## Moderator preview

Use **Moderator** in the footer, select a spot, and choose **Set a brand** or **Try example brand**. Apply the preview to see the logo on the shirt. Reopen an occupied spot to test a takeover at twice its previous amount.

The panel can reset a selected spot, all spots, the saved form profile, or everything. **Run checks** verifies pricing, takeovers, reset behavior, image loading and browser storage. All preview records stay in that browser; these controls are not an authenticated live administration service. Exit preview to return to the public view. Real checkout remains closed.
