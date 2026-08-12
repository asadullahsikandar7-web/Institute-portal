Place your uploaded ACADEXA logo file into the frontend assets folder so the app and email templates can use it.

Recommended path (frontend):
- `src/assets/acadexa-logo.png`

Optional CDN / backend usage:
- Upload the logo to a CDN or static hosting and set environment variable `APP_LOGO_URL` in the backend (used by email templates).

Notes and tips:
- Prefer a transparent PNG or SVG so it looks good on both dark and light backgrounds.
- Provide a light (white) and a dark (colored) variant if possible: name them `acadexa-logo-dark.png` and `acadexa-logo-light.png` and adjust `APP_LOGO_URL` to point to the best variant for emails.
- The frontend already attempts to load `/assets/acadexa-logo.png` in the sidebar and emails use `APP_LOGO_URL`.
- If the image is not present, the UI falls back to an icon.

Note: I can place the logo you just uploaded into `public/assets/acadexa-logo.png` for you. Reply "yes" and I'll add it to the repo (or tell me a different target path).

After adding the file, rebuild the frontend (Vite) or redeploy. Example local dev command:

```bash
# from workspace root
npm run dev
# or (backend)
cd backend && npm run dev
```
