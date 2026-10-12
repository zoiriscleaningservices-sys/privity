#!/usr/bin/env node
/**
 * Privity — Liquid Glass light-appearance generator.
 *
 * The legacy stylesheets were written for a dark-only UI with ~1,300 hard-coded colours.
 * Rewriting them by hand would be risky, so this script derives a *scoped* light
 * appearance from them:
 *
 *   - Every rule that sets a colour is re-emitted under `html[data-theme="light"] …`
 *     with the colour mapped onto the Liquid Glass light palette (dark surfaces → pearl
 *     glass, white text → ink, pastel-on-dark accents → deeper accessible accents,
 *     heavy black shadows → soft ambient shadows).
 *   - Only colour-bearing declarations are emitted; layout is never touched.
 *   - Media-overlay contexts (LIVE, video, stories, camera, lightbox, gifts…) are skipped
 *     on purpose: controls over moving video must stay dark glass to remain legible.
 *   - The dark appearance is untouched (it is simply the original CSS).
 *
 * Usage:  node scripts/generate-light-theme.mjs
 * Output: src/design/light-theme.generated.css   (commit the output; re-run after CSS edits)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['src/index.css', 'src/components/auth/authModal.css'];
const OUT = 'src/design/light-theme.generated.css';
const SCOPE = 'html[data-theme="light"]';

/** Selectors that sit on top of photos/video and must keep their dark-glass treatment. */
const SKIP_SELECTOR = /(live(?!-explore|-grid|-card|-empty|-filter|-tab|-header|-search)|lightbox|video|story|stories|camera|gift|pip|battle|reel|player|cinema|fullscreen|tiktok|stage|viewer|media-overlay|hero-image|banner-btn|cover-|on-media|immersive)/i;
const SKIP_ROOT = /^(:root|html|body|\*|::-webkit-scrollbar)/;

const COLOR_PROPS = new Set(['color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color']);
const BG_PROPS = new Set(['background', 'background-color', 'background-image']);
const BORDER_PROPS = /^(border(-top|-right|-bottom|-left)?(-color)?|outline(-color)?)$/;
const SHADOW_PROPS = new Set(['box-shadow', 'text-shadow', 'filter']);

// ---------------------------------------------------------------------------------- colour maths
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], '#fff': [255, 255, 255, 1], '#000': [0, 0, 0, 1] };
const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

