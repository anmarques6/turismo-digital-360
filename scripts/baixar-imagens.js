// Corre na publicação (vercel.json → buildCommand): descarrega as fotografias de alta
// resolução do Wikimedia Commons (licenças livres) para public/img/ e gera a página de créditos.
// Se alguma falhar, a publicação pára e a versão anterior do site continua no ar.
const fs = require('node:fs');
const path = require('node:path');
const FONTES = require('../src/imagens-fontes.json');
const DEST = path.join(__dirname, '..', 'public', 'img');
const UA = 'Turismo360-build/1.0 (https://turismo-digital-360.vercel.app; projectos@sigafangola.ao)';

async function baixar(chave, f, tentativas = 4) {
  const ficheiro = path.join(DEST, chave + '.jpg');
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) throw new Error('ficheiro demasiado pequeno');
      fs.writeFileSync(ficheiro, buf);
      return buf.length;
    } catch (e) {
      if (i === tentativas) throw new Error(`${chave}: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}

(async () => {
  fs.mkdirSync(DEST, { recursive: true });
  const chaves = Object.keys(FONTES); let total = 0; const erros = [];
  for (let i = 0; i < chaves.length; i += 4) {
    await Promise.all(chaves.slice(i, i + 4).map(k => baixar(k, FONTES[k]).then(n => { total += n; }).catch(e => erros.push(e.message))));
  }
  if (erros.length) { console.error('Falharam ' + erros.length + ' imagens:\n' + erros.join('\n')); process.exit(1); }
  console.log(`${chaves.length} imagens descarregadas (${(total / 1048576).toFixed(1)} MB).`);

  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const linhas = chaves.map(k => { const f = FONTES[k]; return `<li><img src="/img/${k}.jpg" alt="" loading="lazy"><div><b>${esc(f.titulo)}</b><span>${esc(f.autor || 'Autor desconhecido')} · ${f.licenca_url ? `<a href="${esc(f.licenca_url)}" rel="noopener" target="_blank">${esc(f.licenca)}</a>` : esc(f.licenca)} · <a href="${esc(f.pagina)}" rel="noopener" target="_blank">Wikimedia Commons</a></span></div></li>`; }).join('\n');
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'creditos.html'), `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Créditos das imagens · Turismo Digital 360°</title><link rel="icon" href="/img/sigaf.webp"><style>
:root{--bg:#F5F5F7;--fg:#141726;--muted:#666B7D;--card:#fff;--line:#E4E5EA;--red:#C8102E}
@media (prefers-color-scheme:dark){:root{--bg:#0D0F17;--fg:#EEF0F6;--muted:#9BA1B8;--card:#171A26;--line:#2A2F45}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:900px;margin:0 auto;padding:24px 16px 60px}h1{font-size:26px;margin:0 0 6px}p{color:var(--muted);margin:0 0 20px}
a{color:var(--red)}ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
li{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px}
li img{width:96px;height:64px;object-fit:cover;border-radius:8px;flex:none}li div{min-width:0;display:flex;flex-direction:column}
li b{font-size:14px;overflow-wrap:anywhere}li span{font-size:13px;color:var(--muted)}</style></head><body><main>
<a href="/">← Voltar ao Turismo Digital 360°</a><h1>Créditos das imagens</h1>
<p>As fotografias deste site vêm do Wikimedia Commons e são usadas ao abrigo das licenças indicadas (Creative Commons ou domínio público). Algumas fotografias de alojamentos, restaurantes e viaturas são ilustrativas e não mostram o estabelecimento ou o veículo exacto.</p>
<ul>
${linhas}
</ul></main></body></html>`);
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'imagens.json'), JSON.stringify(chaves.map(k => `/img/${k}.jpg`).concat(fs.readdirSync(DEST).filter(f => f.endsWith('.svg')).map(f => '/img/' + f))));
  console.log('Página de créditos criada.');
})();
