// Cliente PostgreSQL mínimo, sem dependências (protocolo v3 sobre TCP/TLS).
// Suporta: SSL (sslmode=require/verify-full, com SNI — necessário na Neon), autenticação
// SCRAM-SHA-256 / MD5 / texto, consultas parametrizadas ($1, $2…), várias instruções
// (consulta simples) e um pool de ligações. Compatível com o PgBouncer da Neon (só usa
// instruções sem nome).
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

class ErroPg extends Error {
  constructor(campos) { super(campos.M || 'Erro PostgreSQL'); this.code = campos.C; this.detail = campos.D; this.constraint = campos.n; this.severity = campos.S; }
}

// Conversão de tipos (formato de texto)
const INTS = new Set([20, 21, 23, 26]), FLOATS = new Set([700, 701, 1700]);
function converter(oid, txt) {
  if (txt === null) return null;
  if (INTS.has(oid) || FLOATS.has(oid)) return Number(txt);
  if (oid === 16) return txt === 't';
  if (oid === 114 || oid === 3802) return JSON.parse(txt);
  if (oid === 17) return Buffer.from(txt.slice(2), 'hex'); // bytea em hex
  return txt;
}
function serializar(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function lerConfig(url) {
  const u = new URL(url);
  const sslmode = u.searchParams.get('sslmode') || (/localhost|127\.0\.0\.1/.test(u.hostname) ? 'disable' : 'require');
  return {
    host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1) || u.username), sslmode,
    options: u.searchParams.get('options'),
  };
}

class Ligacao {
  constructor(cfg) { this.cfg = cfg; this.buf = Buffer.alloc(0); this.fila = Promise.resolve(); this.morta = false; this.espera = null; }

  async ligar() {
    const c = this.cfg;
    let sock = net.connect({ host: c.host, port: c.port });
    await new Promise((ok, f) => { sock.once('connect', ok); sock.once('error', f); });
    if (c.sslmode !== 'disable') {
      const req = Buffer.alloc(8); req.writeInt32BE(8, 0); req.writeInt32BE(80877103, 4); sock.write(req);
      const r = await new Promise((ok, f) => { sock.once('data', ok); sock.once('error', f); });
      if (r[0] !== 0x53) { if (c.sslmode === 'prefer') { /* continua sem SSL */ } else throw new Error('O servidor PostgreSQL não aceita SSL.'); }
      else {
        sock = tls.connect({ socket: sock, servername: net.isIP(c.host) ? undefined : c.host, rejectUnauthorized: c.sslmode === 'verify-full' || c.sslmode === 'verify-ca' });
        await new Promise((ok, f) => { sock.once('secureConnect', ok); sock.once('error', f); });
      }
    }
    this.sock = sock;
    sock.on('data', d => this.receber(d));
    sock.on('error', e => this.falhar(e));
    sock.on('close', () => this.falhar(new Error('Ligação à base de dados fechada.')));

    // Mensagem de arranque
    const params = { user: c.user, database: c.database, client_encoding: 'UTF8', application_name: 'turismo360' };
    if (c.options) params.options = c.options;
    const corpo = Buffer.concat([...Object.entries(params).map(([k, v]) => Buffer.from(`${k}\0${v}\0`)), Buffer.from([0])]);
    const ini = Buffer.alloc(8); ini.writeInt32BE(corpo.length + 8, 0); ini.writeInt32BE(196608, 4);
    this.sock.write(Buffer.concat([ini, corpo]));
    await this.autenticar();
  }

