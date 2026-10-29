// Converte o shapefile oficial de municípios (dados/angola-level2/Angola_Level2.*, WGS84) em GeoJSON simplificado.
//   node scripts/shp-para-geojson.js
// Gera: src/geo/municipios.json (servidor: limites mais precisos, para saber em que município/província fica cada ponto)
//       public/geo/angola-municipios.geojson (mapa do site: mais leve)
const fs = require('node:fs');
const path = require('node:path');
const RAIZ = path.join(__dirname, '..');
const ORIGEM = path.join(RAIZ, 'dados', 'angola-level2', 'Angola_Level2');

function lerDBF(f) {
  const b = fs.readFileSync(f); const n = b.readUInt32LE(4), hl = b.readUInt16LE(8), rl = b.readUInt16LE(10);
  const campos = []; for (let o = 32; b[o] !== 0x0d; o += 32) campos.push([b.toString('latin1', o, o + 11).replace(/\0.*/, ''), b[o + 16]]);
  const L = [];
  for (let i = 0; i < n; i++) { let o = hl + i * rl + 1; const r = {}; for (const [k, l] of campos) { r[k] = b.toString('utf8', o, o + l).replace(/\0/g, '').trim(); o += l; } L.push(r); }
  return L;
}
function lerSHP(f) {
  const b = fs.readFileSync(f); const L = []; let o = 100;
  while (o < b.length) {
    const len = b.readInt32BE(o + 4) * 2; const c = o + 8; const tipo = b.readInt32LE(c);
    if (tipo === 5 || tipo === 15) {
      const np = b.readInt32LE(c + 36), nv = b.readInt32LE(c + 40); const partes = [];
      for (let i = 0; i < np; i++) partes.push(b.readInt32LE(c + 44 + i * 4));
      const pts = c + 44 + np * 4; const aneis = [];
      for (let i = 0; i < np; i++) { const a = []; for (let k = partes[i]; k < (i + 1 < np ? partes[i + 1] : nv); k++) a.push([b.readDoubleLE(pts + k * 16), b.readDoubleLE(pts + k * 16 + 8)]); aneis.push(a); }
      L.push(aneis);
    } else L.push([]);
    o = c + len;
  }
  return L;
}
// Douglas–Peucker
function simplificar(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const pilha = [[0, pts.length - 1]];
  while (pilha.length) {
    const [a, z] = pilha.pop(); let max = 0, idx = -1; const [x1, y1] = pts[a], [x2, y2] = pts[z]; const dx = x2 - x1, dy = y2 - y1, d2 = dx * dx + dy * dy || 1e-18;
    for (let i = a + 1; i < z; i++) { const t = Math.max(0, Math.min(1, ((pts[i][0] - x1) * dx + (pts[i][1] - y1) * dy) / d2)); const ex = x1 + t * dx - pts[i][0], ey = y1 + t * dy - pts[i][1]; const dd = ex * ex + ey * ey; if (dd > max) { max = dd; idx = i; } }
    if (max > tol * tol) { keep[idx] = 1; pilha.push([a, idx], [idx, z]); }
  }
  const r = pts.filter((_, i) => keep[i]); return r.length >= 4 ? r : pts.slice(0, 4);
}
const area = a => { let s = 0; for (let i = 0, j = a.length - 1; i < a.length; j = i++) s += (a[j][0] - a[i][0]) * (a[j][1] + a[i][1]); return s / 2; }; // > 0 = sentido horário (anel exterior no shapefile)
function construir(tol, casas) {
  const atributos = lerDBF(ORIGEM + '.dbf'), formas = lerSHP(ORIGEM + '.shp');
  const q = v => Math.round(v * 10 ** casas) / 10 ** casas;
  return { type: 'FeatureCollection', features: formas.map((aneis, i) => {
    const polis = []; // anel exterior (horário) seguido dos buracos
    for (const a of aneis) { const s = simplificar(a, tol).map(([x, y]) => [q(x), q(y)]); if (area(a) >= 0 || !polis.length) polis.push([s.slice().reverse()]); else polis[polis.length - 1].push(s.slice().reverse()); }
    const p = atributos[i];
    return { type: 'Feature', properties: { municipio: p.Munic_ofic, provincia: p.Prov_ofic.replace(/-/g, ' ').replace('Cuanza ', 'Cuanza ') }, geometry: { type: 'MultiPolygon', coordinates: polis } };
  }) };
}
fs.mkdirSync(path.join(RAIZ, 'src', 'geo'), { recursive: true }); fs.mkdirSync(path.join(RAIZ, 'public', 'geo'), { recursive: true });
const srv = construir(0.0008, 5), web = construir(0.004, 4);
fs.writeFileSync(path.join(RAIZ, 'src', 'geo', 'municipios.json'), JSON.stringify(srv));
fs.writeFileSync(path.join(RAIZ, 'public', 'geo', 'angola-municipios.geojson'), JSON.stringify(web));
console.log(srv.features.length, 'municípios ·', new Set(srv.features.map(f => f.properties.provincia)).size, 'províncias');
