// Dados verificados da Angola 365º (v3.4): coordenadas, gastronomia, fontes, estádios e jogos iniciais.
// Regra: só se grava o que tem fonte. Campos sem confirmação ficam vazios e a interface mostra «indisponível».
// Coordenadas: OpenStreetMap (Nominatim), consultado a 29/10/2026. ODbL — © contribuidores do OpenStreetMap.
const VERIF = '2026-10-29';
const osm = (tipo, id) => `https://www.openstreetmap.org/${tipo}/${id}`;

// [nome no catálogo, lat, lon, estado, fonte, endereço, município, bairro]
const COORDENADAS = {
  destinos: [
    ['Ilha do Mussulo', -8.9870931, 13.0348936, 'aproximada', osm('way', 656298664), 'Restinga do Mussulo', 'Belas', null],
    ['Cataratas da Kalandula', -9.0740668, 16.0003160, 'verificada', osm('node', 2051535982), 'Quedas de Calandula, rio Lucala', 'Calandula', null],
    ['Pedras Negras de Pungo Andongo', -9.6762896, 15.6230882, 'verificada', osm('way', 202428550), 'Pungo Andongo', 'Cacuso', null],
    ['Baía dos Tigres', -16.6632629, 11.7704620, 'aproximada', osm('way', 765576472), 'Parque Nacional do Iona', 'Tômbwa', null],
    ['Luanda', -8.8053524, 13.2232637, 'aproximada', osm('way', 460638748), 'Avenida 4 de Fevereiro (Marginal)', 'Luanda', 'Kinanga'],
    ['Cidade Alta de Luanda', -8.8163385, 13.2241375, 'aproximada', osm('way', 432803568), 'Cidade Alta (zona do Palácio Presidencial)', 'Luanda', 'Coqueiros'],
    ['Trilho das Pedras Negras', -9.6762896, 15.6230882, 'aproximada', osm('way', 202428550), 'Pungo Andongo', 'Cacuso', null],
  ],
  experiencias: [
    ['Aventura nas Cataratas da Kalandula', -9.0740668, 16.0003160, 'aproximada', osm('node', 2051535982), 'Quedas de Calandula', 'Calandula', null],
    ['Pôr do Sol na Ilha do Mussulo', -8.9870931, 13.0348936, 'aproximada', osm('way', 656298664), 'Restinga do Mussulo', 'Belas', null],
    ['Trilha nas Pedras Negras', -9.6762896, 15.6230882, 'aproximada', osm('way', 202428550), 'Pungo Andongo', 'Cacuso', null],
    ['City Tour Histórico em Luanda', -8.8076194, 13.2232255, 'aproximada', osm('way', 1124468591), 'Fortaleza de São Miguel (ponto de partida indicativo)', 'Luanda', 'Kinanga'],
  ],
  alojamentos: [
    ['InterContinental Luanda Miramar', -8.8117641, 13.2426060, 'verificada', osm('way', 207147951), 'Rua Jawaharlal Nehru, Miramar', 'Luanda', 'Miramar'],
    ['EPIC SANA Luanda Hotel', -8.8145805, 13.2351559, 'verificada', osm('way', 220688398), 'Rua Nossa Senhora da Muxima, Mutamba', 'Luanda', 'Mutamba'],
    ['Hotel Presidente Luanda', -8.8036265, 13.2422402, 'verificada', osm('way', 61885002), 'Rua Diogo Cão, 4', 'Luanda', 'Ingombota'],
    ['Hotel Alvalade', -8.8351782, 13.2331832, 'verificada', osm('way', 60334858), 'Avenida Comandante Gika', 'Luanda', 'Alvalade'],
    ['Skyna Hotel Luanda', -8.8160491, 13.2345575, 'verificada', osm('way', 196602076), 'Avenida de Portugal, 29, Mutamba', 'Luanda', 'Mutamba'],
    ['Thomson House Hotel', -8.7718847, 13.2506926, 'verificada', osm('node', 5151070661), 'Avenida Murtala Mohamed, Ilha de Luanda', 'Luanda', 'Ilha de Luanda'],
    ['Hotel Praia Morena', -12.5776211, 13.4089739, 'verificada', osm('way', 1182943680), 'Rua José Estêvão, Bairro do Tchioge', 'Benguela', 'Tchioge'],
    ['Hotel Serra da Chela', -14.9331489, 13.4686989, 'verificada', osm('way', 831591803), 'Avenida Presidente Marien Ngouabi', 'Lubango', null],
    ['Pululukwa', -14.9025987, 13.4593448, 'aproximada', osm('way', 184301582), 'Via de acesso ao Pululukwa Resort, Mapunda', 'Lubango', 'Mapunda'],
  ],
  restaurantes: [
    ['Cafe del Mar', -8.7646959, 13.2581738, 'verificada', osm('node', 2024632578), 'Avenida Murtala Mohamed, Ilha de Luanda', 'Luanda', 'Ilha de Luanda'],
    ["Pimm's", -8.8328926, 13.2363066, 'verificada', osm('node', 4650224089), "Rua Emílio M'Bidi, 112", 'Luanda', 'Maianga'],
    ['Restaurante O Naval', -8.7981204, 13.2245660, 'aproximada', osm('way', 493231887), 'Clube Naval de Luanda, Marginal', 'Luanda', null],
    ['Lookal Mar', -8.7664002, 13.2565731, 'verificada', osm('node', 5151071219), 'Avenida Murtala Mohamed, 13, Ilha de Luanda', 'Luanda', 'Ilha de Luanda'],
    ['La Vigia', -8.8220098, 13.2394137, 'verificada', osm('node', 4307104793), 'Rua Nicolau Gomes Spencer, Maculusso', 'Luanda', 'Maculusso'],
    ['Espaço Luanda', -8.9168723, 13.1991740, 'verificada', osm('node', 4543244891), 'Rua Império Lunda-Tchokwe, Talatona', 'Talatona', 'Talatona'],
    ['Vitruvio', -8.8147941, 13.2351826, 'verificada', osm('node', 5913654533), 'Rua da Missão, Mutamba', 'Luanda', 'Mutamba'],
    ['Churrascaria Nandinhos', -8.8165855, 13.2414551, 'verificada', osm('node', 5913097775), 'Avenida Comandante Valódia, 13, Vila Alice', 'Luanda', 'Vila Alice'],
    ['Peixe do Cabo', -8.7782427, 13.2427864, 'verificada', osm('node', 5148615016), 'Avenida Murtala Mohamed, Ilha de Luanda', 'Luanda', 'Ilha de Luanda'],
    ['Restaurante Veneza', -8.8226266, 13.2424664, 'verificada', osm('node', 4307104792), 'Avenida Comandante Che Guevara, 116/120, Maculusso', 'Luanda', 'Maculusso'],
    ['Funge House', -8.8189322, 13.2372548, 'verificada', osm('node', 3756298384), 'Avenida Lenine, 35/37, Mutamba', 'Luanda', 'Mutamba'],
    ['Kintal da Tia Guida', -8.7786932, 13.2421463, 'verificada', osm('node', 5148614998), 'Avenida Murtala Mohamed, Ilha de Luanda', 'Luanda', 'Ilha de Luanda'],
  ],
};