  // ---------- leitura de mensagens ----------
  receber(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const msg = { tipo: String.fromCharCode(this.buf[0]), dados: this.buf.subarray(5, len + 1) };
      this.buf = this.buf.subarray(len + 1);
      if (msg.tipo === 'N' || msg.tipo === 'A') continue; // avisos / notificações
      if (msg.tipo === 'S') { continue; } // ParameterStatus
      this.espera ? this.espera(msg) : (this.pendentes ||= []).push(msg);
    }
  }
  proxima() {
    if (this.pendentes?.length) return Promise.resolve(this.pendentes.shift());
    if (this.morta) return Promise.reject(this.erroFatal);
    return new Promise((ok, f) => { this.espera = m => { this.espera = null; ok(m); }; this.rejeitar = f; });
  }
  falhar(e) { if (this.morta) return; this.morta = true; this.erroFatal = e; if (this.rejeitar && this.espera) { this.espera = null; this.rejeitar(e); } }
  enviar(tipo, ...partes) {
    const corpo = Buffer.concat(partes.map(p => typeof p === 'string' ? Buffer.from(p) : p));
    const h = Buffer.alloc(5); h.write(tipo, 0); h.writeInt32BE(corpo.length + 4, 1);
    return Buffer.concat([h, corpo]);
  }
  static erro(dados) { const campos = {}; let i = 0; while (i < dados.length && dados[i] !== 0) { const k = String.fromCharCode(dados[i]); const fim = dados.indexOf(0, i + 1); campos[k] = dados.toString('utf8', i + 1, fim); i = fim + 1; } return new ErroPg(campos); }

  async autenticar() {
    const c = this.cfg; let scram;
    for (;;) {
      const m = await this.proxima();
      if (m.tipo === 'E') throw Ligacao.erro(m.dados);
      if (m.tipo === 'R') {
        const cod = m.dados.readInt32BE(0);
        if (cod === 0) continue;
        if (cod === 3) { this.sock.write(this.enviar('p', c.password + '\0')); continue; }
        if (cod === 5) {
          const salt = m.dados.subarray(4, 8);
          const inner = crypto.createHash('md5').update(c.password + c.user).digest('hex');
          const h = 'md5' + crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
          this.sock.write(this.enviar('p', h + '\0')); continue;
        }
        if (cod === 10) {
          const mecs = m.dados.toString('utf8', 4).split('\0');
          if (!mecs.includes('SCRAM-SHA-256')) throw new Error('Método de autenticação não suportado: ' + mecs.join(', '));
          const nonce = crypto.randomBytes(18).toString('base64');
          scram = { nonce, primeiro: `n=*,r=${nonce}` };
          const dados = Buffer.from('n,,' + scram.primeiro);
          const len = Buffer.alloc(4); len.writeInt32BE(dados.length);
          this.sock.write(this.enviar('p', 'SCRAM-SHA-256\0', len, dados)); continue;
        }
        if (cod === 11) {
          const srv = m.dados.toString('utf8', 4);
          const at = Object.fromEntries(srv.split(',').map(p => [p[0], p.slice(2)]));
          if (!at.r.startsWith(scram.nonce)) throw new Error('Resposta SCRAM inválida.');
          const salted = crypto.pbkdf2Sync(c.password, Buffer.from(at.s, 'base64'), Number(at.i), 32, 'sha256');
          const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
          const clientKey = hmac(salted, 'Client Key');
          const stored = crypto.createHash('sha256').update(clientKey).digest();
          const semProva = `c=biws,r=${at.r}`;
          const authMsg = `${scram.primeiro},${srv},${semProva}`;
          const assin = hmac(stored, authMsg);
          const prova = Buffer.from(clientKey.map((b, i) => b ^ assin[i])).toString('base64');
          scram.servidor = hmac(hmac(salted, 'Server Key'), authMsg).toString('base64');
          this.sock.write(this.enviar('p', `${semProva},p=${prova}`)); continue;
        }
        if (cod === 12) { const v = m.dados.toString('utf8', 4); if (!v.includes('v=' + scram.servidor)) throw new Error('Assinatura do servidor SCRAM inválida.'); continue; }
        throw new Error('Método de autenticação não suportado (' + cod + ').');
      }
      if (m.tipo === 'K') continue;
      if (m.tipo === 'Z') return;
    }
  }

  // ---------- consultas ----------
  consulta(sql, params) { const p = this.fila.then(() => this.executar(sql, params)); this.fila = p.catch(() => {}); return p; }
  async executar(sql, params) {
    if (this.morta) throw this.erroFatal;
    const multi = params === undefined;
    if (multi) this.sock.write(this.enviar('Q', sql + '\0'));
    else {
      const ps = params.map(serializar);
      const n = Buffer.alloc(2); n.writeInt16BE(ps.length);
      const valores = ps.map(v => { if (v === null) { const b = Buffer.alloc(4); b.writeInt32BE(-1); return b; } const d = Buffer.from(v); const l = Buffer.alloc(4); l.writeInt32BE(d.length); return Buffer.concat([l, d]); });
      this.sock.write(Buffer.concat([
        this.enviar('P', '\0', sql + '\0', Buffer.from([0, 0])),
        this.enviar('B', '\0', '\0', Buffer.from([0, 0]), n, ...valores, Buffer.from([0, 0])),
        this.enviar('D', 'P\0'), this.enviar('E', '\0', Buffer.alloc(4)), this.enviar('S'),
      ]));
    }
    let campos = [], linhas = [], rowCount = 0, erro = null;
    for (;;) {
      const m = await this.proxima();
      switch (m.tipo) {
        case 'T': {
          const d = m.dados; const nf = d.readInt16BE(0); campos = []; let o = 2;
          for (let i = 0; i < nf; i++) { const fim = d.indexOf(0, o); const nome = d.toString('utf8', o, fim); o = fim + 1; const oid = d.readInt32BE(o + 6); o += 18; campos.push({ nome, oid }); }
          linhas = []; break;
        }
        case 'D': {
          const d = m.dados; const nc = d.readInt16BE(0); let o = 2; const row = {};
          for (let i = 0; i < nc; i++) { const l = d.readInt32BE(o); o += 4; const v = l < 0 ? null : d.toString('utf8', o, o + l); if (l > 0) o += l; row[campos[i].nome] = converter(campos[i].oid, v); }
          linhas.push(row); break;
        }
        case 'C': { const tag = m.dados.toString('utf8', 0, m.dados.length - 1).split(' '); rowCount = Number(tag.at(-1)) || 0; break; }
        case 'E': erro = Ligacao.erro(m.dados); break;
        case 'Z': if (erro) throw erro; return { rows: linhas, rowCount };
        default: break; // 1, 2, n, I, s
      }
    }
  }
  fechar() { try { this.sock?.write(this.enviar('X')); this.sock?.end(); } catch {} this.morta = true; }
}

function criarPool(url, max = 4) {
  const cfg = lerConfig(url);
  const livres = [], esperas = []; let total = 0;
  async function obter() {
    while (livres.length) { const l = livres.pop(); if (!l.morta) return l; total--; }
    if (total < max) { total++; const l = new Ligacao(cfg); try { await l.ligar(); return l; } catch (e) { total--; throw e; } }
    return new Promise(ok => esperas.push(ok));
  }
  function devolver(l) {
    if (l.morta) { total--; if (esperas.length) obter().then(esperas.shift()); return; }
    if (esperas.length) esperas.shift()(l); else livres.push(l);
  }
  return {
    async query(sql, params) { const l = await obter(); try { return await l.consulta(sql, params); } finally { devolver(l); } },
    async ligacao() { const l = await obter(); return { query: (s, p) => l.consulta(s, p), libertar: () => devolver(l) }; },
    fechar() { livres.forEach(l => l.fechar()); },
  };
}

module.exports = { criarPool, ErroPg };
