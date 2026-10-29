// Mapa oficial de municípios de Angola (shapefile Angola_Level2 fornecido pela equipa, 326 municípios, 21 províncias, WGS84).
// Usado para saber em que município/província fica cada ponto e para recusar coordenadas fora do mapa.

let MUN = null;
function carregar() {
  if (MUN) return MUN;
  const g = require('./geo/municipios.json'); // require: incluído automaticamente no pacote da função na Vercel
  MUN = g.features.map(f => {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    for (const p of f.geometry.coordinates) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { ...f.properties, polis: f.geometry.coordinates, caixa: [x0, y0, x1, y1] };
  });
  return MUN;
}
const dentroAnel = (x, y, a) => { let d = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [xi, yi] = a[i], [xj, yj] = a[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
const dentroPoli = (x, y, p) => dentroAnel(x, y, p[0]) && !p.slice(1).some(b => dentroAnel(x, y, b));
// distância aproximada (km) de um ponto ao contorno de um município
function distContorno(x, y, polis) {
  let m = Infinity; const kx = 111.32 * Math.cos(y * Math.PI / 180), ky = 110.57;
  for (const p of polis) for (const a of p) for (let i = 1; i < a.length; i++) {
    const [x1, y1] = a[i - 1], [x2, y2] = a[i]; const dx = (x2 - x1) * kx, dy = (y2 - y1) * ky, px = (x - x1) * kx, py = (y - y1) * ky;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1e-12))); const ex = px - t * dx, ey = py - t * dy; const d = Math.sqrt(ex * ex + ey * ey); if (d < m) m = d;
  }
  return m;
}
// { municipio, provincia, exacto } ou null quando o ponto fica fora do mapa.
// Pontos na costa ou em ilhas pequenas que a simplificação dos limites deixou de fora (até 6 km, ex.: Baía dos Tigres) contam para o município mais próximo.
function localizar(lat, lon, margemKm = 6) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const L = carregar();
  for (const m of L) { const [x0, y0, x1, y1] = m.caixa; if (lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && m.polis.some(p => dentroPoli(lon, lat, p))) return { municipio: m.municipio, provincia: m.provincia, exacto: true }; }
  const g = margemKm / 100; let melhor = null;
  for (const m of L) { const [x0, y0, x1, y1] = m.caixa; if (lon < x0 - g || lon > x1 + g || lat < y0 - g || lat > y1 + g) continue; const d = distContorno(lon, lat, m.polis); if (d <= margemKm && (!melhor || d < melhor.d)) melhor = { d, m }; }
  return melhor ? { municipio: melhor.m.municipio, provincia: melhor.m.provincia, exacto: false, distancia_km: Math.round(melhor.d * 10) / 10 } : null;
}
const municipios = () => carregar().map(m => ({ municipio: m.municipio, provincia: m.provincia }));
module.exports = { localizar, municipios };