const VA_TRAD = 'https://www.verangola.net/va/pt/012021/Gastronomia/23594/Onde-comer-pratos-tradicionais-em-Luanda.htm';
// Restaurantes de cozinha tradicional citados pela VerAngola (15/01/2021), com localização no OpenStreetMap
const RESTAURANTES_NOVOS = [
  { nome: 'Funge House', prov: 'Luanda', local: 'Mutamba, Luanda', esp: 'Angolana · Funge', nivel: '$$', img: 'f_muamba', desc: 'Casa de pratos típicos angolanos, conhecida pelo funge (VerAngola, 2021).', fonte: VA_TRAD },
  { nome: 'Kintal da Tia Guida', prov: 'Luanda', local: 'Ilha de Luanda', esp: 'Angolana · Mufete', nivel: '$$', img: 'xp_gastro', desc: 'Espaço de cozinha local angolana na Ilha de Luanda, referido para mufete (VerAngola, 2021).', fonte: VA_TRAD },
];

const WIKI = 'https://en.wikipedia.org/wiki/Angolan_cuisine';
// Gastronomia: descrições e ingredientes conforme a fonte indicada. Região só quando a fonte a indica.
const PRATOS = [
  { nome: 'Muamba de Galinha', ingredientes: ['Galinha', 'Pasta de dendém', 'Quiabo', 'Alho', 'Óleo de palma'], regiao: null, fonte: WIKI,
    historia: 'Galinha cozinhada com pasta de dendém, quiabos, alho e óleo de palma, servida com arroz e funge. Juntamente com o funge, é considerada prato nacional.' },
  { nome: 'Calulu de Peixe', ingredientes: ['Peixe seco', 'Cebola', 'Tomate', 'Quiabo', 'Batata-doce', 'Alho', 'Óleo de palma', 'Folhas de gimboa'], regiao: null, fonte: WIKI,
    historia: 'Peixe seco com legumes — cebola, tomate, quiabo, batata-doce, alho, óleo de palma e folhas de gimboa. Serve-se com arroz, funge, feijão de óleo de palma e farofa.' },
  { nome: 'Funge', categoria: 'Pratos', etiqueta: 'Base da mesa', img: 'f_muamba', ingredientes: ['Farinha de mandioca', 'Água'], regiao: null, fonte: WIKI,
    desc: 'Pasta de mandioca que acompanha quase todos os pratos angolanos.', historia: 'Papa de mandioca, alimento de base, comida com peixe, porco, galinha ou feijão. O funge de bombo, uma pasta cinzenta de mandioca, é mais comum no norte de Angola.' },
  { nome: 'Mufete', categoria: 'Pratos', etiqueta: 'Tradicional', img: 'xp_gastro', ingredientes: ['Peixe grelhado', 'Banana-pão', 'Batata-doce', 'Mandioca', 'Gari', 'Feijão de óleo de palma'], regiao: null, fonte: WIKI,
    desc: 'Peixe grelhado com banana-pão, batata-doce, mandioca e feijão de óleo de palma.', historia: 'Peixe grelhado servido com banana-pão, batata-doce, mandioca e gari. No mufete de kacusso, o peixe (muitas vezes tilápia do rio) leva molho de cebola, vinagre e especiarias e é acompanhado de feijão de óleo de palma.' },
  { nome: 'Moamba de Ginguba', categoria: 'Pratos', etiqueta: 'Tradicional', img: 'f_muamba', ingredientes: ['Galinha', 'Molho de ginguba (amendoim)'], regiao: null, fonte: WIKI,
    desc: 'Variante da muamba de galinha feita com molho de amendoim.', historia: 'Variante da muamba de galinha em que a pasta de dendém é substituída por ginguba (molho de amendoim).' },
  { nome: 'Kizaca com Peixe', categoria: 'Pratos', etiqueta: 'Tradicional', img: 'f_calulu', ingredientes: ['Folhas de mandioca', 'Peixe', 'Cebola', 'Tomate', 'Ginguba (opcional)'], regiao: null, fonte: WIKI,
    desc: 'Folhas de mandioca com peixe, cebola e tomate.', historia: 'A kizaca são folhas de mandioca, semelhantes a espinafres, muitas vezes preparadas com amendoim. A kizaca com peixe leva peixe, cebola e tomate e serve-se com arroz e funge.' },
  { nome: 'Cabidela', categoria: 'Pratos', etiqueta: 'Tradicional', img: 'f_churrasco', ingredientes: ['Galinha', 'Sangue', 'Vinagre', 'Tomate', 'Cebola', 'Alho'], regiao: null, fonte: WIKI,
    desc: 'Prato cozinhado no próprio sangue, normalmente de galinha.', historia: 'Prato cozinhado em sangue, servido com arroz e funge; faz-se muitas vezes com galinha, vinagre, tomate, cebola e alho.' },
  { nome: 'Kissângua', categoria: 'Bebidas', etiqueta: 'Sem álcool', img: 'xp_gastro', ingredientes: ['Farinha de milho'], regiao: 'Sul de Angola', fonte: WIKI,
    desc: 'Bebida tradicional não alcoólica feita de farinha de milho.', historia: 'Bebida tradicional não alcoólica feita de farinha de milho, especialidade do sul de Angola.' },
  { nome: 'Cocada Amarela', categoria: 'Doces', etiqueta: 'Sobremesa', img: 'f_bolinho', ingredientes: ['Açúcar', 'Coco ralado', 'Gemas de ovo', 'Canela'], regiao: null, fonte: WIKI,
    desc: 'Doce de coco com gemas de ovo e canela.', historia: 'Pudim amarelo de coco feito com açúcar, coco ralado, gemas de ovo e canela em pó.' },
];
// Onde comer: só ligações confirmadas por uma fonte
const PRATOS_RESTAURANTES = [
  ['Mufete', 'Peixe do Cabo', VA_TRAD, '2021-01-15'],
  ['Mufete', 'Kintal da Tia Guida', VA_TRAD, '2021-01-15'],
  ['Funge', 'Funge House', VA_TRAD, '2021-01-15'],
];

