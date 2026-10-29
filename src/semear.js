// Catálogo inicial e contas de demonstração (usado na criação automática da base de dados e por `npm run seed`)
const J = JSON.stringify;
const img = n => /\.(svg|webp|jpg)$/.test(n) ? `/img/${n}` : `/img/${n}.jpg`;

const PROVINCIAS = [
  ['Bengo','Caxito'],['Benguela','Benguela'],['Bié','Cuíto'],['Cabinda','Cabinda'],['Cuando','Mavinga'],['Cubango','Menongue'],
  ['Cuanza Norte',"N'dalatando"],['Cuanza Sul','Sumbe'],['Cunene','Ondjiva'],['Huambo','Huambo'],['Huíla','Lubango'],
  ['Icolo e Bengo','Catete'],['Luanda','Luanda'],['Lunda Norte','Dundo'],['Lunda Sul','Saurimo'],['Malanje','Malanje'],
  ['Moxico','Luena'],['Moxico Leste','Cazombo'],['Namibe','Moçâmedes'],['Uíge','Uíge'],['Zaire','Mbanza Kongo'],
];

const DESTINOS = [
  { nome:'Ilha do Mussulo', prov:'Luanda', cat:'Praias', desc:'Praias paradisíacas e tranquilidade a poucos minutos da cidade.', rating:4.8, rev:126, img:'mussulo', destaque:1,
    kw:'mussulo,ilha do mussulo', historia:'A Ilha do Mussulo é, na verdade, uma restinga de areia com cerca de 30 quilómetros, a sul de Luanda. Chega-se de barco a partir do Embarcadouro, numa travessia curta. Tem águas calmas do lado da baía, ideais para banho e desportos náuticos, e praias abertas ao oceano do outro lado.',
    dica:'Vá durante a semana para apanhar menos gente e fique até ao pôr do sol, que é dos mais bonitos de Luanda.', quando:'Todo o ano; a época seca, de maio a setembro, tem o mar mais calmo.' },
  { nome:'Cataratas da Kalandula', prov:'Malanje', cat:'Natureza', desc:'Uma das maiores e mais impressionantes cataratas de África.', rating:4.9, rev:98, img:'kalandula', destaque:1,
    kw:'kalandula,calandula,cataratas,quedas', historia:'As Cataratas da Kalandula ficam no rio Lucala, na província de Malanje, a cerca de 360 quilómetros de Luanda. São das maiores quedas de água de África em volume, com mais de 100 metros de altura e várias centenas de metros de largura. O miradouro de cima dá a vista panorâmica, e um trilho leva até à base, onde se sente a força da água.',
    dica:'Leve calçado com boa aderência e uma capa para a água: perto da base fica tudo molhado.', quando:'Na época das chuvas, de novembro a abril, o caudal é mais impressionante.' },
  { nome:'Pedras Negras de Pungo Andongo', prov:'Malanje', cat:'Cultura', desc:'Formações rochosas únicas e cheias de história e misticismo.', rating:4.7, rev:87, img:'pungo', destaque:1,
    kw:'pedras negras,pungo,pungo andongo', historia:'As Pedras Negras de Pungo Andongo são enormes monólitos de rocha escura que se erguem na savana de Malanje. O lugar está ligado à história da Rainha Njinga Mbandi, e a tradição diz que as marcas na rocha são as pegadas dela. Foi também uma antiga sede do reino do Ndongo.',
    dica:'Contrate um guia local para ouvir as lendas e subir aos melhores miradouros com segurança.', quando:'Na época seca, de maio a outubro, os trilhos estão em melhores condições.' },
  { nome:'Baía dos Tigres', prov:'Namibe', cat:'Praias', desc:'Águas cristalinas e paisagens que encantam qualquer visitante.', rating:4.6, rev:74, img:'tigres', destaque:1,
    kw:'baia dos tigres,tigres', historia:'A Baía dos Tigres fica no Parque Nacional do Iona, no Namibe. Em 1962 o mar rompeu o istmo e a antiga península tornou-se ilha, deixando abandonada a vila piscatória de São Martinho dos Tigres. Hoje é um destino remoto, de dunas, deserto e mar.',
    dica:'Só se visita com operadores especializados, em viatura 4x4 e com barco; marque com antecedência.', quando:'De maio a outubro, com menos vento e temperaturas agradáveis.' },
  { nome:'Luanda', prov:'Luanda', cat:'Cidades', desc:'A capital vibrante, onde tradição e modernidade se encontram.', rating:4.5, rev:154, img:'luanda', destaque:1,
    kw:'luanda,capital', historia:'Luanda foi fundada em 1576 por Paulo Dias de Novais e é hoje a capital e a maior cidade de Angola. A Marginal acompanha a baía, a Fortaleza de São Miguel conta a história militar e o Memorial Agostinho Neto marca o horizonte. A Ilha de Luanda concentra praias, restaurantes e a vida noturna.',
    dica:'Ao fim da tarde, caminhe pela Marginal e termine num restaurante da Ilha.', quando:'Todo o ano; o cacimbo, de junho a setembro, é mais fresco.' },
  { nome:'Cidade Alta de Luanda', prov:'Luanda', cat:'Cultura', desc:'Centro histórico com o Palácio, igrejas coloniais e vista sobre a baía.', rating:4.6, rev:65, img:'cidadealta', destaque:1,
    kw:'cidade alta', historia:'A Cidade Alta é o núcleo histórico e institucional de Luanda, no planalto sobre a baía. Ali estão o Palácio, edifícios coloniais e algumas das igrejas mais antigas da cidade, com vista sobre a Marginal e a Baixa.',
    dica:'Combine com a Fortaleza de São Miguel e o Museu de Antropologia no mesmo dia.', quando:'De manhã cedo, com luz suave e menos calor.' },
  { nome:'Trilho das Pedras Negras', prov:'Malanje', cat:'Aventura', desc:'Caminhadas e escaladas entre monólitos com séculos de lendas.', rating:4.6, rev:43, img:'xp_trilha', destaque:0,
    kw:'trilho,trilha,caminhada', historia:'O trilho pelas Pedras Negras atravessa passagens entre monólitos e sobe a miradouros com vista sobre o vale. É uma caminhada de dificuldade moderada, para quem gosta de natureza e história.',
    dica:'Leve água, chapéu e comece cedo.', quando:'Época seca, de maio a outubro.' },
];

