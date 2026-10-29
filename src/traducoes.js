// Traduções do catálogo inicial (inglês, francês, espanhol), indexadas pelo nome em português.
// Usadas pelo semear.js (coluna i18n) e por scripts/traducoes-sql.js (actualizar uma base já existente).
// Depois de criada a base, as traduções editam-se no painel de administração (campo «Traduções»).

const destinos = {
  'Ilha do Mussulo': {
    en: { nome: 'Mussulo Island', descricao: 'Idyllic beaches and peace and quiet just minutes from the city.', historia: 'Mussulo Island is actually a sandspit about 30 kilometres long, south of Luanda. You get there by boat from the Embarcadouro jetty, on a short crossing. The bay side has calm water, ideal for swimming and water sports, while the other side has beaches open to the ocean.', dica: 'Go on a weekday to avoid the crowds and stay for the sunset, one of the most beautiful in Luanda.', quando_ir: 'All year round; the dry season, from May to September, has the calmest sea.' },
    fr: { nome: 'Île du Mussulo', descricao: 'Des plages paradisiaques et la tranquillité à quelques minutes de la ville.', historia: 'L’île du Mussulo est en réalité une flèche de sable d’environ 30 kilomètres, au sud de Luanda. On y accède en bateau depuis l’embarcadère, après une courte traversée. Côté baie, l’eau est calme, idéale pour la baignade et les sports nautiques ; de l’autre côté, les plages s’ouvrent sur l’océan.', dica: 'Allez-y en semaine pour éviter la foule et restez jusqu’au coucher du soleil, l’un des plus beaux de Luanda.', quando_ir: 'Toute l’année ; la saison sèche, de mai à septembre, offre la mer la plus calme.' },
    es: { nome: 'Isla de Mussulo', descricao: 'Playas paradisíacas y tranquilidad a pocos minutos de la ciudad.', historia: 'La isla de Mussulo es en realidad una lengua de arena de unos 30 kilómetros, al sur de Luanda. Se llega en barco desde el embarcadero, en una travesía corta. En el lado de la bahía el agua está tranquila, ideal para bañarse y hacer deportes náuticos; al otro lado, las playas se abren al océano.', dica: 'Ve entre semana para encontrar menos gente y quédate hasta la puesta de sol, una de las más bonitas de Luanda.', quando_ir: 'Todo el año; la estación seca, de mayo a septiembre, tiene el mar más tranquilo.' },
  },
  'Cataratas da Kalandula': {
    en: { nome: 'Kalandula Falls', descricao: 'One of the largest and most impressive waterfalls in Africa.', historia: 'The Kalandula Falls are on the Lucala River, in Malanje province, about 360 kilometres from Luanda. By volume they are among the largest waterfalls in Africa, over 100 metres high and several hundred metres wide. The upper viewpoint gives the panoramic view, and a trail leads down to the base, where you feel the full force of the water.', dica: 'Wear shoes with good grip and bring a rain jacket: near the base everything gets wet.', quando_ir: 'In the rainy season, from November to April, the flow is at its most impressive.' },
    fr: { nome: 'Chutes de Kalandula', descricao: 'L’une des chutes d’eau les plus grandes et impressionnantes d’Afrique.', historia: 'Les chutes de Kalandula se trouvent sur la rivière Lucala, dans la province de Malanje, à environ 360 kilomètres de Luanda. Par leur débit, elles comptent parmi les plus grandes d’Afrique, avec plus de 100 mètres de haut et plusieurs centaines de mètres de large. Le belvédère supérieur offre la vue panoramique, et un sentier descend jusqu’au pied des chutes, où l’on ressent toute la force de l’eau.', dica: 'Prévoyez des chaussures qui accrochent bien et une cape de pluie : au pied des chutes, tout est mouillé.', quando_ir: 'Pendant la saison des pluies, de novembre à avril, le débit est le plus impressionnant.' },
    es: { nome: 'Cataratas de Kalandula', descricao: 'Una de las cataratas más grandes e impresionantes de África.', historia: 'Las cataratas de Kalandula están en el río Lucala, en la provincia de Malanje, a unos 360 kilómetros de Luanda. Por su caudal son de las mayores de África, con más de 100 metros de altura y varios cientos de metros de anchura. El mirador superior ofrece la vista panorámica, y un sendero baja hasta la base, donde se siente toda la fuerza del agua.', dica: 'Lleva calzado con buen agarre y un chubasquero: cerca de la base todo se moja.', quando_ir: 'En la época de lluvias, de noviembre a abril, el caudal es más impresionante.' },
  },
  'Pedras Negras de Pungo Andongo': {
    en: { nome: 'Black Rocks of Pungo Andongo', descricao: 'Unique rock formations full of history and mystique.', historia: 'The Black Rocks of Pungo Andongo are huge monoliths of dark rock rising from the Malanje savannah. The site is linked to the story of Queen Njinga Mbandi, and tradition says the marks in the rock are her footprints. It was also a former seat of the Ndongo kingdom.', dica: 'Hire a local guide to hear the legends and climb safely to the best viewpoints.', quando_ir: 'In the dry season, from May to October, the trails are in better condition.' },
    fr: { nome: 'Pierres noires de Pungo Andongo', descricao: 'Des formations rocheuses uniques, chargées d’histoire et de mystère.', historia: 'Les Pierres noires de Pungo Andongo sont d’énormes monolithes de roche sombre qui se dressent dans la savane de Malanje. Le site est lié à l’histoire de la reine Njinga Mbandi : la tradition veut que les marques dans la roche soient ses empreintes. Ce fut aussi un ancien siège du royaume du Ndongo.', dica: 'Prenez un guide local pour entendre les légendes et monter en toute sécurité aux meilleurs belvédères.', quando_ir: 'Pendant la saison sèche, de mai à octobre, les sentiers sont en meilleur état.' },
    es: { nome: 'Piedras Negras de Pungo Andongo', descricao: 'Formaciones rocosas únicas, llenas de historia y misticismo.', historia: 'Las Piedras Negras de Pungo Andongo son enormes monolitos de roca oscura que se alzan en la sabana de Malanje. El lugar está ligado a la historia de la reina Njinga Mbandi, y la tradición dice que las marcas de la roca son sus huellas. También fue una antigua sede del reino de Ndongo.', dica: 'Contrata un guía local para escuchar las leyendas y subir con seguridad a los mejores miradores.', quando_ir: 'En la estación seca, de mayo a octubre, los senderos están en mejores condiciones.' },
  },
  'Baía dos Tigres': {
    en: { nome: 'Tigres Bay', descricao: 'Crystal-clear water and landscapes that win over every visitor.', historia: 'Tigres Bay lies in Iona National Park, in Namibe. In 1962 the sea broke through the isthmus and the former peninsula became an island, leaving the fishing town of São Martinho dos Tigres abandoned. Today it is a remote destination of dunes, desert and sea.', dica: 'It can only be visited with specialist operators, by 4x4 and boat; book well in advance.', quando_ir: 'From May to October, with less wind and pleasant temperatures.' },
    fr: { nome: 'Baie des Tigres', descricao: 'Des eaux cristallines et des paysages qui enchantent tous les visiteurs.', historia: 'La baie des Tigres se trouve dans le parc national d’Iona, dans le Namibe. En 1962, la mer a rompu l’isthme et l’ancienne péninsule est devenue une île, laissant à l’abandon le village de pêcheurs de São Martinho dos Tigres. C’est aujourd’hui une destination isolée, entre dunes, désert et océan.', dica: 'La visite se fait uniquement avec des opérateurs spécialisés, en 4x4 et en bateau ; réservez longtemps à l’avance.', quando_ir: 'De mai à octobre, avec moins de vent et des températures agréables.' },
    es: { nome: 'Bahía de los Tigres', descricao: 'Aguas cristalinas y paisajes que encantan a cualquier visitante.', historia: 'La bahía de los Tigres está en el Parque Nacional de Iona, en Namibe. En 1962 el mar rompió el istmo y la antigua península se convirtió en isla, dejando abandonado el pueblo pesquero de São Martinho dos Tigres. Hoy es un destino remoto de dunas, desierto y mar.', dica: 'Solo se visita con operadores especializados, en 4x4 y en barco; reserva con antelación.', quando_ir: 'De mayo a octubre, con menos viento y temperaturas agradables.' },
  },
  'Luanda': {
    en: { descricao: 'The vibrant capital, where tradition meets modernity.', historia: 'Luanda was founded in 1576 by Paulo Dias de Novais and is today the capital and largest city of Angola. The Marginal waterfront follows the bay, the São Miguel Fortress tells the military history and the Agostinho Neto Memorial dominates the skyline. Luanda Island is home to beaches, restaurants and the nightlife.', dica: 'In the late afternoon, walk along the Marginal and finish at a restaurant on the Island.', quando_ir: 'All year round; the cacimbo season, from June to September, is cooler.' },
    fr: { descricao: 'La capitale vibrante, où tradition et modernité se rencontrent.', historia: 'Luanda a été fondée en 1576 par Paulo Dias de Novais ; c’est aujourd’hui la capitale et la plus grande ville d’Angola. La Marginal longe la baie, la forteresse de São Miguel raconte l’histoire militaire et le mémorial Agostinho Neto domine l’horizon. L’île de Luanda concentre plages, restaurants et vie nocturne.', dica: 'En fin d’après-midi, promenez-vous sur la Marginal et terminez dans un restaurant de l’Île.', quando_ir: 'Toute l’année ; le cacimbo, de juin à septembre, est plus frais.' },
    es: { descricao: 'La vibrante capital, donde la tradición y la modernidad se encuentran.', historia: 'Luanda fue fundada en 1576 por Paulo Dias de Novais y hoy es la capital y la mayor ciudad de Angola. La Marginal recorre la bahía, la Fortaleza de San Miguel cuenta la historia militar y el Memorial Agostinho Neto domina el horizonte. La Isla de Luanda concentra playas, restaurantes y vida nocturna.', dica: 'Al final de la tarde, pasea por la Marginal y termina en un restaurante de la Isla.', quando_ir: 'Todo el año; el cacimbo, de junio a septiembre, es más fresco.' },
  },
  'Cidade Alta de Luanda': {
    en: { nome: 'Cidade Alta, Luanda', descricao: 'Historic centre with the Palace, colonial churches and views over the bay.', historia: 'Cidade Alta is the historic and institutional heart of Luanda, on the plateau above the bay. It is home to the Palace, colonial buildings and some of the oldest churches in the city, with views over the Marginal and the Baixa.', dica: 'Combine it with the São Miguel Fortress and the Museum of Anthropology on the same day.', quando_ir: 'Early in the morning, with soft light and less heat.' },
    fr: { nome: 'Cidade Alta de Luanda', descricao: 'Centre historique avec le Palais, des églises coloniales et une vue sur la baie.', historia: 'La Cidade Alta est le cœur historique et institutionnel de Luanda, sur le plateau dominant la baie. On y trouve le Palais, des bâtiments coloniaux et quelques-unes des plus anciennes églises de la ville, avec vue sur la Marginal et la Baixa.', dica: 'Combinez-la avec la forteresse de São Miguel et le musée d’anthropologie le même jour.', quando_ir: 'Tôt le matin, avec une lumière douce et moins de chaleur.' },
    es: { nome: 'Cidade Alta de Luanda', descricao: 'Centro histórico con el Palacio, iglesias coloniales y vistas a la bahía.', historia: 'La Cidade Alta es el núcleo histórico e institucional de Luanda, en la meseta sobre la bahía. Allí están el Palacio, edificios coloniales y algunas de las iglesias más antiguas de la ciudad, con vistas a la Marginal y la Baixa.', dica: 'Combínala con la Fortaleza de San Miguel y el Museo de Antropología el mismo día.', quando_ir: 'A primera hora de la mañana, con luz suave y menos calor.' },
  },
  'Trilho das Pedras Negras': {
    en: { nome: 'Pedras Negras Trail', descricao: 'Hikes and climbs among monoliths steeped in centuries of legend.', historia: 'The trail through the Pedras Negras winds between monoliths and climbs to viewpoints over the valley. It is a moderately difficult hike for anyone who loves nature and history.', dica: 'Bring water and a hat, and start early.', quando_ir: 'Dry season, from May to October.' },
    fr: { nome: 'Sentier des Pedras Negras', descricao: 'Randonnées et escalades entre des monolithes chargés de légendes séculaires.', historia: 'Le sentier des Pedras Negras serpente entre les monolithes et monte jusqu’à des belvédères dominant la vallée. C’est une randonnée de difficulté moyenne, pour les amoureux de nature et d’histoire.', dica: 'Emportez de l’eau, un chapeau et partez tôt.', quando_ir: 'Saison sèche, de mai à octobre.' },
    es: { nome: 'Sendero de las Pedras Negras', descricao: 'Caminatas y escaladas entre monolitos con siglos de leyendas.', historia: 'El sendero de las Pedras Negras atraviesa pasos entre monolitos y sube a miradores sobre el valle. Es una caminata de dificultad moderada, para quien disfruta de la naturaleza y la historia.', dica: 'Lleva agua, sombrero y empieza temprano.', quando_ir: 'Estación seca, de mayo a octubre.' },
  },
};

