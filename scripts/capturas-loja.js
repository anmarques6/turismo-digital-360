// Capturas de ecrã para o Google Play e a App Store, tiradas do site real com a conta de demonstração (actualizadas com os logótipos).
// Uso: node scripts/capturas-loja.js <pasta>  (precisa do Playwright)
const { chromium } = require('playwright');
const path = require('node:path'), fs = require('node:fs');
const BASE = process.env.SITE || 'https://turismo-digital-360.vercel.app';
const PASTA = process.argv[2] || 'capturas-loja';
const FORMATOS = { 'iphone-6.9': { width: 440, height: 956, deviceScaleFactor: 3 }, 'android': { width: 360, height: 640, deviceScaleFactor: 3 } };
const ESPERA = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(PASTA, { recursive: true });
  const b = await chromium.launch();
  for (const [nome, vp] of Object.entries(FORMATOS)) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, isMobile: true, hasTouch: true, locale: 'pt-PT',
      geolocation: { latitude: -8.8159, longitude: 13.2306 }, permissions: ['geolocation'],
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
    const p = await ctx.newPage();
    const limpar = async () => { await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); document.querySelectorAll('.k-toast').forEach(t => t.remove()); }).catch(() => {}); await ESPERA(400); };
    const foto = async n => { await limpar(); await p.screenshot({ path: path.join(PASTA, `${nome}-${n}.png`) }); console.log('captura', nome, n); };
    const ir = async h => { await p.evaluate(x => { location.hash = x; }, h); await ESPERA(3500); await p.evaluate(() => scrollTo(0, 0)); };
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.click('[data-demo]'); await p.click('[data-login] [type=submit]'); await p.waitForSelector('#main', { timeout: 30000 }); await ESPERA(4500);
    await foto('1-inicio');
    await ir('destinos'); await foto('2-destinos');
    await ir('mapa'); await ESPERA(2500); await foto('3-mapa');
    // COMO VIAJAR: Luanda → Quedas de Calandula
    await ir('viajar'); await p.click('[data-vj-gps]'); await p.waitForSelector('[data-vj-dest]');
    const opt = await p.$$eval('[data-vj-dest] option', os => os.find(o => /Calandula/.test(o.textContent))?.value);
    await p.selectOption('[data-vj-dest]', opt); await ESPERA(800); await p.click('[data-vj-form] [type=submit]'); await p.waitForSelector('.vj-op', { timeout: 30000 }); await ESPERA(800);
    await p.evaluate(() => document.querySelector('.vj-titulo')?.scrollIntoView({ block: 'start' })); await p.evaluate(() => scrollBy(0, -90)); await foto('4-como-viajar');
    await ir('alojamentos'); await foto('5-alojamentos');
    await ir('eventos'); await foto('6-eventos');
    // limpa as viagens de demonstração criadas pelas capturas
    await p.evaluate(async () => { const L = await API.get('/api/viagens'); for (const v of L) await API.del('/api/viagens/' + v.id); });
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
