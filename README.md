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



## Backend foundation

A payment-safe backend scaffold now lives in `server/` with a D1 migration in `migrations/0001_backend.sql`.

It is intentionally **not activated in the production Wrangler config yet**, so the current public site cannot charge anyone by accident. `wrangler.backend.example.jsonc` is the ready-to-wire configuration.

The backend includes:

- Shared public spot/sponsor state from D1.
- Server-side minimum-bid validation.
- Atomic D1 spot holds with an expiring checkout window.
- Optimistic spot version checks before payment finalization.
- Booking records and hashed management tokens.
- R2 logo storage with private drafts and public assets only after a paid booking is finalized.
- Payment-event idempotency and a provider adapter boundary.
- Conflict handling that creates a refund-required record instead of stealing a changed spot.
- Takeover refund queue records for the previous sponsor.
- Print-lock enforcement.
- Admin endpoints protected by `ADMIN_SECRET`.
- A disabled test-only paid-booking finalizer for backend QA.
- Public sponsor state and view-count plumbing.
- A same-origin frontend adapter that will automatically read the shared backend once the Worker API is activated.
- Booking/client helper functions for prepare → logo upload → checkout session, while the public submit button remains disabled until payments are connected.

### One-time Cloudflare setup before payment integration

1. Create D1:
   `npx wrangler d1 create protest2-production`
2. Put the returned database ID into a copy of `wrangler.backend.example.jsonc`.
3. Create R2:
   `npx wrangler r2 bucket create protest2-logos`
4. Apply the schema:
   `npx wrangler d1 migrations apply protest2-production --remote`
5. Add secrets:
   `npx wrangler secret put ADMIN_SECRET`
   `npx wrangler secret put VIEW_HASH_SALT`
6. Keep `PAYMENTS_ENABLED=false` and `bookings_open=0` until the real payment adapter and webhook verification are connected and tested.
7. After the bindings exist, replace `wrangler.jsonc` with the backend config values and deploy.
8. Only after payment/refund tests pass should `bookings_open` and `PAYMENTS_ENABLED` be enabled.

The payment-provider-specific code is isolated in `server/payment-provider.mjs`. Real checkout creation, webhook signature verification and provider refund calls should be implemented there without changing the booking/auction consistency layer. The app no longer clears site storage on page load, so future secure booking-management tokens can persist once real checkout is enabled.
