// Ligação à base de dados PostgreSQL (Neon na Vercel, ou qualquer Postgres)
// Lê DATABASE_URL (ou POSTGRES_URL, nome usado por integrações antigas da Vercel).
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { criarPool } = require('./pg');

const URL_BD = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
let pool = null;
function obterPool() {
  if (!URL_BD) { const e = new Error('Base de dados não configurada: defina a variável DATABASE_URL (na Vercel: Storage → ligar a base de dados Neon ao projeto).'); e.status = 503; throw e; }
  if (!pool) pool = criarPool(URL_BD, Number(process.env.PG_POOL_MAX || (process.env.VERCEL ? 3 : 8)));
  return pool;
}

// Converte "?" em $1, $2… (o código da API usa "?"); ignora texto entre plicas
const cacheSQL = new Map();
function converter(sql) {
  let c = cacheSQL.get(sql); if (c) return c;
  let i = 0, dentro = false; c = '';
  for (const ch of sql) { if (ch === "'") dentro = !dentro; c += (ch === '?' && !dentro) ? '$' + (++i) : ch; }
  cacheSQL.set(sql, c); return c;
}
function interface_(q) {
  return {
    _q: q,
    get: async (sql, ...p) => (await q(converter(sql), p)).rows[0],
    all: async (sql, ...p) => (await q(converter(sql), p)).rows,
    run: async (sql, ...p) => { const r = await q(converter(sql), p); return { changes: r.rowCount, rows: r.rows, id: r.rows[0]?.id }; },
  };
}
const db = interface_((s, p) => obterPool().query(s, p));

// Executa uma função dentro de uma transacção (tudo ou nada) numa só ligação
async function tx(fn) {
  const l = await obterPool().ligacao();
  try {
    await l.query('BEGIN');
    const r = await fn(interface_(l.query));
    await l.query('COMMIT');
    return r;
  } catch (e) { try { await l.query('ROLLBACK'); } catch {} throw e; }
  finally { l.libertar(); }
}
const exec = sql => obterPool().query(sql); // várias instruções, sem parâmetros
const exec_ = (d, sql) => d._q(sql); // idem, dentro de uma transacção

// ---------- criação automática da base de dados ----------
const SCHEMA = path.join(__dirname, '..', 'database', 'schema.sql');
let pronta = null;
function garantirBD() {
  if (!pronta) pronta = (async () => {
    // auditoria é a tabela mais recente (v3.4): se faltar, a base de dados é actualizada
    const t = await db.get(`SELECT to_regclass('public.imagens') AS ok, to_regclass('public.utilizadores') AS u, to_regclass('public.auditoria') AS v`);
    if (t.ok && t.u && t.v && (await db.get('SELECT EXISTS (SELECT 1 FROM utilizadores) AS e')).e) return;
    // Tudo numa só transacção (compatível com o pooler PgBouncer da Neon); o bloqueio
    // impede que dois pedidos em simultâneo criem a base de dados duas vezes.
    await tx(async d => {
      await d.get('SELECT pg_advisory_xact_lock(360360) AS ok');
      await exec_(d, fs.readFileSync(SCHEMA, 'utf8'));
      if (!(await d.get('SELECT EXISTS (SELECT 1 FROM utilizadores) AS e')).e) {
        console.log('Base de dados vazia: a criar o catálogo e as contas iniciais…');
        await require('./semear').semear(d);
      } else {
        // Base de dados já existente: o esquema acima acrescentou as colunas novas; grava as traduções iniciais em falta
        for (const [tab, campo, nome, v] of require('./semear').listaTraducoes())
          await d.run(`UPDATE ${tab} SET i18n = ? WHERE ${campo} = ? AND (i18n IS NULL OR i18n = '' OR i18n = '{}')`, JSON.stringify(v), nome);
        // v3.4: coordenadas, gastronomia com fontes, fontes de dados, estádios e jogos; os eventos de exemplo deixam de ser mostrados
        await require('./dados-aplicar').aplicarDadosV34(d, { desativarExemplos: true });
        console.log('Base de dados actualizada para a versão 3.4.');
      }
    });
  })().catch(e => { pronta = null; throw e; });
  return pronta;
}

// ---------- senhas (scrypt) ----------
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(senha, salt, 64).toString('hex')}`;
}
function verificaSenha(senha, guardado) {
  const [alg, salt, h] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !salt || !h) return false;
  const calc = crypto.scryptSync(senha, salt, 64), ref = Buffer.from(h, 'hex');
  return ref.length === calc.length && crypto.timingSafeEqual(ref, calc);
}
const parseJSON = (v, d = []) => { if (v == null || v === '') return d; try { return JSON.parse(v); } catch { return d; } };

module.exports = { ...db, db, tx, exec, garantirBD, hashSenha, verificaSenha, parseJSON, fecharPool: () => pool?.fechar() };
