// Render the real FinInvest LogoMark (from lib/core/widgets/app_logo.dart) into launcher-icon
// source PNGs. Run: node tool/gen_icons.js  (uses sharp from the repo root node_modules).
const path = require('path');
const sharp = require(path.join('C:/Users/JONIBEK/Desktop/fininvest/node_modules/sharp'));

const GRAD = `<linearGradient id="g" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
  <stop stop-color="#38BDF8"/><stop offset="1" stop-color="#0369A1"/></linearGradient>`;
const BARS = `
  <rect x="10.5" y="23.5" width="3.4" height="6" rx="1.2" fill="#fff" fill-opacity="0.45"/>
  <rect x="18.3" y="20" width="3.4" height="9.5" rx="1.2" fill="#fff" fill-opacity="0.6"/>
  <rect x="26.1" y="16" width="3.4" height="13.5" rx="1.2" fill="#fff" fill-opacity="0.75"/>
  <path d="M11 24.5 L18 19 L23 22 L29.5 12.5" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M24.8 12.6 L30 12 L29.4 17.2" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 40 40"><defs>${GRAD}</defs>${inner}</svg>`;

// Full badge — legacy Android + iOS icon (image_path).
const full = wrap(`<rect width="40" height="40" rx="11" fill="url(#g)"/>${BARS}`);
// Adaptive background — full-bleed gradient (the launcher applies the mask/rounding).
const bg = wrap(`<rect width="40" height="40" fill="url(#g)"/>`);
// Adaptive foreground — white bars+line only, scaled into the centre safe zone, transparent.
const fg = wrap(`<g transform="translate(20 20) scale(0.62) translate(-20 -20)">${BARS}</g>`);

const dir = 'C:/Users/JONIBEK/Desktop/fininvest/apps/mobile/assets/images';
(async () => {
  await sharp(Buffer.from(full)).png().toFile(path.join(dir, 'logo.png'));
  await sharp(Buffer.from(bg)).png().toFile(path.join(dir, 'logo_bg.png'));
  await sharp(Buffer.from(fg)).png().toFile(path.join(dir, 'logo_foreground.png'));
  console.log('OK: logo.png, logo_bg.png, logo_foreground.png (1024x1024)');
})().catch((e) => { console.error(e); process.exit(1); });
