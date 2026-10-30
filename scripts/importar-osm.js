// Corre a importação de lugares do OpenStreetMap contra a base de dados de DATABASE_URL.
//   node scripts/importar-osm.js                      → lê da API Overpass (servidores públicos)
//   OSM_FICHEIRO=lugares.json node scripts/importar-osm.js → usa elementos extraídos com scripts/extrair-osm.py
const db = require('../src/db');
const { sincronizarFonte } = require('../src/sincronizar');
(async () => {
  await db.garantirBD();
  const f = await db.get(`SELECT id FROM fontes WHERE metodo = 'osm' ORDER BY id LIMIT 1`);
  if (!f) throw new Error('Fonte OpenStreetMap não encontrada (a base de dados ainda não está na v3.5?).');
  const t0 = Date.now(); const r = await sincronizarFonte({ get: db.get, all: db.all, run: db.run }, db.tx, f.id, 'admin');
  console.log(JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  process.exit(r.estado === 'ok' ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