const INCLUI = ['Guia local especializado','Transporte ida e volta','Água mineral durante o tour','Paragens para fotos','Seguro de viagem'];
const EXPERIENCIAS = [
  { titulo:'Aventura nas Cataratas da Kalandula', prov:'Malanje', local:'Malanje', cat:'Natureza', desc:'Trilhas, vista panorâmica e banho nas águas cristalinas.', longo:'Viva uma experiência inesquecível na maior queda de água de Angola! Desfrute de trilhas guiadas, miradouros incríveis e banho nas águas cristalinas da Kalandula. Natureza, aventura e conexão com o essencial. Partida de Luanda às 05:30, almoço típico em Malanje e regresso ao fim do dia.', preco:25000, rating:4.9, rev:98, img:'xp_kal', dur:'1 dia', gmin:2, gmax:12, disp:'Todos os dias', idiomas:'PT, EN', gal:['g1','g2','g3','g4','kalandula'], destaque:1 },
  { titulo:'Imersão na Cultura e Tradições', prov:'Huíla', local:'Lubango, Huíla', cat:'Cultura', desc:'Música, dança, artesanato e história que encantam.', longo:'Uma tarde com grupos de dança tradicional do Lubango, oficina de artesanato e conversa com contadores de histórias. Inclui prova de pratos regionais.', preco:15000, rating:4.8, rev:76, img:'xp_cult', dur:'5 horas', gmin:2, gmax:20, disp:'Qua a Dom', idiomas:'PT, EN, FR', gal:['xp_cult','ev_carnaval','r_sabor','ev_festa'], destaque:1 },
  { titulo:'Sabores de Angola — Tour Gastronómico', prov:'Luanda', local:'Luanda', cat:'Gastronomia', desc:'Descubra os sabores típicos da nossa terra.', longo:'Percurso por mercados e restaurantes de Luanda com degustação de muamba, calulu, mufete e doces tradicionais, guiado por um chef local.', preco:18000, rating:4.7, rev:65, img:'xp_gastro', dur:'4 horas', gmin:2, gmax:10, disp:'Ter a Sáb', idiomas:'PT, EN', gal:['xp_gastro','f_muamba','f_calulu','f_bolinho'], destaque:1 },
  { titulo:'Pôr do Sol na Ilha do Mussulo', prov:'Luanda', local:'Ilha do Mussulo, Luanda', cat:'Natureza', desc:'Passeio de barco e relaxamento nas praias paradisíacas.', longo:'Travessia de barco desde o Embarcadouro, tarde na praia com bebida de boas-vindas e regresso ao pôr do sol.', preco:20000, rating:4.8, rev:54, img:'xp_sol', dur:'5 horas', gmin:2, gmax:15, disp:'Todos os dias', idiomas:'PT, EN', gal:['xp_sol','mussulo','h_resort','ev_kite'], destaque:0 },
  { titulo:'Trilha nas Pedras Negras', prov:'Malanje', local:'Pungo Andongo, Malanje', cat:'Aventura', desc:'Caminhada guiada por formações rochosas únicas e místicas.', longo:'Subida guiada aos monólitos de Pungo Andongo, com paragem nas pegadas da Rainha Njinga e vista sobre o vale do Kwanza.', preco:12000, rating:4.6, rev:43, img:'xp_trilha', dur:'1 dia', gmin:2, gmax:12, disp:'Sex a Dom', idiomas:'PT', gal:['xp_trilha','pungo','g2','g4'], destaque:0 },
  { titulo:'City Tour Histórico em Luanda', prov:'Luanda', local:'Luanda', cat:'Cultura', desc:'Visite os principais pontos históricos e culturais da capital.', longo:'Fortaleza de São Miguel, Cidade Alta, Memorial Agostinho Neto, Marginal e Museu Nacional de Antropologia, com guia certificado.', preco:10000, rating:4.5, rev:37, img:'xp_city', dur:'6 horas', gmin:2, gmax:20, disp:'Todos os dias', idiomas:'PT, EN, ES', gal:['xp_city','cidadealta','luanda','hero'], destaque:0 },
];

