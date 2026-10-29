// Gera o SQL que grava as traduções do catálogo inicial numa base de dados já existente.
// Uso: node scripts/traducoes-sql.js > traducoes.sql   (depois cole no SQL Editor da Neon)
const { listaTraducoes } = require('../src/semear');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
for (const [t, campo, nome, v] of listaTraducoes()) console.log(`UPDATE ${t} SET i18n = ${q(JSON.stringify(v))} WHERE ${campo} = ${q(nome)} AND (i18n IS NULL OR i18n = '' OR i18n = '{}');`);
