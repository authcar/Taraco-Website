# Taraco Design — website

Static site, no build step.

## Publish with GitHub Pages
1. Upload all files in this folder to the root of a new repository.
2. Settings → Pages → Source: "Deploy from a branch" → `main` / `(root)` → Save.
3. Live in ~1–2 minutes at `https://<username>.github.io/<repo>/`.

## Files
- `index.html` — the site (Home, Portfolio, Studio, Contact)
- `taraco-scenes.js` — 3D hero room + rotating island (three.js, loaded from unpkg)
- `support.js` — page runtime
- `image-slot.js` — photo placeholders

## Before going live
- Replace photo placeholders with real image files (e.g. an `images/` folder).
- Connect the enquiry form (WhatsApp / email) — it currently only shows a thank-you message.
