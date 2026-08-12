Place your uploaded ACADEXA logo file(s) in this folder so the frontend and email templates can use them.

Recommended filenames:
- acadexa-logo.png           — primary logo (used by frontend at `/assets/acadexa-logo.png`)
- acadexa-logo-dark.png      — optional dark-background variant
- acadexa-logo-light.png     — optional light-background (white) variant

How to use:
- If you put `acadexa-logo.png` here, the frontend already loads `/assets/acadexa-logo.png`.
- For emails, set `APP_LOGO_URL` in the backend environment to a CDN URL or leave it unset to use `/assets/acadexa-logo.png`.

Notes:
- Prefer transparent PNG or SVG for best results across themes.
- After adding the files, restart the dev server or rebuild the frontend.