const INCLUI = {
  en: ['Expert local guide', 'Return transport', 'Mineral water during the tour', 'Photo stops', 'Travel insurance'],
  fr: ['Guide local spécialisé', 'Transport aller-retour', 'Eau minérale pendant la visite', 'Arrêts photo', 'Assurance voyage'],
  es: ['Guía local especializado', 'Transporte de ida y vuelta', 'Agua mineral durante el tour', 'Paradas para fotos', 'Seguro de viaje'],
};
const DISP = { 'Todos os dias': ['Every day', 'Tous les jours', 'Todos los días'], 'Qua a Dom': ['Wed to Sun', 'Du mer. au dim.', 'De miércoles a domingo'], 'Ter a Sáb': ['Tue to Sat', 'Du mar. au sam.', 'De martes a sábado'], 'Sex a Dom': ['Fri to Sun', 'Du ven. au dim.', 'De viernes a domingo'] };
const DUR = { '1 dia': ['1 day', '1 jour', '1 día'], '5 horas': ['5 hours', '5 heures', '5 horas'], '4 horas': ['4 hours', '4 heures', '4 horas'], '6 horas': ['6 hours', '6 heures', '6 horas'] };

const experiencias = {
  'Aventura nas Cataratas da Kalandula': {
    en: { titulo: 'Kalandula Falls Adventure', descricao: 'Trails, panoramic views and a swim in crystal-clear water.', descricao_longa: 'Enjoy an unforgettable experience at Angola’s greatest waterfall! Guided trails, amazing viewpoints and a swim in the crystal-clear waters of Kalandula. Nature, adventure and a connection with what matters. Departure from Luanda at 05:30, traditional lunch in Malanje and return at the end of the day.' },
    fr: { titulo: 'Aventure aux chutes de Kalandula', descricao: 'Sentiers, vue panoramique et baignade dans des eaux cristallines.', descricao_longa: 'Vivez une expérience inoubliable à la plus grande chute d’eau d’Angola ! Sentiers guidés, belvédères incroyables et baignade dans les eaux cristallines de Kalandula. Nature, aventure et retour à l’essentiel. Départ de Luanda à 05h30, déjeuner typique à Malanje et retour en fin de journée.' },
    es: { titulo: 'Aventura en las cataratas de Kalandula', descricao: 'Senderos, vistas panorámicas y baño en aguas cristalinas.', descricao_longa: '¡Vive una experiencia inolvidable en la mayor cascada de Angola! Senderos guiados, miradores increíbles y baño en las aguas cristalinas de Kalandula. Naturaleza, aventura y conexión con lo esencial. Salida de Luanda a las 05:30, almuerzo típico en Malanje y regreso al final del día.' },
  },
  'Imersão na Cultura e Tradições': {
    en: { titulo: 'Culture and Traditions Immersion', descricao: 'Music, dance, crafts and history that will charm you.', descricao_longa: 'An afternoon with traditional dance groups from Lubango, a crafts workshop and a chat with storytellers. Includes a tasting of regional dishes.' },
    fr: { titulo: 'Immersion dans la culture et les traditions', descricao: 'Musique, danse, artisanat et histoire qui enchantent.', descricao_longa: 'Un après-midi avec des groupes de danse traditionnelle de Lubango, un atelier d’artisanat et une rencontre avec des conteurs. Dégustation de plats régionaux incluse.' },
    es: { titulo: 'Inmersión en la cultura y las tradiciones', descricao: 'Música, danza, artesanía e historia que encantan.', descricao_longa: 'Una tarde con grupos de danza tradicional de Lubango, un taller de artesanía y una charla con cuentacuentos. Incluye degustación de platos regionales.' },
  },
  'Sabores de Angola — Tour Gastronómico': {
    en: { titulo: 'Flavours of Angola — Food Tour', descricao: 'Discover the traditional flavours of our land.', descricao_longa: 'A walk through Luanda’s markets and restaurants tasting muamba, calulu, mufete and traditional sweets, led by a local chef.' },
    fr: { titulo: 'Saveurs d’Angola — Circuit gastronomique', descricao: 'Découvrez les saveurs typiques de notre terre.', descricao_longa: 'Parcours dans les marchés et restaurants de Luanda avec dégustation de muamba, calulu, mufete et douceurs traditionnelles, guidé par un chef local.' },
    es: { titulo: 'Sabores de Angola — Tour gastronómico', descricao: 'Descubre los sabores típicos de nuestra tierra.', descricao_longa: 'Recorrido por mercados y restaurantes de Luanda con degustación de muamba, calulu, mufete y dulces tradicionales, guiado por un chef local.' },
  },
  'Pôr do Sol na Ilha do Mussulo': {
    en: { titulo: 'Sunset on Mussulo Island', local: 'Mussulo Island, Luanda', descricao: 'Boat trip and relaxation on idyllic beaches.', descricao_longa: 'Boat crossing from the Embarcadouro jetty, an afternoon on the beach with a welcome drink, and the return trip at sunset.' },
    fr: { titulo: 'Coucher de soleil sur l’île du Mussulo', local: 'Île du Mussulo, Luanda', descricao: 'Balade en bateau et détente sur des plages paradisiaques.', descricao_longa: 'Traversée en bateau depuis l’embarcadère, après-midi à la plage avec boisson de bienvenue et retour au coucher du soleil.' },
    es: { titulo: 'Puesta de sol en la isla de Mussulo', local: 'Isla de Mussulo, Luanda', descricao: 'Paseo en barco y relax en playas paradisíacas.', descricao_longa: 'Travesía en barco desde el embarcadero, tarde en la playa con bebida de bienvenida y regreso al atardecer.' },
  },
  'Trilha nas Pedras Negras': {
    en: { titulo: 'Pedras Negras Hike', descricao: 'Guided hike through unique, mystical rock formations.', descricao_longa: 'Guided climb up the Pungo Andongo monoliths, stopping at Queen Njinga’s footprints, with views over the Kwanza valley.' },
    fr: { titulo: 'Randonnée aux Pedras Negras', descricao: 'Randonnée guidée parmi des formations rocheuses uniques et mystiques.', descricao_longa: 'Ascension guidée des monolithes de Pungo Andongo, avec arrêt aux empreintes de la reine Njinga et vue sur la vallée du Kwanza.' },
    es: { titulo: 'Senderismo en las Pedras Negras', descricao: 'Caminata guiada por formaciones rocosas únicas y místicas.', descricao_longa: 'Subida guiada a los monolitos de Pungo Andongo, con parada en las huellas de la reina Njinga y vistas al valle del Kwanza.' },
  },
  'City Tour Histórico em Luanda': {
    en: { titulo: 'Historic Luanda City Tour', descricao: 'Visit the capital’s main historic and cultural sights.', descricao_longa: 'São Miguel Fortress, Cidade Alta, the Agostinho Neto Memorial, the Marginal and the National Museum of Anthropology, with a certified guide.' },
    fr: { titulo: 'Visite historique de Luanda', descricao: 'Découvrez les principaux sites historiques et culturels de la capitale.', descricao_longa: 'Forteresse de São Miguel, Cidade Alta, mémorial Agostinho Neto, Marginal et musée national d’anthropologie, avec un guide certifié.' },
    es: { titulo: 'City tour histórico por Luanda', descricao: 'Visita los principales lugares históricos y culturales de la capital.', descricao_longa: 'Fortaleza de San Miguel, Cidade Alta, Memorial Agostinho Neto, la Marginal y el Museo Nacional de Antropología, con guía certificado.' },
  },
};