// Estabelecimentos reais, ainda não parceiros: sem preço inventado (preço sob consulta).
// Fontes públicas indicadas em `fonte`. As fotografias são ilustrativas (Wikimedia Commons).
const F_HOTEIS = 'https://www.queroviajarmais.com/hoteis-em-angola/';
const ALOJAMENTOS = [
  { nome:'InterContinental Luanda Miramar', prov:'Luanda', local:'Miramar, Luanda', tipo:'Hotéis', etiqueta:'Rede IHG', amen:['Wi-Fi','Piscina','Pequeno-almoço','Estacionamento'], img:'al_banner', fonte:F_HOTEIS },
  { nome:'EPIC SANA Luanda Hotel', prov:'Luanda', local:'Luanda', tipo:'Hotéis', etiqueta:'5 estrelas', amen:['Wi-Fi','Piscina','Spa','Pequeno-almoço'], img:'h_epic', fonte:F_HOTEIS },
  { nome:'Hotel Presidente Luanda', prov:'Luanda', local:'Luanda', tipo:'Hotéis', etiqueta:'4 estrelas', amen:['Wi-Fi','Pequeno-almoço','Estacionamento'], img:'luanda', fonte:F_HOTEIS },
  { nome:'Hotel Alvalade', prov:'Luanda', local:'Alvalade, Luanda', tipo:'Hotéis', etiqueta:'4 estrelas', amen:['Wi-Fi','Piscina','Pequeno-almoço'], img:'h_villa', fonte:F_HOTEIS },
  { nome:'Palmeiras Suite Hotel', prov:'Luanda', local:'Talatona, Luanda', tipo:'Hotéis', etiqueta:'Piscina na cobertura', amen:['Wi-Fi','Piscina','Spa'], img:'h_resort', fonte:F_HOTEIS },
  { nome:'Skyna Hotel Luanda', prov:'Luanda', local:'Centro, Luanda', tipo:'Hotéis', etiqueta:'4 estrelas', amen:['Wi-Fi','Spa','Pequeno-almoço'], img:'h_epic', fonte:F_HOTEIS },
  { nome:'RK Suite Hotel', prov:'Luanda', local:'Kinaxixe, Luanda', tipo:'Apartamentos', etiqueta:'Aparthotel', amen:['Wi-Fi','Cozinha','Ar condicionado','Pequeno-almoço'], img:'h_apt', fonte:F_HOTEIS },
  { nome:'Thomson House Hotel', prov:'Luanda', local:'Luanda', tipo:'Pousadas', etiqueta:'Económico', amen:['Wi-Fi','Cozinha'], img:'h_cazenga', fonte:F_HOTEIS },
  { nome:'Hotel Residencial Ramire-Tour', prov:'Benguela', local:'Benguela', tipo:'Pousadas', etiqueta:'Guest house', amen:['Wi-Fi','Ar condicionado'], img:'h_cazenga', fonte:F_HOTEIS },
  { nome:'Hotel Praia Morena', prov:'Benguela', local:'Praia Morena, Benguela', tipo:'Hotéis', etiqueta:'Junto à praia', amen:['Wi-Fi'], img:'h_morena', fonte:'https://www.verangola.net/va/pt/042020/sugestoes/19383/Hotel-Praia-Morena-Onde-dormir.htm' },
  { nome:'Hotel Serra da Chela', prov:'Huíla', local:'Lubango, Huíla', tipo:'Hotéis', etiqueta:'Destaque na Huíla', amen:['Wi-Fi'], img:'h_epic', fonte:'https://backoffice.angop.ao/en/noticias/turismo/huila-com-duas-unidades-em-destaque-nas-avaliacoes-dos-clientes-pelo-hoteis-angola' },
  { nome:'Pululukwa', prov:'Huíla', local:'Lubango, Huíla', tipo:'Resorts', etiqueta:'Destaque na Huíla', amen:['Wi-Fi','Piscina'], img:'h_resort', fonte:'https://backoffice.angop.ao/en/noticias/turismo/huila-com-duas-unidades-em-destaque-nas-avaliacoes-dos-clientes-pelo-hoteis-angola' },
];

