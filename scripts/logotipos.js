// Recolhe os logótipos publicados nos sites oficiais das transportadoras (og:image, ícones e imagens marcadas como logótipo)
// e guarda-os numa pasta, com a origem de cada ficheiro, para escolher à mão. Uso: node scripts/logotipos.js <pasta>
const fs = require('node:fs'), path = require('node:path');
const PASTA = process.argv[2] || 'logotipos';
const SITES = {
  taag: ['https://www.flytaag.com/pt/', 'https://flytaag.com/en/'],
  macon: ['https://macontransp.com/'],
  nawabus: ['https://www.nawabus.ao/'],
  huambo_expresso: ['https://huamboexpresso.ao/', 'https://huamboexpresso-bilhetes.ao/home'],
  real_express: ['https://realexpress-wl.praxioluna.com.br/?paginas=venda'],
  cidralia: ['https://cidralia.com/'],
  fly_angola: ['https://flyangola.co.ao/'],
};
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
(async () => {
  fs.mkdirSync(PASTA, { recursive: true }); const origem = {};
  for (const [k, urls] of Object.entries(SITES)) {
    const cand = new Set();
    for (const u of urls) {
      try {
        const r = await fetch(u, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(25000) }); const h = await r.text(); const base = r.url;
        const add = x => { if (!x) return; try { cand.add(new URL(x.replace(/&amp;/g, '&'), base).href); } catch {} };
        for (const m of h.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*content=["']([^"']+)/gi)) add(m[1]);
        for (const m of h.matchAll(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*href=["']([^"']+)/gi)) add(m[1]);
        for (const m of h.matchAll(/<img[^>]+>/gi)) { const tag = m[0]; if (/logo|marca|brand/i.test(tag)) add((tag.match(/(?:data-src|src)=["']([^"']+)/i) || [])[1]); }
        for (const m of h.matchAll(/["']([^"'\s]+logo[^"'\s]*\.(?:svg|png|webp|jpe?g))["']/gi)) add(m[1]);
      } catch (e) { console.log(k, 'falhou', u, e.message); }
    }
    let i = 0;
    for (const c of [...cand].slice(0, 12)) {
      try {
        const r = await fetch(c, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) continue;
        const tipo = r.headers.get('content-type') || ''; if (!/image|svg|octet/.test(tipo)) continue;
        const ext = /svg/.test(tipo) || /\.svg/i.test(c) ? 'svg' : /png/.test(tipo) ? 'png' : /webp/.test(tipo) ? 'webp' : /icon/.test(tipo) || /\.ico/i.test(c) ? 'ico' : 'jpg';
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 200) continue;
        const nome = `${k}-${++i}.${ext}`; fs.writeFileSync(path.join(PASTA, nome), buf); origem[nome] = c; console.log(nome, buf.length, c);
      } catch (e) {}
    }
  }
  fs.writeFileSync(path.join(PASTA, 'origem.json'), JSON.stringify(origem, null, 1));
})();
