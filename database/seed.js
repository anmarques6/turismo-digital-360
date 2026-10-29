// Recria a base de dados com o catálogo inicial e as contas de demonstração.
// Uso:  npm run seed               (só funciona numa base de dados vazia)
//       npm run seed -- --apagar   (APAGA TUDO e recria — cuidado em produção!)
//       SEED_DEMO=0 npm run seed   (sem clientes nem reservas de demonstração)
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db');

(async () => {
  const apagar = process.argv.includes('--apagar');
  const existe = (await db.get(`SELECT to_regclass('public.utilizadores') AS t`)).t;
  if (existe && (await db.get('SELECT EXISTS (SELECT 1 FROM utilizadores) AS e')).e) {
    if (!apagar) { console.log('A base de dados já tem dados. Para apagar tudo e recriar use:  npm run seed -- --apagar'); return db.fecharPool(); }
    console.log('A apagar todas as tabelas…');
    await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }
  await db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await require('../src/semear').semear();
  for (const t of ['provincias','destinos','experiencias','alojamentos','eventos','pratos','restaurantes','viaturas','tradutores','avaliacoes','utilizadores','reservas','transacoes'])
    console.log(`  ${t.padEnd(14)} ${(await db.get(`SELECT COUNT(*) AS n FROM ${t}`)).n}`);
  console.log('Base de dados pronta.');
  db.fecharPool();
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