const EVENTOS = [
  { titulo:'Show de Yola Araújo em Luanda', prov:'Luanda', local:'Baía de Luanda', data:'2026-11-14', hora:'20:00', cat:'Música', preco:5000, lot:3000, img:'ev_yola' },
  { titulo:'Girabola: 1.º de Agosto x Petro de Luanda', prov:'Luanda', local:'Estádio 11 de Novembro', data:'2026-11-22', hora:'16:00', cat:'Esportes', preco:3000, lot:45000, img:'ev_girabola' },
  { titulo:'Festival Gastronómico de Benguela', prov:'Benguela', local:'Praia do Lobito', data:'2026-12-05', hora:'12:00', cat:'Gastronomia', preco:2500, lot:2000, img:'ev_festival' },
  { titulo:'Luanda Jazz Festival', prov:'Luanda', local:'Centro Cultural de Belas, Luanda', data:'2026-12-12', hora:'19:00', cat:'Música', preco:7500, lot:1500, img:'ev_jazz', desc:'Grandes nomes do jazz nacional e internacional num só palco.' },
  { titulo:'Fórum de Investimento Angola 2027', prov:'Luanda', local:'Talatona Convention Center, Luanda', data:'2027-01-20', hora:'09:00', cat:'Negócios', preco:25000, lot:800, img:'ev_forum', desc:'Conectando oportunidades e impulsionando o futuro dos negócios em Angola.' },
  { titulo:'Campeonato Nacional de Kitesurf', prov:'Luanda', local:'Praia do Mussulo, Luanda', data:'2027-01-30', hora:'10:00', cat:'Esportes', preco:0, lot:1000, img:'ev_kite', desc:'Adrenalina e vento forte nas águas do Mussulo. Participe ou venha assistir!' },
  { titulo:'Carnaval de Luanda 2027', prov:'Luanda', local:'Marginal de Luanda', data:'2027-02-07', hora:'10:00', cat:'Cultura', preco:0, lot:20000, img:'ev_carnaval', desc:'Os grupos carnavalescos desfilam na Marginal com música, dança e cor.' },
  { titulo:'Festa da Nossa Senhora do Mar', prov:'Benguela', local:'Benguela', data:'2027-02-14', hora:'18:00', cat:'Cultura', preco:0, lot:5000, img:'ev_festa', desc:'Celebração tradicional com música, dança e homenagem ao mar.' },
];

const PRATOS = [
  { nome:'Muamba de Galinha', cat:'Pratos', etiqueta:'Prato típico', desc:'O prato mais tradicional de Angola. Sabor único!', historia:'A muamba de galinha é o prato nacional: galinha cozinhada com óleo de palma, quiabos, abóbora e alho, servida com funje.', rating:4.8, rev:126, img:'f_muamba' },
  { nome:'Churrasco à Angolana', cat:'Pratos', etiqueta:'Popular', desc:'Carnes suculentas com toques de temperos locais.', historia:'Carnes grelhadas na brasa com jindungo, alho e limão, presença obrigatória nos fins de semana em família.', rating:4.7, rev:98, img:'f_churrasco' },
  { nome:'Calulu de Peixe', cat:'Pratos', etiqueta:'Tradicional', desc:'Peixe seco, legumes e muito sabor.', historia:'O calulu leva peixe seco e fresco, tomate, quiabo, beringela e folhas de batata-doce, tudo com óleo de palma.', rating:4.6, rev:87, img:'f_calulu' },
  { nome:'Bolinho de Chuva', cat:'Doces', etiqueta:'Doce', desc:'O doce que não pode faltar nas tardes!', historia:'Bolinhos fritos de massa simples, polvilhados com açúcar e canela, comuns nos lanches de família.', rating:4.9, rev:143, img:'f_bolinho' },
];