const RNA = 'https://teste.rna.ao/inicio.php#calendario';
const FONTES = [
  { nome: 'Rádio 5 (RNA) — calendário de futebol', url: RNA, tipo: 'futebol', metodo: 'json_rna', endpoint: 'https://teste.rna.ao/ajax_inicio.php?acao=jogos_proximos&limite=100', oficial: 0, frequencia_h: 24,
    notas: 'A página carrega os jogos de ajax_inicio.php (JSON, CORS aberto). Subdomínio «teste»: tratar como fonte identificada, não oficial. Sem API documentada, sem RSS e sem robots.txt; recolha moderada (1 pedido/dia) e com identificação. Também há acao=resultados.' },
  { nome: 'Rádio 5 (RNA) — resultados', url: RNA, tipo: 'futebol', metodo: 'json_rna', endpoint: 'https://teste.rna.ao/ajax_inicio.php?acao=resultados&limite=50', oficial: 0, frequencia_h: 24,
    notas: 'Mesma origem; devolve jogos terminados com pontos_casa/pontos_fora (golos).' },
  { nome: 'Federação Angolana de Futebol (FAF)', url: 'https://faf.co.ao/Resultados', tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168,
    notas: 'Página pública «Resultados e Calendário» com os jogos das seleções. Os dados vêm de uma API interna (Neon Data API) que exige token anónimo da própria página: não documentada nem pública, por isso não se usa sem autorização. Inserção manual no painel; a FAF marca muitas datas como «a validar».' },
  { nome: 'FIFA — Angola', url: 'https://www.fifa.com/', tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168, notas: 'Calendário e ranking da Selecção. Sem feed público adequado identificado; consulta manual.' },
  { nome: 'CAF', url: 'https://www.cafonline.com/', tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168, notas: 'Competições africanas de clubes e selecções. Consulta manual.' },
  { nome: 'Petro de Luanda (canais oficiais)', url: null, tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168, notas: 'Site e redes oficiais do clube; confirmar o endereço oficial antes de publicar ligações.' },
  { nome: 'Clube Desportivo 1.º de Agosto (canais oficiais)', url: null, tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168, notas: 'Idem.' },
  { nome: 'Sagrada Esperança (canais oficiais)', url: null, tipo: 'futebol', metodo: 'manual', oficial: 1, frequencia_h: 168, notas: 'Idem.' },
  { nome: 'VerAngola — agenda e gastronomia', url: 'https://www.verangola.net/', tipo: 'eventos', metodo: 'manual', oficial: 0, frequencia_h: 168, notas: 'Portal de notícias e sugestões; fonte secundária. Usado para restaurantes de cozinha tradicional.' },
  { nome: 'Ticket.ao', url: 'https://ticket.ao/', tipo: 'eventos', metodo: 'manual', oficial: 0, frequencia_h: 24, notas: 'Plataforma angolana de venda de bilhetes. Sem API, RSS ou iCal (só páginas HTML). Eventos copiados manualmente com ligação para a página de compra; verificar semanalmente.' },
  { nome: 'Eventus.ao', url: 'https://www.eventus.ao/cidades/luanda', tipo: 'eventos', metodo: 'manual', oficial: 0, frequencia_h: 168, notas: 'Agenda de eventos por cidade. Sem API, RSS ou iCal visíveis; consulta manual.' },
  // Pesquisa diária com IA em sites públicos (a IA só extrai o que está escrito na página; cada evento fica com a ligação de origem)
  { nome: 'Ticket.ao — pesquisa diária com IA', url: 'https://ticket.ao/', tipo: 'eventos', metodo: 'ia_pagina', endpoint: 'https://ticket.ao/', oficial: 0, frequencia_h: 24, notas: 'Página pública lida diariamente; a IA extrai título, data, local, preço e a ligação de compra. Respeita robots.txt.' },
  { nome: 'Eventus.ao (Luanda) — pesquisa diária com IA', url: 'https://www.eventus.ao/cidades/luanda', tipo: 'eventos', metodo: 'ia_pagina', endpoint: 'https://www.eventus.ao/cidades/luanda', oficial: 0, frequencia_h: 24, notas: 'Agenda pública por cidade; lida diariamente pela IA. Respeita robots.txt.' },
  { nome: 'VerAngola — agenda de eventos (pesquisa diária com IA)', url: 'https://www.verangola.net/', tipo: 'eventos', metodo: 'ia_pagina', endpoint: 'https://www.verangola.net/va/pt/{MMAAAA}/eventos/', oficial: 0, frequencia_h: 24, notas: 'Agenda pública com ~24 eventos por página (música, feiras, teatro, gastronomia, desporto). {MMAAAA} = mês corrente. Lida diariamente; cada evento fica com a ligação para a página do VerAngola. Respeita robots.txt.' },
  { nome: 'VerAngola — agenda, página 2 (pesquisa diária com IA)', url: 'https://www.verangola.net/', tipo: 'eventos', metodo: 'ia_pagina', endpoint: 'https://www.verangola.net/va/pt/{MMAAAA}/eventos/?ls-art24=24', oficial: 0, frequencia_h: 24, notas: 'Segunda página da agenda do VerAngola.' },
  { nome: 'Notícias e rumores (Google Notícias) — pesquisa diária com IA', url: 'https://news.google.com/', tipo: 'eventos', metodo: 'ia_noticias', endpoint: 'https://news.google.com/rss/search?q=Angola%20(festival%20OR%20concerto%20OR%20feira%20OR%20evento%20OR%20exposi%C3%A7%C3%A3o%20OR%20carnaval%20OR%20maratona)%20when%3A14d&hl=pt-PT&gl=PT&ceid=PT%3Apt-150', oficial: 0, frequencia_h: 24, notas: 'Feed RSS público de notícias (ANGOP, Jornal de Angola, Novo Jornal, etc.). Anúncios ainda não confirmados ficam marcados como «rumor»; cada um mantém a ligação para a notícia.' },
  { nome: 'Inserção manual (equipa Angola 365º)', url: null, tipo: 'eventos', metodo: 'manual', oficial: 0, frequencia_h: 0, notas: 'Eventos introduzidos e validados no painel.' },
];

