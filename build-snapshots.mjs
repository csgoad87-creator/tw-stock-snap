#!/usr/bin/env node
// build-snapshots.mjs — 公開資料 repo（tw-stock-snap）的快照產生器。只用 Node 內建模組，沒有任何 npm 套件。
//
// 做的事：向 tw-stock-qa 正式站要「已簽章快照」（type=snap），用內建公鑰驗章，通過才寫進 out/snap/{name}.json；
// 抓不到或驗不過 → 沿用目前已發布的上一版（同樣先驗章），兩者都沒有就不發布該檔（前端會自動改讀後端）。
// 本 repo 不需要也不存放任何金鑰：簽章私鑰只在 Cloudflare。
import { webcrypto as crypto } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const SITE = 'https://tw-stock-qa.pages.dev';
const PAGES_URL = (process.env.PAGES_URL || '').replace(/\/$/, '');
// 與 tw-stock-qa shared.jsx 的 SNAP_PUBKEY 相同；輪替金鑰時兩邊一起改
const PUBKEY = {"kty":"EC","crv":"P-256","x":"1Ovh2Gn0clulAB6t9TJU8l17XpL9uf23tAmT2Loz630","y":"6YhifCGS1U1Um3UB4hN0WYxt6HrEk7ZGANEooDYrRVg"};
// 只收可再散布的資料（授權說明見 tw-stock-qa functions/api/_snap.js）
const NAMES = ['list', 'global_macro', 'calendar', 'mops_latest', 'intel', 'theme_history', 'inst_total', 'chip_top', 'brain'];
const MAX_BYTES = 8 * 1024 * 1024;

const key = await crypto.subtle.importKey('jwk', PUBKEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const unb64url = s => Uint8Array.from(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

async function verified(name, text) {
  if (!text || text.length > MAX_BYTES) return null;
  let s; try { s = JSON.parse(text); } catch (_) { return null; }
  if (!s || s.v !== 1 || s.name !== name || typeof s.body !== 'string' || typeof s.sig !== 'string' || typeof s.generatedAt !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.generatedAt)) return null;
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64url(s.sig),
    new TextEncoder().encode(name + '\n' + s.generatedAt + '\n' + s.body));
  return ok ? s : null;
}
async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'tw-stock-snap/1.0' }, signal: AbortSignal.timeout(60000) });
    return r.ok ? await r.text() : null;
  } catch (_) { return null; }
}

mkdirSync('out/snap', { recursive: true });
writeFileSync('out/.nojekyll', '');
writeFileSync('out/index.html', '<!doctype html><meta charset="utf-8"><title>tw-stock-snap</title><p>tw-stock-qa 的公開市場資料快照（已簽章）。</p>');
const status = {};
for (const name of NAMES) {
  let s = await verified(name, await get(`${SITE}/api/stock?type=snap&name=${name}`)), from = 'fresh';
  if (!s && PAGES_URL) { s = await verified(name, await get(`${PAGES_URL}/snap/${name}.json`)); from = 'previous'; }
  if (!s) { status[name] = { ok: false }; console.log(`✗ ${name}：新版與上一版都取不到或驗章失敗，本次不發布`); continue; }
  writeFileSync(`out/snap/${name}.json`, JSON.stringify(s));
  status[name] = { ok: true, from, generatedAt: s.generatedAt };
  console.log(`${from === 'fresh' ? '✓' : '↺'} ${name} ${s.generatedAt}（${s.body.length} bytes）`);
}
// 狀態檔只供人看（未簽章，前端不讀）
writeFileSync('out/snap/status.json', JSON.stringify({ builtAt: new Date().toISOString(), status }, null, 1));
if (!Object.values(status).some(x => x.ok)) { console.error('全部失敗'); process.exit(1); }