const eventos = {
  'Show de Yola Araújo em Luanda': { en: { titulo: 'Yola Araújo live in Luanda', local: 'Luanda Bay' }, fr: { titulo: 'Concert de Yola Araújo à Luanda', local: 'Baie de Luanda' }, es: { titulo: 'Concierto de Yola Araújo en Luanda', local: 'Bahía de Luanda' } },
  'Girabola: 1.º de Agosto x Petro de Luanda': { en: { titulo: 'Girabola: 1.º de Agosto vs Petro de Luanda', local: '11 de Novembro Stadium' }, fr: { titulo: 'Girabola : 1.º de Agosto contre Petro de Luanda', local: 'Stade du 11 Novembre' }, es: { titulo: 'Girabola: 1.º de Agosto contra Petro de Luanda', local: 'Estadio 11 de Noviembre' } },
  'Festival Gastronómico de Benguela': { en: { titulo: 'Benguela Food Festival', local: 'Lobito Beach' }, fr: { titulo: 'Festival gastronomique de Benguela', local: 'Plage de Lobito' }, es: { titulo: 'Festival Gastronómico de Benguela', local: 'Playa de Lobito' } },
  'Luanda Jazz Festival': { en: { local: 'Belas Cultural Centre, Luanda', descricao: 'Great names of Angolan and international jazz on one stage.' }, fr: { local: 'Centre culturel de Belas, Luanda', descricao: 'Les grands noms du jazz angolais et international sur une même scène.' }, es: { local: 'Centro Cultural de Belas, Luanda', descricao: 'Grandes nombres del jazz nacional e internacional en un mismo escenario.' } },
  'Fórum de Investimento Angola 2027': { en: { titulo: 'Angola Investment Forum 2027', descricao: 'Connecting opportunities and driving the future of business in Angola.' }, fr: { titulo: 'Forum de l’investissement Angola 2027', descricao: 'Relier les opportunités et dynamiser l’avenir des affaires en Angola.' }, es: { titulo: 'Foro de Inversión Angola 2027', descricao: 'Conectando oportunidades e impulsando el futuro de los negocios en Angola.' } },
  'Campeonato Nacional de Kitesurf': { en: { titulo: 'National Kitesurfing Championship', local: 'Mussulo Beach, Luanda', descricao: 'Adrenaline and strong winds on the waters of Mussulo. Take part or come and watch!' }, fr: { titulo: 'Championnat national de kitesurf', local: 'Plage du Mussulo, Luanda', descricao: 'Adrénaline et vent fort sur les eaux du Mussulo. Participez ou venez regarder !' }, es: { titulo: 'Campeonato Nacional de Kitesurf', local: 'Playa de Mussulo, Luanda', descricao: 'Adrenalina y viento fuerte en las aguas de Mussulo. ¡Participa o ven a verlo!' } },
  'Carnaval de Luanda 2027': { en: { titulo: 'Luanda Carnival 2027', local: 'Luanda waterfront (Marginal)', descricao: 'Carnival groups parade along the Marginal with music, dance and colour.' }, fr: { titulo: 'Carnaval de Luanda 2027', local: 'Marginal de Luanda', descricao: 'Les groupes de carnaval défilent sur la Marginal en musique, en danse et en couleurs.' }, es: { titulo: 'Carnaval de Luanda 2027', local: 'Marginal de Luanda', descricao: 'Los grupos de carnaval desfilan por la Marginal con música, danza y color.' } },
  'Festa da Nossa Senhora do Mar': { en: { titulo: 'Our Lady of the Sea Festival', descricao: 'A traditional celebration with music, dance and a tribute to the sea.' }, fr: { titulo: 'Fête de Notre-Dame de la Mer', descricao: 'Célébration traditionnelle avec musique, danse et hommage à la mer.' }, es: { titulo: 'Fiesta de Nuestra Señora del Mar', descricao: 'Celebración tradicional con música, danza y homenaje al mar.' } },
};