// [nome, aliases, cidade, província, lat, lon, estado, fonte]
const ESTADIOS = [
  ['Estádio Nacional 11 de Novembro', ['Estádio 11 de Novembro'], 'Luanda (Talatona)', 'Luanda', -8.9699209, 13.2835311, 'verificada', osm('way', 150587643)],
  ['Estádio 22 de Junho', ['Estadio 22 de junho', 'Estádio 22 de junho'], 'Luanda', 'Luanda', -8.8691221, 13.2089245, 'aproximada', osm('way', 60355361) + ' (correspondência por nome alternativo; o OSM identifica o recinto como Estádio Joaquim Dinis)'],
  ['Estádio França Ndalu', ["Estádio França N'dalu", "Estadio França N'dalo", 'Estádio França Ndalu'], 'Luanda', 'Luanda', -8.8412727, 13.2416782, 'verificada', osm('way', 583759413)],
  ['Estádio Nacional de Ombaka', ['Estádio de Ombaka'], 'Benguela', 'Benguela', -12.5427142, 13.4600223, 'verificada', osm('way', 235129721)],
  ['Estádio Álvaro Buta', ['Estádio Alvaro Buta'], "M'banza Kongo", 'Zaire', -6.2646594, 14.2410146, 'verificada', osm('way', 1244664086)],
  ['Estádio Nacional da Tundavala', ['Estádio Tundavala', 'Estádio da Tundavala'], 'Lubango', 'Huíla', -14.9485828, 13.5375268, 'verificada', osm('way', 183973868)],
  ['Estádio Mário Pacheco', [], null, null, null, null, null, null],
  ['Estádio Municipal de Benguela', [], 'Benguela', 'Benguela', null, null, null, null],
  ['Estádio Mundunduleno', [], null, null, null, null, null, null],
  ['Estádio Sagrada Esperança', ['Estádio do Sagrada Esperança'], null, 'Lunda Norte', null, null, null, null],
  ['Estádio Daniel Lutucuta', [], null, null, null, null, null, null],
];

