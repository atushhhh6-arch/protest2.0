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

Real payment checkout is not connected yet. The public form is intentionally non-booking: it can be used to review placement details and prepare artwork, but it does not charge money, reserve a spot, or create a confirmed sponsorship. Before enabling purchases, connect a shared backend/database, payment provider, verified webhooks, takeover locking, refund handling, and a production support process.

## Brand profiles and pre-launch flow

Visitors can inspect the 12 placements and prepare brand details and artwork, but the pre-launch submit action is disabled until real checkout is connected. The sponsor wall, profiles and account views are intended to be driven by verified shared booking data once the backend is live.

Clicking an occupied logo opens a compact public sponsor card with its placement, recorded device-local views, logo, brand name, linked X handle when supplied, description, website, sponsorship amount and takeover action. The bidding form opens only after choosing that takeover action.

The logo editor supports dragging, mouse-wheel zoom, two-finger pinch, keyboard movement and zoom, and Fit/Fill controls. The logo wall remains a clean grid, while front and back auction lists stay separate and update immediately after a local claim or takeover.

The public reset control and local mock-booking workflow have been removed from the live interface.

Shared state between different visitors is still not connected. A backend/database is required before different browsers can see the same sponsorships, global view counts, live bookings, payments or refunds.