const pratos = {
  'Muamba de Galinha': {
    en: { nome: 'Chicken Muamba', etiqueta: 'Signature dish', descricao: 'Angola’s most traditional dish. A unique flavour!', historia: 'Chicken muamba is the national dish: chicken cooked in palm oil with okra, pumpkin and garlic, served with funje.' },
    fr: { nome: 'Muamba de poulet', etiqueta: 'Plat typique', descricao: 'Le plat le plus traditionnel d’Angola. Une saveur unique !', historia: 'La muamba de poulet est le plat national : du poulet cuit à l’huile de palme avec gombos, courge et ail, servi avec du funje.' },
    es: { nome: 'Muamba de pollo', etiqueta: 'Plato típico', descricao: 'El plato más tradicional de Angola. ¡Un sabor único!', historia: 'La muamba de pollo es el plato nacional: pollo cocinado con aceite de palma, quimbombó, calabaza y ajo, servido con funje.' },
  },
  'Churrasco à Angolana': {
    en: { nome: 'Angolan Barbecue', etiqueta: 'Popular', descricao: 'Juicy meats with a touch of local spices.', historia: 'Meats grilled over charcoal with jindungo chilli, garlic and lemon, a must at family weekends.' },
    fr: { nome: 'Barbecue à l’angolaise', etiqueta: 'Populaire', descricao: 'Des viandes juteuses relevées d’épices locales.', historia: 'Des viandes grillées sur la braise avec du piment jindungo, de l’ail et du citron, incontournables des week-ends en famille.' },
    es: { nome: 'Barbacoa a la angoleña', etiqueta: 'Popular', descricao: 'Carnes jugosas con un toque de especias locales.', historia: 'Carnes a la brasa con guindilla jindungo, ajo y limón, imprescindibles en los fines de semana en familia.' },
  },
  'Calulu de Peixe': {
    en: { nome: 'Fish Calulu', etiqueta: 'Traditional', descricao: 'Dried fish, vegetables and lots of flavour.', historia: 'Calulu is made with dried and fresh fish, tomato, okra, aubergine and sweet potato leaves, all cooked in palm oil.' },
    fr: { nome: 'Calulu de poisson', etiqueta: 'Traditionnel', descricao: 'Poisson séché, légumes et beaucoup de saveur.', historia: 'Le calulu associe poisson séché et frais, tomate, gombo, aubergine et feuilles de patate douce, le tout à l’huile de palme.' },
    es: { nome: 'Calulu de pescado', etiqueta: 'Tradicional', descricao: 'Pescado seco, verduras y mucho sabor.', historia: 'El calulu lleva pescado seco y fresco, tomate, quimbombó, berenjena y hojas de boniato, todo con aceite de palma.' },
  },
  'Bolinho de Chuva': {
    en: { nome: 'Rain Fritters (Bolinho de Chuva)', etiqueta: 'Sweet treat', descricao: 'The afternoon treat you can’t do without!', historia: 'Fried dough balls dusted with sugar and cinnamon, a family snack favourite.' },
    fr: { nome: 'Beignets de pluie (Bolinho de Chuva)', etiqueta: 'Douceur', descricao: 'La douceur incontournable des après-midi !', historia: 'Des beignets frits à la pâte simple, saupoudrés de sucre et de cannelle, typiques des goûters en famille.' },
    es: { nome: 'Buñuelos de lluvia (Bolinho de Chuva)', etiqueta: 'Dulce', descricao: '¡El dulce que no puede faltar por la tarde!', historia: 'Buñuelos fritos de masa sencilla, espolvoreados con azúcar y canela, típicos de las meriendas en familia.' },
  },
};