const F_REST = 'https://www.tripadvisor.com/Restaurants-g293763-Luanda_Luanda_Province.html';
const RESTAURANTES = [
  { nome:'Cafe del Mar', esp:'Saudável · Internacional', nivel:'$$', img:'r_tasca' },
  { nome:"Pimm's", esp:'Europeia · Portuguesa', nivel:'$$$', img:'r_mar' },
  { nome:'Restaurante O Naval', esp:'Internacional', nivel:'$$', img:'r_sabor' },
  { nome:'Lookal Mar', esp:'Marisco · Mediterrânica', nivel:'$$$', img:'f_calulu' },
  { nome:'La Vigia', esp:'Marisco · Grelhados', nivel:'$$', img:'f_churrasco' },
  { nome:'Espaço Luanda', esp:'Grelhados · Internacional', nivel:'$$', img:'r_sabor' },
  { nome:'Vitruvio', esp:'Italiana', nivel:'$$$', img:'r_mar' },
  { nome:'O Madeirense', esp:'Portuguesa · Grelhados', nivel:'$$', img:'r_sabor' },
  { nome:'Origami Restaurant & Terrace', esp:'Africana · Mediterrânica', nivel:'$$$', img:'luanda', extra:' com vista sobre a Marginal e a baía de Luanda' },
  { nome:'Churrascaria Nandinhos', esp:'Churrasco', nivel:'$', img:'f_churrasco' },
  { nome:'Peixe do Cabo', esp:'Africana', nivel:'$$', img:'xp_gastro' },
  { nome:'Restaurante Veneza', esp:'Internacional · Europeia', nivel:'$$', img:'r_tasca' },
].map(r => ({ ...r, prov:'Luanda', local:'Luanda', desc:`Restaurante de cozinha ${r.esp.toLowerCase().replace(' · ', ' e ')}${r.extra || ''}, entre os mais procurados de Luanda no Tripadvisor.`, fonte:F_REST }));

// Rent-a-car: Europcar no Aeroporto de Luanda (modelos e preços indicativos da vipcars.com, 27/10/2026)
const F_CARROS = 'https://www.vipcars.com/pt/car-rental/angola/luanda/luanda-airport';
const VIATURAS = [
  { nome:'Hyundai i10', cat:'Económicos', lug:4, ind:'USD 34,58/dia', img:'c_i10' },
  { nome:'Hyundai Grand i10', cat:'Económicos', lug:5, ind:'USD 37,29/dia', img:'c_grandi10' },
  { nome:'Hyundai Accent', cat:'Sedans', lug:5, ind:'USD 48,12/dia', img:'c_accent' },
  { nome:'Suzuki Jimny', cat:'SUVs', lug:4, ind:'USD 59,87/dia', img:'c_jimny' },
  { nome:'Mitsubishi L200', cat:'SUVs', lug:5, ind:'USD 91,47/dia', img:'c_l200' },
  { nome:'Hyundai H1', cat:'Vans', lug:9, ind:'USD 109,53/dia', img:'c_h1' },
];

const TRADUTORES = [
  { nome:'Carlos M.', idiomas:['Inglês','Espanhol'], preco:5000, km:1.2, on:1, rating:4.9, rev:128, img:'t_carlos.svg' },
  { nome:'Ana P.', idiomas:['Francês','Inglês'], preco:6000, km:1.8, on:1, rating:4.8, rev:96, img:'t_ana.svg' },
  { nome:'David K.', idiomas:['Mandarim','Inglês'], preco:7500, km:2.3, on:0, rating:4.9, rev:74, img:'t_david.svg' },
  { nome:'Maria S.', idiomas:['Espanhol','Inglês'], preco:5000, km:2.7, on:1, rating:4.7, rev:63, img:'t_maria.svg' },
];

const AVALIACOES = [
  ['experiencia',1,'Joana N.','Luanda',5,'Organização impecável, o guia conhecia cada miradouro. Valeu cada kwanza.'],
  ['experiencia',1,'Mateus K.','Lubango',5,'Experiência muito bem cuidada. Recomendo ir na época das chuvas.'],
  ['experiencia',1,'Aisha B.','Lagos',5,'Our guide switched to English for us. Unforgettable views.'],
  ['experiencia',2,'Paulo D.','Luanda',5,'Os grupos de dança foram o ponto alto. Saí com vontade de voltar ao Lubango.'],
  ['experiencia',2,'Claire M.','Paris',4,'Très bonne immersion, artisanat superbe. Un peu long au déjeuner.'],
  ['experiencia',3,'Helena S.','Benguela',5,'O chef explicou a origem de cada prato. A muamba estava incrível.'],
  ['experiencia',3,'Tom R.','Londres',4,'Great food tour, come hungry!'],
  ['experiencia',4,'Inês T.','Luanda',5,'Pôr do sol fantástico e barco pontual. Perfeito para casais.'],
  ['experiencia',5,'Rui A.','Malanje',4,'Subida exigente mas a vista compensa. Levem muita água.'],
  ['experiencia',6,'Sofia L.','Huambo',5,'Guia muito bem preparado, aprendi imenso sobre a história de Luanda.'],
];


