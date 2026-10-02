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

Real payment checkout is not connected in this version. The development checkout applies a sponsorship locally so the logo, profile, wall, auction lists and takeover rules can be tested; it never collects money or creates a verified real booking. No payment processor, shared auction database, cross-visitor real-time synchronization, or automated refund service is connected. Connect and verify those services before enabling real purchases.

This repository preserves the existing T-shirt photos, placement geometry, pricing and direct-manipulation logo editor.

## Brand profiles and development flow

Choose an empty spot, enter the brand details, upload/adjust the logo and apply the development placement. The header action always stays **My Profile**. That account screen separately lists saved brand details, active positions, sponsorship amounts and transaction/takeover history, and supports editing saved profiles.

Clicking an occupied logo opens a compact public sponsor card with its placement, recorded device-local views, logo, brand name, linked X handle when supplied, description, website, sponsorship amount and takeover action. The bidding form opens only after choosing that takeover action.

The logo editor supports dragging, mouse-wheel zoom, two-finger pinch, keyboard movement and zoom, and Fit/Fill controls. The logo wall remains a clean grid, while front and back auction lists stay separate and update immediately after a local claim or takeover.

**Reset promos** clears this site's sponsorship-owned local and session state, including current spot owners/logos, saved/selected profiles, placement and takeover history, simulated refund records, recorded views, pending form/editor state, and known legacy Protest 2.0 storage keys. It does not clear unrelated browser data. Reset changes synchronize across open tabs of the same origin through browser storage events and BroadcastChannel where available.

Shared state between different visitors is still not connected. A backend/database is required before different browsers can see the same sponsorships, global view counts, live bookings, payments or refunds.