// Restaurantes: a descrição é gerada a partir das especialidades
const COZINHA = {
  'Saudável': ['healthy', 'saine', 'saludable'], 'Internacional': ['international', 'internationale', 'internacional'],
  'Europeia': ['European', 'européenne', 'europea'], 'Portuguesa': ['Portuguese', 'portugaise', 'portuguesa'],
  'Marisco': ['seafood', 'fruits de mer', 'marisco'], 'Mediterrânica': ['Mediterranean', 'méditerranéenne', 'mediterránea'],
  'Grelhados': ['grilled dishes', 'grillades', 'parrilla'], 'Italiana': ['Italian', 'italienne', 'italiana'],
  'Africana': ['African', 'africaine', 'africana'], 'Churrasco': ['barbecue', 'barbecue', 'churrasco'],
};
const capt = s => s.charAt(0).toUpperCase() + s.slice(1);
function restaurante(esp, extra) {
  const p = esp.split(' · '); const L = ['en', 'fr', 'es'], out = {};
  L.forEach((l, i) => {
    const c = p.map(x => (COZINHA[x] || [x, x, x])[i]);
    const vista = extra ? [' with views over the Marginal and Luanda Bay', ' avec vue sur la Marginal et la baie de Luanda', ' con vistas a la Marginal y la bahía de Luanda'][i] : '';
    const esp2 = c.map(capt).join(' · ');
    const desc = [
      `${capt(c.join(' and '))} restaurant${vista}, one of the most popular in Luanda on Tripadvisor.`,
      `Restaurant de cuisine ${c.join(' et ')}${vista}, parmi les plus recherchés de Luanda sur Tripadvisor.`,
      `Restaurante de cocina ${c.join(' y ')}${vista}, entre los más buscados de Luanda en Tripadvisor.`,
    ][i];
    out[l] = { especialidade: esp2, descricao: desc };
  });
  return out;
}

function porExperiencia(x) { // junta as traduções fixas com duração, disponibilidade e itens incluídos
  const base = experiencias[x.titulo]; if (!base) return null;
  const out = {};
  ['en', 'fr', 'es'].forEach((l, i) => { out[l] = { ...base[l], inclui: INCLUI[l] }; if (DUR[x.dur]) out[l].duracao = DUR[x.dur][i]; if (DISP[x.disp]) out[l].disponibilidade = DISP[x.disp][i]; });
  return out;
}

module.exports = { destinos, experiencias, eventos, pratos, restaurante, porExperiencia };