// Traduções (inglês, francês, espanhol) para a coluna i18n: [tabela, campo do nome, nome em PT, traduções]
function listaTraducoes() {
  const TR = require('./traducoes'); const L = [];
  for (const [n, v] of Object.entries(TR.destinos)) L.push(['destinos', 'nome', n, v]);
  for (const x of EXPERIENCIAS) { const v = TR.porExperiencia(x); if (v) L.push(['experiencias', 'titulo', x.titulo, v]); }
  for (const [n, v] of Object.entries(TR.eventos)) L.push(['eventos', 'titulo', n, v]);
  for (const [n, v] of Object.entries(TR.pratos)) L.push(['pratos', 'nome', n, v]);
  for (const r of RESTAURANTES) L.push(['restaurantes', 'nome', r.nome, TR.restaurante(r.esp, r.extra)]);
  return L;
}

async function semear(dExterno) {
  const { tx, hashSenha } = require('./db');
  const corpo = async d => {
    const ids = {};
    for (const [n, c] of PROVINCIAS) ids[n] = (await d.run('INSERT INTO provincias (nome, capital) VALUES (?, ?) RETURNING id', n, c)).id;
    const prov = n => ids[n] ?? null;

    for (const x of DESTINOS) await d.run(`INSERT INTO destinos (nome, provincia_id, categoria, descricao, historia, quando_ir, dica, palavras_chave, imagem, rating, num_avaliacoes, destaque) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      x.nome, prov(x.prov), x.cat, x.desc, x.historia, x.quando, x.dica, x.kw, img(x.img), x.rating, x.rev, x.destaque);
    for (const x of EXPERIENCIAS) await d.run(`INSERT INTO experiencias (titulo, provincia_id, local, categoria, descricao, descricao_longa, preco, duracao, grupo_min, grupo_max, disponibilidade, idiomas, inclui, imagem, galeria, rating, num_avaliacoes, destaque) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      x.titulo, prov(x.prov), x.local, x.cat, x.desc, x.longo, x.preco, x.dur, x.gmin, x.gmax, x.disp, x.idiomas, J(INCLUI), img(x.img), J(x.gal.map(img)), x.rating, x.rev, x.destaque);
    for (const a of ALOJAMENTOS) await d.run(`INSERT INTO alojamentos (nome, provincia_id, local, tipo, etiqueta, comodidades, preco_noite, quartos, imagem, parceiro, fonte) VALUES (?,?,?,?,?,?,NULL,10,?,0,?)`,
      a.nome, prov(a.prov), a.local, a.tipo, a.etiqueta, J(a.amen), img(a.img), a.fonte);
    for (const e of EVENTOS) await d.run(`INSERT INTO eventos (titulo, provincia_id, local, data, hora, categoria, descricao, preco, lotacao, imagem) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      e.titulo, prov(e.prov), e.local, e.data, e.hora, e.cat, e.desc || null, e.preco, e.lot, img(e.img));
    for (const p of PRATOS) await d.run(`INSERT INTO pratos (nome, categoria, etiqueta, descricao, historia, imagem, rating, num_avaliacoes) VALUES (?,?,?,?,?,?,?,?)`,
      p.nome, p.cat, p.etiqueta, p.desc, p.historia, img(p.img), p.rating, p.rev);
    for (const r of RESTAURANTES) await d.run(`INSERT INTO restaurantes (nome, provincia_id, local, descricao, nivel_preco, especialidade, preco_medio, imagem, parceiro, fonte) VALUES (?,?,?,?,?,?,NULL,?,0,?)`,
      r.nome, prov(r.prov), r.local, r.desc, r.nivel, r.esp, img(r.img), r.fonte);
    for (const c of VIATURAS) await d.run(`INSERT INTO viaturas (nome, categoria, lugares, transmissao, preco_dia, imagem, parceiro, empresa, local_levantamento, preco_indicativo, fonte) VALUES (?,?,?,'A confirmar',NULL,?,0,'Europcar','Aeroporto de Luanda',?,?)`,
      c.nome, c.cat, c.lug, img(c.img), c.ind, F_CARROS);
    for (const t of TRADUTORES) await d.run(`INSERT INTO tradutores (nome, idiomas, preco_hora, distancia_km, disponivel, imagem, rating, num_avaliacoes) VALUES (?,?,?,?,?,?,?,?)`,
      t.nome, J(t.idiomas), t.preco, t.km, t.on, img(t.img), t.rating, t.rev);

    for (const [t, campo, nome, v] of listaTraducoes()) await d.run(`UPDATE ${t} SET i18n = ? WHERE ${campo} = ?`, J(v), nome);
    await require('./dados-aplicar').aplicarDadosV34(d, { desativarExemplos: process.env.SEED_DEMO === '0' });

    // As avaliações iniciais já estão contadas no rating: desliga o trigger de médias durante a importação
    await d.run('ALTER TABLE avaliacoes DISABLE TRIGGER trg_avaliacao_media');
    for (const [tipo, id, nome, cidade, nota, txt] of AVALIACOES) await d.run('INSERT INTO avaliacoes (tipo, item_id, autor_nome, autor_cidade, nota, comentario) VALUES (?,?,?,?,?,?)', tipo, id, nome, cidade, nota, txt);
    await d.run('ALTER TABLE avaliacoes ENABLE TRIGGER trg_avaliacao_media');

    // ---------- contas ----------
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@turismo360.ao').toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'admin360';
    await d.run(`INSERT INTO utilizadores (nome, email, telefone, senha_hash, papel) VALUES (?,?,?,?, 'admin')`, 'Administrador SIGAF', adminEmail, '+244 926 239 938', hashSenha(adminPass));

    if (process.env.SEED_DEMO === '0') return;
    const uid = (await d.run(`INSERT INTO utilizadores (nome, email, telefone, senha_hash, saldo, pontos, criado_em) VALUES (?,?,?,?,?,?,?) RETURNING id`,
      'Visitante 360', 'visitante@turismo360.ao', '923 456 789', hashSenha('angola360'), 125000, 1250, '2026-10-01 09:00:00')).id;
    await d.run(`INSERT INTO favoritos (utilizador_id, tipo, item_id) VALUES (?, 'destino', 2), (?, 'experiencia', 1)`, uid, uid);

    const hist = [
      ['experiencia',6,'City Tour Histórico em Luanda','xp_city','2026-10-18 10:30:00','2026-10-19',2,'pessoa',10000,'Carteira 360','concluida','pago','Experiências'],
      ['experiencia',1,'Aventura nas Cataratas da Kalandula','xp_kal','2026-10-17 14:20:00','2026-10-25',1,'pessoa',25000,'Carteira 360','concluida','pago','Experiências'],
      ['experiencia',4,'Pôr do Sol na Ilha do Mussulo','xp_sol','2026-10-15 09:15:00','2026-11-02',3,'pessoa',20000,'Multicaixa Express','pendente','pendente','Experiências'],
      ['tradutor',1,'Tradutor Carlos M.','t_carlos.svg','2026-10-14 20:45:00','2026-10-14',2,'hora',5000,'Cartão •••• 4587','concluida','pago','Tradutores'],
    ];
    let n = 0;
    for (const [tipo, item, nome, im, quando, data, q, un, pu, met, est, estTx, cat] of hist) {
      const fim = null;
      const rid = (await d.run(`INSERT INTO reservas (codigo, utilizador_id, tipo, item_id, item_nome, imagem, data_inicio, data_fim, quantidade, unidade, preco_unitario, total, metodo_pagamento, estado, pontos_ganhos, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
        'TD-DEMO' + (++n), uid, tipo, item, nome, img(im), data, fim, q, un, pu, pu * q, met, est, est === 'pendente' ? 0 : Math.floor(pu * q / 100), quando)).id;
      await d.run(`INSERT INTO transacoes (utilizador_id, reserva_id, tipo, categoria, descricao, imagem, valor, metodo, estado, criado_em) VALUES (?,?, 'pagamento',?,?,?,?,?,?,?)`,
        uid, rid, cat, nome, img(im), pu * q, met, estTx, quando);
    }
    await d.run(`INSERT INTO notificacoes (utilizador_id, titulo, corpo, icone, destino) VALUES (?,?,?,?,?), (?,?,?,?,?)`,
      uid, 'Bem-vindo(a) ao Angola 365º', 'Eu sou a ENDA. Toque no meu ícone para pedir sugestões, roteiros ou convites.', 'star', null,
      uid, 'ENDA sugere', 'O Luanda Jazz Festival está a chegar. Quer convidar alguém?', 'music', 'eventos');

    // Clientes de demonstração com reservas ao longo do último mês (para o painel ter números)
    const CLIENTES = [['Joana Neto','joana.neto@exemplo.ao'],['Mateus Kiala','mateus.kiala@exemplo.ao'],['Helena Sousa','helena.sousa@exemplo.ao'],['Paulo Domingos','paulo.d@exemplo.ao'],['Inês Tavares','ines.t@exemplo.ao'],['Rui Afonso','rui.afonso@exemplo.ao']];
    const OPC = [
      ['experiencia',1,'Aventura nas Cataratas da Kalandula','xp_kal',25000,'pessoa','Experiências'],
      ['experiencia',3,'Sabores de Angola — Tour Gastronómico','xp_gastro',18000,'pessoa','Experiências'],
      ['experiencia',4,'Pôr do Sol na Ilha do Mussulo','xp_sol',20000,'pessoa','Experiências'],
      ['experiencia',2,'Imersão na Cultura e Tradições','xp_cult',15000,'pessoa','Experiências'],
      ['experiencia',5,'Trilha nas Pedras Negras','xp_trilha',12000,'pessoa','Experiências'],
      ['evento',4,'Luanda Jazz Festival','ev_jazz',7500,'bilhete','Eventos'],
      ['evento',1,'Show de Yola Araújo em Luanda','ev_yola',5000,'bilhete','Eventos'],
      ['evento',3,'Festival Gastronómico de Benguela','ev_festival',2500,'bilhete','Eventos'],
      ['tradutor',2,'Tradutor Ana P.','t_ana.svg',6000,'hora','Tradutores'],
    ];
    const METODOS = ['Carteira 360','Unitel Money','Multicaixa Express','Cartão •••• 4587'];
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const base = Date.now();
    const sqlData = ms => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
    for (let i = 0; i < CLIENTES.length; i++) {
      const [nome, email] = CLIENTES[i];
      const cid = (await d.run(`INSERT INTO utilizadores (nome, email, senha_hash, saldo, pontos, criado_em) VALUES (?,?,?,?,?,?) RETURNING id`,
        nome, email, hashSenha('demo' + (i + 1) + 'angola'), 20000 + i * 5000, 0, sqlData(base - (40 - i) * 864e5))).id;
      const k = 3 + Math.floor(rnd() * 4); let pts = 0;
      for (let j = 0; j < k; j++) {
        const [tipo, item, nomeItem, im, pu, un, cat] = OPC[Math.floor(rnd() * OPC.length)];
        const q = 1 + Math.floor(rnd() * 3);
        const met = METODOS[Math.floor(rnd() * METODOS.length)];
        const quando = sqlData(base - Math.floor(rnd() * 29) * 864e5 - Math.floor(rnd() * 10) * 36e5);
        const est = met === 'Multicaixa Express' && rnd() < .5 ? 'pendente' : (rnd() < .1 ? 'cancelada' : 'confirmada');
        const codigo = 'TD-' + Math.floor(rnd() * 1e8).toString(36).toUpperCase().padStart(6, '0') + i;
        const ptsG = est === 'confirmada' ? Math.floor(pu * q / 100) : 0; pts += ptsG;
        const rid = (await d.run(`INSERT INTO reservas (codigo, utilizador_id, tipo, item_id, item_nome, imagem, data_inicio, quantidade, unidade, preco_unitario, total, metodo_pagamento, estado, pontos_ganhos, criado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
          codigo, cid, tipo, item, nomeItem, img(im), quando.slice(0, 10), q, un, pu, pu * q, met, est, ptsG, quando)).id;
        await d.run(`INSERT INTO transacoes (utilizador_id, reserva_id, tipo, categoria, descricao, imagem, valor, metodo, estado, criado_em) VALUES (?,?, 'pagamento',?,?,?,?,?,?,?)`,
          cid, rid, cat, nomeItem, img(im), pu * q, met, est === 'pendente' ? 'pendente' : est === 'cancelada' ? 'reembolsado' : 'pago', quando);
        if (tipo === 'evento' && est !== 'cancelada') await d.run('UPDATE eventos SET bilhetes_vendidos = bilhetes_vendidos + ? WHERE id = ?', q, item);
      }
      await d.run('UPDATE utilizadores SET pontos = ? WHERE id = ?', pts, cid);
    }
    await d.run(`INSERT INTO pedidos_suporte (utilizador_id, assunto, mensagem) VALUES (?, ?, ?)`, uid, 'Alterar data de reserva', 'Posso mudar a data do passeio ao Mussulo para dia 3 de novembro?');
  };
  return dExterno ? corpo(dExterno) : tx(corpo);
}

module.exports = { semear, listaTraducoes };