// Jogos iniciais lidos da Rádio 5 a 29/10/2026 (a sincronização diária mantém-nos actualizados)
const JOGOS_RNA = [
  ['35', '2026-10-30 15:30', '9', 'Grupo Desportivo Interclube', 'Clube Desportivo da Huíla', 'Estádio 22 de junho'],
  ['36', '2026-10-31 15:00', '9', 'Clube Recreativo e Desportivo do Libolo', 'Clube Desportivo Sagrada Esperança', 'Estádio Mário Pacheco'],
  ['37', '2026-10-31 15:00', '9', 'Académica Petróleos Clube do Lobito', 'Futebol Clube Bravos do Maquis', 'Estádio Nacional de Ombaka'],
  ['38', '2026-10-31 15:30', '9', 'Clube Desportivo Primeiro de Agosto', 'Petróleos de Luanda', 'Estádio França Ndalu'],
  ['39', '2026-11-01 15:00', '9', 'Kabuscorp Sport Clube do Palanca', 'Clube Recreativo da Caála', 'Estádio França Ndalu'],
  ['40', '2026-11-01 15:00', '9', 'São Salvador do Kongo Futebol Clube', 'Clube Desportivo da Lunda-Sul', 'Estádio Alvaro Buta'],
  ['41', '2026-11-01 15:30', '9', 'Estrela Clube Primeiro de Maio', 'Futebol Clube de Luanda', 'Estádio Municipal de Benguela'],
  ['42', '2026-11-01 17:15', '9', 'Wiliete Sport Clube de Benguela', 'Futebol Clube de Cabinda', 'Estádio Nacional de Ombaka'],
  ['101', '2026-11-04 15:30', '7', 'Clube Desportivo Primeiro de Agosto', 'Wiliete Sport Clube de Benguela', "Estadio França N'dalo"],
  ['43', '2026-11-07 15:00', '10', 'Clube Recreativo e Desportivo do Libolo', 'Clube Desportivo Primeiro de Agosto', 'Estádio Mário Pacheco'],
  ['44', '2026-11-07 15:00', '10', 'Futebol Clube Bravos do Maquis', 'Grupo Desportivo Interclube', 'Estádio Mundunduleno'],
  ['45', '2026-11-07 15:00', '10', 'Clube Desportivo Sagrada Esperança', 'Futebol Clube de Cabinda', 'Estádio Sagrada Esperança'],
  ['46', '2026-11-08 15:00', '10', 'Clube Recreativo da Caála', 'Académica Petróleos Clube do Lobito', 'Estádio Daniel Lutucuta'],
  ['47', '2026-11-08 15:00', '10', 'Futebol Clube de Luanda', 'São Salvador do Kongo Futebol Clube', 'Estádio França Ndalu'],
  ['48', '2026-11-08 15:00', '10', 'Clube Desportivo da Huíla', 'Kabuscorp Sport Clube do Palanca', 'Estádio Tundavala'],
  ['49', '2026-11-08 15:00', '10', 'Clube Desportivo da Lunda-Sul', 'Wiliete Sport Clube de Benguela', 'Estádio Sagrada Esperança'],
  ['50', '2026-11-08 17:15', '10', 'Petróleos de Luanda', 'Estrela Clube Primeiro de Maio', 'Estádio 11 de Novembro'],
  ['51', '2026-11-21 15:00', '11', 'Clube Recreativo da Caála', 'Estrela Clube Primeiro de Maio', 'Estádio Daniel Lutucuta'],
  ['52', '2026-11-21 15:00', '11', 'Académica Petróleos Clube do Lobito', 'Clube Recreativo e Desportivo do Libolo', 'Estádio Nacional de Ombaka'],
  ['53', '2026-11-21 15:00', '11', 'Grupo Desportivo Interclube', 'Petróleos de Luanda', 'Estádio 22 de Junho'],
  ['54', '2026-11-21 15:00', '11', 'Académica Petróleos Clube do Lobito', 'Clube Recreativo e Desportivo do Libolo', 'Estádio de Ombaka'],
  ['55', '2026-11-21 15:00', '11', 'Grupo Desportivo Interclube', 'Petróleos de Luanda', 'Estádio 22 de Junho'],
  ['56', '2026-11-21 15:00', '11', 'São Salvador do Kongo Futebol Clube', 'Clube Desportivo Primeiro de Agosto', 'Estádio Alvaro Buta'],
  ['57', '2026-11-21 15:00', '11', 'Futebol Clube de Cabinda', 'Futebol Clube Bravos do Maquis', "Estádio França N'dalu"],
  ['58', '2026-11-21 15:00', '11', 'Kabuscorp Sport Clube do Palanca', 'Futebol Clube de Luanda', 'Estádio 22 de Junho'],
  ['59', '2026-11-21 15:00', '11', 'Wiliete Sport Clube de Benguela', 'Clube Desportivo Sagrada Esperança', 'Estádio Nacional de Ombaka'],
  ['60', '2026-11-21 15:00', '11', 'Clube Desportivo da Lunda-Sul', 'Clube Desportivo da Huíla', 'Estádio do Sagrada Esperança'],
  ['88', '2026-12-09 15:30', '5', 'Clube Desportivo Sagrada Esperança', 'Petróleos de Luanda', 'Estádio Sagrada Esperança'],
];
// Resultados recentes lidos da mesma fonte
const RESULTADOS_RNA = [
  ['r1', '2026-10-18 17:00', 'Petróleos de Luanda', 'Kabuscorp Sport Clube do Palanca', 1, 0],
  ['r2', '2026-10-18 16:00', 'São Salvador do Kongo Futebol Clube', 'Estrela Clube Primeiro de Maio', 2, 1],
  ['r3', '2026-10-18 15:00', 'Futebol Clube de Luanda', 'Clube Desportivo da Huíla', 0, 2],
  ['r4', '2026-10-17 15:30', 'Clube Recreativo e Desportivo do Libolo', 'Grupo Desportivo Interclube', 0, 1],
  ['r5', '2026-10-17 15:00', 'Clube Desportivo Sagrada Esperança', 'Clube Recreativo da Caála', 1, 1],
  ['r6', '2026-10-17 15:00', 'Futebol Clube Bravos do Maquis', 'Clube Desportivo da Lunda-Sul', 0, 0],
  ['r7', '2026-10-17 15:00', 'Futebol Clube de Cabinda', 'Académica Petróleos Clube do Lobito', 0, 0],
];
// Jogos das seleções segundo a FAF (página pública, revisão de 27/10/2026): datas a validar pela FAF/CAF
const JOGOS_FAF = [
  ['faf-1', '2026-11-09 00:00', 'Qualificação CAN Sub-23 2027 · 2.ª ronda · 1.ª mão', 'Angola Sub-23', 'Congo Sub-23', null, 'Calendário publicado na imprensa; aguarda confirmação da CAF/FAF. Hora e estádio por confirmar.'],
  ['faf-2', '2026-11-11 00:00', 'Selecção A', 'Angola', 'Sudão do Sul', 'Estádio Nacional 11 de Novembro', 'Data provisória: as fontes divergem entre 11 e 14 de novembro. Hora por confirmar.'],
  ['faf-3', '2026-11-15 00:00', 'Selecção A', 'Sudão do Sul', 'Angola', null, 'Data provisória: as fontes divergem entre 15 e 17 de novembro. Jogo fora de Angola.'],
  ['faf-4', '2026-11-17 00:00', 'Qualificação CAN Sub-23 2027 · 2.ª ronda · 2.ª mão', 'Congo Sub-23', 'Angola Sub-23', null, 'Jogo fora de Angola; aguarda confirmação.'],
  ['faf-5', '2027-03-24 00:00', 'Selecção A', 'Angola', 'Egipto', null, 'Estádio por confirmar.'],
  ['faf-6', '2027-03-28 00:00', 'Selecção A', 'Malawi', 'Angola', null, 'Jogo fora de Angola.'],
];


