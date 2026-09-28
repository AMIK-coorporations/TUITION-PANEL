#!/usr/bin/env node
// ============================================================
// make-logo.mjs - regenerate the transparent app logo + favicons
// from "APP LOGO.png" (project root).
//
//   public/logo.png        transparent logo, max 512px (used across the app)
//   public/favicon.svg     SVG favicon embedding the transparent logo
//   public/favicon-32.png  32px PNG favicon (browsers without SVG support)
//
// Zero dependencies - pure Node (zlib only). Wired as predev/prebuild in
// package.json, so it runs automatically on `npm run dev` / `npm run build`.
// It NEVER fails the build: any problem is logged and the process exits 0,
// keeping whatever favicon files already exist.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync, deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'APP LOGO.png');
const PUB = join(ROOT, 'public');

// Background removal tolerance. Higher = removes more (can eat into the logo).
// Only pixels reachable from the border are considered, so white shapes INSIDE
// the logo are never punched out.
const TOL = 48;

// ---------------- PNG decode (8-bit, non-interlaced) ----------------
function decodePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG file');
  let off = 8;
  let ihdr = null;
  const idat = [];
  let plte = null;
  let trns = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('missing IHDR chunk');
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG is not supported');
  if (ihdr.depth !== 8) throw new Error(`bit depth ${ihdr.depth} is not supported (only 8)`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!ch) throw new Error(`PNG color type ${ihdr.color} is not supported`);
  if (ihdr.color === 3 && !plte) throw new Error('palette PNG is missing PLTE');

  const raw = inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const bpp = ch; // bytes per pixel (depth is 8)
  const stride = w * bpp;
  const img = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = y * stride;
    const prev = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? img[cur + x - bpp] : 0;
      const b = y > 0 ? img[prev + x] : 0;
      const c = y > 0 && x >= bpp ? img[prev + x - bpp] : 0;
      let v = line[x];
      switch (ft) {
        case 0: break;
        case 1: v = (v + a) & 255; break;
        case 2: v = (v + b) & 255; break;
        case 3: v = (v + ((a + b) >> 1)) & 255; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
        default: throw new Error(`bad scanline filter ${ft}`);
      }
      img[cur + x] = v;
    }
  }

  const rgba = Buffer.alloc(w * h * 4);
  if (ihdr.color === 6) {
    img.copy(rgba);
  } else {
    for (let i = 0; i < w * h; i++) {
      if (ihdr.color === 2) {
        rgba[i * 4] = img[i * 3];
        rgba[i * 4 + 1] = img[i * 3 + 1];
        rgba[i * 4 + 2] = img[i * 3 + 2];
        rgba[i * 4 + 3] = 255;
      } else if (ihdr.color === 0) {
        const g = img[i];
        rgba[i * 4] = g;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = g;
        rgba[i * 4 + 3] = 255;
      } else if (ihdr.color === 4) {
        const g = img[i * 2];
        rgba[i * 4] = g;
        rgba[i * 4 + 1] = g;
        rgba[i * 4 + 2] = g;
        rgba[i * 4 + 3] = img[i * 2 + 1];
      } else if (ihdr.color === 3) {
        const idx = img[i];
        const o = idx * 3;
        if (o + 2 >= plte.length) throw new Error('palette index out of range');
        rgba[i * 4] = plte[o];
        rgba[i * 4 + 1] = plte[o + 1];
        rgba[i * 4 + 2] = plte[o + 2];
        rgba[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
  }
  return { w, h, rgba };
}

// ---------------- Make the background transparent ----------------
// Flood fill from the border. A pixel joins the background only if it is
// within TOL of the top-left corner colour, so interior shapes of a similar
// colour (white text, etc.) stay untouched. Skipped entirely if the image is
// already transparent or fewer than 2 corners agree on the background colour
// (which would risk eating the logo itself).
function makeTransparent({ w, h, rgba }) {
  const corners = [0, w - 1, (h - 1) * w, w * h - 1];
  const sr = rgba[corners[0] * 4];
  const sg = rgba[corners[0] * 4 + 1];
  const sb = rgba[corners[0] * 4 + 2];
  const sa = rgba[corners[0] * 4 + 3];
  if (sa < 8) return { w, h, rgba, changed: false }; // already transparent

  const tol2 = TOL * TOL * 3;
  const nearSeed = (i) => {
    const o = i * 4;
    const dr = rgba[o] - sr;
    const dg = rgba[o + 1] - sg;
    const db = rgba[o + 2] - sb;
    return dr * dr + dg * dg + db * db <= tol2;
  };
  let agreeing = 0;
  for (const c of corners) if (rgba[c * 4 + 3] > 8 && nearSeed(c)) agreeing++;
  if (agreeing < 2) {
    console.warn(
      `[make-logo] corners do not agree on a background colour (${agreeing}/4) - ` +
        'skipping background removal to protect the logo.'
    );
    return { w, h, rgba, changed: false };
  }

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!seen[i] && rgba[i * 4 + 3] > 0 && nearSeed(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }
  while (stack.length) {
    const i = stack.pop();
    rgba[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return { w, h, rgba, changed: true };
}

// ---------------- Resize (box average, premultiplied alpha) ----------------
function resize({ w, h, rgba }, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor((y * h) / th);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / th));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor((x * w) / tw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * w + xx) * 4;
          const al = rgba[o + 3];
          r += rgba[o] * al;
          g += rgba[o + 1] * al;
          b += rgba[o + 2] * al;
          a += al;
          n++;
        }
      }
      const q = (y * tw + x) * 4;
      if (a <= 0) {
        out[q] = 0; out[q + 1] = 0; out[q + 2] = 0; out[q + 3] = 0;
      } else {
        out[q] = Math.round(r / a);
        out[q + 1] = Math.round(g / a);
        out[q + 2] = Math.round(b / a);
        out[q + 3] = Math.round(a / n);
      }
    }
  }
  return { w: tw, h: th, rgba: out };
}