function parseColor(s) {
  const t = s.trim().toLowerCase();
  if (NAMED[t]) return [...NAMED[t]];
  if (t.startsWith('#')) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const m = t.match(/rgba?\(([^)]*)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,\/]+/).filter(Boolean).map((p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
  if (parts.length < 3 || parts.some((p) => Number.isNaN(p))) return null;
  const a = parts.length > 3 ? (m[1].includes('%') && parts[3] > 1 ? parts[3] / 255 : parts[3]) : 1;
  return [parts[0], parts[1], parts[2], a];
}

function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const fmt = ([r, g, b, a]) => (a >= 0.999 ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Text colours: white → ink; neutral greys keep their emphasis rank; pastel accents deepen. */
function mapText(c) {
  const [h, s, l] = toHsl(c);
  const a = c[3];
  if (s < 0.22) {
    if (l > 0.82) return a >= 0.85 ? 'var(--lg-text)' : a >= 0.55 ? 'var(--lg-text-2)' : 'var(--lg-text-3)';
    if (l > 0.55) return 'var(--lg-text-2)';
    if (l > 0.3) return 'var(--lg-text-3)';
    return 'var(--lg-text-4)';
  }
  if (l > 0.48) return fmt([...fromHsl(h, Math.min(1, s * 0.95), 0.42), a]);
  return null;
}

/** Surfaces: dark glass → pearl glass, white veils → ink veils, accents unchanged. */
function mapSurface(c) {
  const [h, s, l] = toHsl(c);
  const a = c[3];
  if (l < 0.22 && s < 0.6) {
    if (a >= 0.999) return l < 0.06 ? 'var(--lg-bg)' : 'var(--lg-surface)';
    return fmt([255, 255, 255, clamp(0.5 + a * 0.45, 0.55, 0.94)]);
  }
  if (l > 0.9 && s < 0.2 && a < 0.35) return fmt([40, 48, 75, clamp(a * 0.55, 0.025, 0.12)]);
  return null;
}

function mapBorder(c) {
  const [, s, l] = toHsl(c);
  const a = c[3];
  if (l > 0.85 && s < 0.2) return fmt([40, 48, 75, clamp(a * 0.7 + 0.03, 0.06, 0.16)]);
  if (l < 0.2) return 'var(--lg-border)';
  return null;
}

function mapShadow(c, inset) {
  const [, s, l] = toHsl(c);
  const a = c[3];
  if (l < 0.2) return fmt([37, 45, 78, clamp(a * 0.22, 0.04, 0.14)]);
  if (l > 0.85 && s < 0.2) return inset ? fmt([255, 255, 255, clamp(a * 4, 0.4, 0.9)]) : null;
  if (s > 0.3 && a > 0.2) return fmt([...c.slice(0, 3), +(a * 0.5).toFixed(3)]);
  return null;
}

function transformValue(prop, value) {
  if (/var\(--/.test(value) && !COLOR_RE.test(value)) return null;
  COLOR_RE.lastIndex = 0;
  let changed = false;
  const inset = /inset/.test(value);
  const out = value.replace(COLOR_RE, (m) => {
    const c = parseColor(m);
    if (!c) return m;
    let r = null;
    if (COLOR_PROPS.has(prop)) r = mapText(c);
    else if (BG_PROPS.has(prop)) r = mapSurface(c);
    else if (BORDER_PROPS.test(prop)) r = mapBorder(c);
    else if (SHADOW_PROPS.has(prop)) r = prop === 'filter' ? (toHsl(c)[2] < 0.2 ? fmt([37, 45, 78, clamp(c[3] * 0.3, 0.05, 0.18)]) : null) : mapShadow(c, inset);
    if (r && r !== m) {
      changed = true;
      return r;
    }
    return m;
  });
  return changed ? out : null;
}

// ---------------------------------------------------------------------------------- CSS walking
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Minimal block parser: returns [{ prelude, body, children }] preserving @media nesting. */
function parseBlocks(css) {
  const blocks = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const semi = css.indexOf(';', i);
    if (semi !== -1 && semi < open && css.slice(i, semi).trim().startsWith('@')) {
      i = semi + 1; // @import / @charset
      continue;
    }
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    blocks.push({ prelude, body });
    i = j;
  }
  return blocks;
}

function scopeSelector(sel) {
  return sel
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !SKIP_SELECTOR.test(s) && !SKIP_ROOT.test(s))
    .map((s) => `${SCOPE} ${s}`)
    .join(',\n');
}

/** True when a rule paints a strong accent (brand gradient, solid colour) behind its text. */
function hasAccentBackground(body) {
  const m = body.match(/background(?:-color|-image)?\s*:([^;]+)/gi);
  if (!m) return false;
  return m.some((d) => {
    if (/var\(--(brand|heart|cf-|public|followers|live-team|plv-iris)/.test(d)) return true;
    const cols = d.match(COLOR_RE) || [];
    return cols.some((x) => {
      const c = parseColor(x);
      if (!c) return false;
      const [, s, l] = toHsl(c);
      return s > 0.45 && l > 0.25 && l < 0.75 && c[3] > 0.6;
    });
  });
}

function transformRule(prelude, body) {
  const selector = scopeSelector(prelude);
  if (!selector) return '';
  const accentBg = hasAccentBackground(body);
  const decls = [];
  for (const raw of body.split(';')) {
    const idx = raw.indexOf(':');
    if (idx === -1) continue;
    const prop = raw.slice(0, idx).trim().toLowerCase();
    let value = raw.slice(idx + 1).trim();
    if (!prop || prop.startsWith('--')) continue;
    if (accentBg && COLOR_PROPS.has(prop)) continue; // white on brand colour stays white
    const important = /!important\s*$/.test(value);
    value = value.replace(/!important\s*$/, '').trim();
    const next = transformValue(prop, value);
    if (next) decls.push(`  ${prop}: ${next}${important ? ' !important' : ''};`);
  }
  return decls.length ? `${selector} {\n${decls.join('\n')}\n}\n` : '';
}

function walk(css) {
  let out = '';
  for (const { prelude, body } of parseBlocks(css)) {
    if (/^@(-webkit-)?keyframes|^@font-face|^@property/.test(prelude)) continue;
    if (/^@(media|supports|container|layer)/.test(prelude)) {
      const inner = walk(body);
      if (inner.trim()) out += `${prelude} {\n${inner}}\n`;
      continue;
    }
    out += transformRule(prelude, body);
  }
  return out;
}

let output = `/* AUTO-GENERATED by scripts/generate-light-theme.mjs - do not edit by hand.\n   Scoped light (Liquid Glass) appearance derived from the legacy dark stylesheets. */\n\n`;
let total = 0;
for (const src of SOURCES) {
  const css = stripComments(readFileSync(resolve(root, src), 'utf8'));
  const res = walk(css);
  total += (res.match(/\{\n/g) || []).length;
  output += `/* ---- from ${src} ---- */\n${res}\n`;
}
mkdirSync(dirname(resolve(root, OUT)), { recursive: true });
writeFileSync(resolve(root, OUT), output);
console.log(`light theme: ${total} rules → ${OUT} (${(output.length / 1024).toFixed(1)} KB)`);