// Eventos reais publicados em plataformas de bilhética (consultadas a 29/10/2026). Fonte secundária identificada:
// os bilhetes vendem-se no canal indicado (a Angola 365º não vende estes bilhetes). Preço = mínimo publicado.
const TK = u => 'https://ticket.ao/event/' + u + '/';
const L = (lat, lon, fonte, estado = 'verificada') => ({ lat, lon, fonte, estado });
const PF = L(-8.8121790, 13.2356518, osm('way', 408043157));
const EVENTOS_REAIS = [
  { id: 'tk-okazulu', titulo: 'Dançar Kuya | OKAZULU – O Despertar da Identidade', data: '2026-10-30', hora: '20:00', local: 'Palácio de Ferro, Luanda', cat: 'Cultura', preco: 6000, precoTxt: '6.000 – 10.000 Kz', url: TK('dancar-kuya-okazulu-o-despertar-da-identidade'), img: 'ev_carnaval', geo: PF },
  { id: 'tk-solaris', titulo: 'Solaris Beach Sunset – Mussulo', data: '2026-10-31', hora: '15:00', local: 'Ilha dos Pássaros, Mussulo', cat: 'Música', preco: 25000, precoTxt: '25.000 – 50.000 Kz', url: TK('solaris-beach-sunset-mussulo'), img: 'ev_kite', geo: L(-8.9870931, 13.0348936, osm('way', 656298664), 'aproximada') },
  { id: 'tk-pia', titulo: 'Praça Internacional de Angola (PIA)', data: '2026-11-06', hora: '10:00', local: 'Memorial Dr. António Agostinho Neto, Nova Marginal de Luanda', cat: 'Cultura', preco: 5000, precoTxt: '5.000 – 80.000 Kz', url: TK('praca-internacional-de-angola-pia'), img: 'ev_festival', geo: L(-8.8236124, 13.2189354, osm('way', 303576831), 'aproximada') },
  { id: 'tk-ancestralidade', titulo: 'As Músicas que os Meus Pais Ouviam | Ancestralidade', data: '2026-11-08', hora: '16:00', local: 'Palácio de Ferro, Luanda', cat: 'Música', preco: 8000, precoTxt: '8.000 – 30.000 Kz', url: TK('as-musicas-que-os-meus-pais-ouviam-ancestralidade'), img: 'ev_jazz', geo: PF },
  { id: 'tk-nayela', titulo: 'Nayela ao Vivo', data: '2026-11-10', hora: '20:00', local: 'Zunga, Rua César de Menezes, 10, Coqueiros, Luanda', cat: 'Música', preco: 15000, precoTxt: '15.000 Kz', url: TK('nayela-ao-vivo'), img: 'ev_yola', geo: null },
  { id: 'tk-streetkings', titulo: 'Street Kings Cup Angola 2026', data: '2026-11-11', hora: '10:00', local: 'Estádio Mário Santiago, Luanda', cat: 'Esportes', preco: 6000, precoTxt: '6.000 – 35.000 Kz', url: TK('street-kings-cup-angola-2026'), img: 'ev_girabola', geo: L(-8.8079629, 13.2686292, osm('way', 50543865)) },
  { id: 'tk-caboledo', titulo: 'Cabo Ledo – Rota de Verão (excursão)', data: '2026-11-11', hora: '07:00', local: 'Partida de Luanda', cat: 'Turismo', preco: 35432, precoTxt: '35.432 – 100.996 Kz', url: TK('cabo-ledo-rota-de-verao'), img: 'mussulo', geo: null },
  { id: 'tk-batuque', titulo: 'Fest Batuque – Criative Economy Hub', data: '2026-11-13', hora: '10:00', local: 'Palácio de Ferro, Luanda', cat: 'Cultura', preco: 5000, precoTxt: '5.000 Kz', url: TK('fest-batuque-criative-economy-hub'), img: 'ev_festa', geo: PF },
  { id: 'ev-gala-vida', titulo: 'Gala – Celebração de Vida 2026', data: '2026-11-13', hora: '19:00', local: 'Hotel InterContinental, Luanda', cat: 'Cultura', preco: 66500, precoTxt: 'desde 66.500 Kz', url: 'https://www.eventus.ao/eventos/gala-celebracao-de-vida-2026', fonte: 'Eventus.ao', img: 'h_epic', geo: L(-8.8117641, 13.2426060, osm('way', 207147951)) },
  { id: 'tk-negoncalves', titulo: 'Né Gonçalves & Banda Sembamar – O Semba Continua', data: '2026-11-20', hora: '20:30', local: 'Casa das Artes, Talatona', cat: 'Música', preco: 35000, precoTxt: '35.000 Kz', url: TK('ne-goncalves-banda-sembamar-o-semba-continua'), img: 'ev_jazz', geo: L(-8.9193479, 13.1950746, osm('way', 1517240269)) },
  { id: 'tk-sportstourism', titulo: 'Angola Sports Tourism Summit 2026', data: '2026-11-26', hora: '09:00', local: 'Centro Cultural Paz Flor, Luanda', cat: 'Negócios', preco: 25000, precoTxt: '25.000 – 150.000 Kz', url: TK('angola-sports-tourism-summit-2026'), img: 'ev_forum', geo: L(-8.8890363, 13.1816359, osm('way', 287219474), 'aproximada') },
  { id: 'tk-anabela', titulo: 'Concerto PF | Anabela Aya', data: '2026-11-27', hora: '19:00', local: 'Palácio de Ferro, Luanda', cat: 'Música', preco: 10000, precoTxt: '10.000 Kz', url: TK('concerto-pf-anabela-aya'), img: 'ev_yola', geo: PF },
  { id: 'tk-angelfashion', titulo: 'Angel Fashion 2026 – O Grito da Ancestralidade', data: '2026-11-28', hora: '18:30', local: 'Palácio de Ferro, Luanda', cat: 'Cultura', preco: 5000, precoTxt: '5.000 Kz', url: TK('angel-fashion-2026-o-grito-da-ancestralidade-the-angel-models'), img: 'ev_carnaval', geo: PF },
  { id: 'tk-annajoyce', titulo: 'Grande Show da Zimbo – Ao Vivo Anna Joyce', data: '2026-11-28', hora: '19:30', local: 'Pátio da TV Zimbo, Talatona', cat: 'Música', preco: 50000, precoTxt: '50.000 Kz', url: TK('grande-show-da-zimbo-ao-vivo-anna-joyce'), img: 'ev_festival', geo: null },
  { id: 'tk-putoportugues', titulo: 'Grande Show Puto Português – 20 Anos de Carreira', data: '2026-12-12', hora: '19:00', local: 'Arena da Centralidade do Kilamba', cat: 'Música', preco: 10000, precoTxt: '10.000 – 350.000 Kz', url: TK('grande-show-puto-portugues-20-anos-de-carreira'), img: 'ev_festival', geo: L(-8.9785512, 13.2833997, osm('way', 502884435), 'aproximada') },
  { id: 'tk-afropulse', titulo: 'Afropulse Baía 2027', data: '2027-02-04', dataFim: '2027-02-06', hora: '15:00', local: 'Baía de Luanda', cat: 'Festivais', preco: 15000, precoTxt: '15.000 – 25.000 Kz (por dia)', url: TK('afropulse-baia-2027-4-fev'), img: 'ev_festival', geo: L(-8.8053524, 13.2232637, osm('way', 460638748), 'aproximada') },
];

module.exports = { EVENTOS_REAIS, VERIF, COORDENADAS, RESTAURANTES_NOVOS, PRATOS, PRATOS_RESTAURANTES, FONTES, ESTADIOS, JOGOS_RNA, RESULTADOS_RNA, JOGOS_FAF, WIKI, VA_TRAD };
