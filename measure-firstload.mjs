import { gzipSync } from 'node:zlib';

const BASE = 'http://localhost:5100';
const routes = ['/', '/modules', '/evaluate/novel-evaluate', '/evaluate/gaokao-essay', '/history'];

async function measure(url) {
  const res = await fetch(url, { headers: { accept: 'text/html' } });
  const html = await res.text();
  const urls = new Set();
  // App Router 首屏资源以 preload link 形式声明
  const re = /<link[^>]+rel="preload"[^>]*>/g;
  for (const m of html.match(re) || []) {
    const href = /href="([^"]+)"/.exec(m)?.[1];
    const as = /as="([^"]+)"/.exec(m)?.[1];
    if (href && (as === 'script' || as === 'style')) urls.add(href);
  }
  const scriptSrcs = html.match(/<script[^>]+src="([^"]+)"/g) || [];
  for (const m of scriptSrcs) {
    const href = /src="([^"]+)"/.exec(m)?.[1];
    if (href) urls.add(href);
  }

  let rawTotal = 0;
  let gzipTotal = 0;
  const rows = [];
  for (const u of urls) {
    const full = u.startsWith('http') ? u : BASE + u;
    const r = await fetch(full);
    const buf = Buffer.from(await r.arrayBuffer());
    const gz = gzipSync(buf, { level: 9 }).length;
    rawTotal += buf.length;
    gzipTotal += gz;
    rows.push({ url: u.split('?')[0], rawKB: +(buf.length / 1024).toFixed(1), gzKB: +(gz / 1024).toFixed(1) });
  }
  rows.sort((a, b) => b.gzKB - a.gzKB);
  const htmlGz = gzipSync(Buffer.from(html), { level: 9 }).length;
  console.log(`\n===== ${url} =====`);
  console.log(`HTML: raw ${(html.length / 1024).toFixed(1)} KB / gzip ${(htmlGz / 1024).toFixed(1)} KB`);
  console.log(`首屏 JS/CSS: raw ${(rawTotal / 1024).toFixed(1)} KB / gzip ${(gzipTotal / 1024).toFixed(1)} KB`);
  console.log('Top chunks (gzip):');
  for (const r of rows.slice(0, 12)) {
    console.log(`  ${String(r.gzKB).padStart(7)} KB gz | ${String(r.rawKB).padStart(7)} KB raw | ${r.url}`);
  }
}

for (const route of routes) {
  await measure(BASE + route);
}
