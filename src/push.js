// Web Push (RFC 8291 + VAPID, RFC 8292) sem dependências: envia as notificações para o telemóvel ou computador
// da pessoa mesmo com o site fechado. Chaves VAPID em VAPID_PUBLICA / VAPID_PRIVADA (base64url, P-256).
const crypto = require('node:crypto');

const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
const ASSUNTO = process.env.VAPID_ASSUNTO || 'https://turismo-digital-360.vercel.app';

function chaves() {
  const pub = process.env.VAPID_PUBLICA, priv = process.env.VAPID_PRIVADA;
  if (!pub || !priv) return null;
  const p = unb64u(pub); if (p.length !== 65 || p[0] !== 4) return null;
  const chave = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: priv, x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33)) }, format: 'jwk' });
  return { publica: pub, chave };
}
// Gera um par de chaves VAPID novo (para a configuração inicial)
function gerarChaves() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = publicKey.export({ format: 'jwk' });
  return { publica: b64u(Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)])), privada: privateKey.export({ format: 'jwk' }).d };
}

const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
// Cifra a mensagem para a subscrição (aes128gcm, um único registo)
function cifrar(texto, p256dh, auth) {
  const ua = unb64u(p256dh), segredo = unb64u(auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const as = ecdh.getPublicKey(); const partilhado = ecdh.computeSecret(ua);
  const ikm = hmac(hmac(segredo, partilhado), Buffer.concat([Buffer.from('WebPush: info\0'), ua, as, Buffer.from([1])]));
  const sal = crypto.randomBytes(16); const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const corpo = Buffer.concat([c.update(Buffer.concat([Buffer.from(texto), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([as.length]), as, corpo]);
}
function jwtVapid(endpoint, k) {
  const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const carga = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: ASSUNTO }));
  const ass = crypto.sign('sha256', Buffer.from(cab + '.' + carga), { key: k.chave, dsaEncoding: 'ieee-p1363' });
  return `${cab}.${carga}.${b64u(ass)}`;
}
// Envia para uma subscrição. Devolve o estado HTTP (404/410 = subscrição já não existe)
async function enviar(sub, mensagem, fetchFn = fetch) {
  const k = chaves(); if (!k) return 0;
  const r = await fetchFn(sub.endpoint, { method: 'POST', headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal',
    Authorization: `vapid t=${jwtVapid(sub.endpoint, k)}, k=${k.publica}` }, body: cifrar(JSON.stringify(mensagem), sub.p256dh, sub.auth) });
  return r.status;
}
async function enviarAoUtilizador(db, uid, mensagem) {
  if (!chaves()) return 0;
  const L = await db.all('SELECT * FROM push_subscricoes WHERE utilizador_id = ?', uid); let n = 0;
  for (const s of L) {
    try { const st = await enviar(s, mensagem); if (st === 404 || st === 410) await db.run('DELETE FROM push_subscricoes WHERE id = ?', s.id); else if (st >= 200 && st < 300) n++; }
    catch { /* rede: tenta na próxima notificação */ }
  }
  return n;
}
// Endereços dos serviços de push dos navegadores (evita que se registem endereços arbitrários)
const ENDPOINT_OK = /^https:\/\/([a-z0-9-]+\.)*(push\.services\.mozilla\.com|fcm\.googleapis\.com|android\.googleapis\.com|notify\.windows\.com|web\.push\.apple\.com|push\.apple\.com)\//i;

module.exports = { chaves, gerarChaves, cifrar, enviar, enviarAoUtilizador, ENDPOINT_OK };