function fit(img, max) {
  const longest = Math.max(img.w, img.h);
  if (longest <= max) return img;
  const s = max / longest;
  return resize(img, Math.max(1, Math.round(img.w * s)), Math.max(1, Math.round(img.h * s)));
}

// ---------------- PNG encode (RGBA8, no filter) ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng({ w, h, rgba }) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------- Trim empty margins + center on a square ----------------
// Crops away fully transparent borders so the artwork fills the favicon
// (this is what makes the tab icon look "bigger"), then pads back to a
// square canvas with a small margin. Only runs when the background was
// actually made transparent - a solid-background image is left untouched.
function trimToContent({ w, h, rgba }) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing visible - leave the image as-is
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  if (tw === w && th === h) return null; // no transparent margin to remove
  const out = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const srcStart = ((y + minY) * w + minX) * 4;
    rgba.copy(out, y * tw * 4, srcStart, srcStart + tw * 4);
  }
  return { w: tw, h: th, rgba: out };
}

function padSquare({ w, h, rgba }, padRatio) {
  const side = Math.max(w, h);
  const pad = Math.max(1, Math.round(side * padRatio));
  const S = side + pad * 2;
  const out = Buffer.alloc(S * S * 4);
  const ox = Math.floor((S - w) / 2);
  const oy = Math.floor((S - h) / 2);
  for (let y = 0; y < h; y++) {
    rgba.copy(out, ((y + oy) * S + ox) * 4, y * w * 4, (y + 1) * w * 4);
  }
  return { w: S, h: S, rgba: out };
}

// ---------------- Main ----------------
function main() {
  if (!existsSync(SRC)) {
    console.warn('[make-logo] APP LOGO.png not found - keeping existing favicons.');
    return;
  }
  mkdirSync(PUB, { recursive: true });

  let logo = makeTransparent(decodePng(readFileSync(SRC)));
  console.log(
    `[make-logo] source ${logo.w}x${logo.h}` + (logo.changed ? ', background removed' : ', no background change')
  );

  const trimmed = trimToContent(logo);
  if (trimmed) {
    logo = padSquare(trimmed, 0.04);
    console.log(`[make-logo] cropped to artwork -> ${logo.w}x${logo.h}`);
  }

  const sized = fit(logo, 512);
  writeFileSync(join(PUB, 'logo.png'), encodePng(sized));
  console.log(`[make-logo] wrote public/logo.png (${sized.w}x${sized.h})`);

  const fav32 = fit(logo, 32);
  writeFileSync(join(PUB, 'favicon-32.png'), encodePng(fav32));
  console.log(`[make-logo] wrote public/favicon-32.png (${fav32.w}x${fav32.h})`);

  // Embed a HIGH-RESOLUTION copy (up to 512px) inside the SVG so the browser
  // always has sharp pixels to downscale - a small embed is what made the
  // favicon look blurry on high-DPI screens.
  const favSvg = fit(logo, 512);
  const b64 = encodePng(favSvg).toString('base64');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${favSvg.w}" height="${favSvg.h}" ` +
    `viewBox="0 0 ${favSvg.w} ${favSvg.h}">` +
    `<image width="${favSvg.w}" height="${favSvg.h}" href="data:image/png;base64,${b64}"/></svg>`;
  writeFileSync(join(PUB, 'favicon.svg'), svg);
  console.log(`[make-logo] wrote public/favicon.svg (${favSvg.w}x${favSvg.h} embed)`);
}

try {
  main();
} catch (err) {
  console.warn('[make-logo] skipped:', err && err.message ? err.message : err);
}
// Always exit 0 - this must never break `npm run dev` / `npm run build`.
process.exit(0);
