// Tout ce qu'il faut modifier pour que la scène ressemble à TA chambre.
// Unités : mètres. Repère de la pièce (vue du dessus, nord en haut) :
//   x : ouest -> est, z : nord -> sud, y : sol -> plafond.
// Murs : nord (bureau, vitrine), est (lit, commode), ouest (TV, étagère),
// sud = mur bas + pan de toit incliné avec le Velux.

// Palette de la pièce, reprise de la référence : murs lilas avec une tranche plus foncée,
// sol rose, socle violet. Les meubles ont leurs propres teintes (src/modeles/outils.js).
export const palette = {
  mur: '#ede4f5',
  murAlt: '#e7ddf1', // une lame sur deux, à peine plus sombre
  murBord: '#b7a3cc', // le dessus et les côtés des murs
  sol: '#f4c9c2',
  solLigne: '#dfb6af',
  socle: '#64546f',
  plafond: '#f7eef2',
  poutre: '#8a6450',
};

export const piece = {
  largeur: 3.6, // x, mur ouest -> mur est
  profondeur: 3.7, // z, mur nord -> mur bas sud
  hauteur: 2.4, // plafond plat
  hauteurMurBas: 1.0, // hauteur du mur bas au sud, sous la pente
  penteProfondeur: 1.4, // la pente démarre à cette distance du mur sud
};

// Renfoncement de la porte, dans l'angle nord-ouest. Il n'est pas rectangulaire :
// un petit mur en biais (le « retour ») part du mur ouest, puis la porte est
// posée sur un second pan en biais qui rejoint le mur nord. Les deux pans font
// un angle droit, tournés à 45° : ça forme un triangle.
//   retour : longueur du petit mur en biais
//   pan : longueur du pan qui porte la porte
const K45 = Math.SQRT1_2;
const retour = 0.45;
const pan = 0.95;
const z1 = (retour + pan) * K45;
const P1 = [0, z1]; // où le retour quitte le mur ouest
const P2 = [-retour * K45, z1 - retour * K45]; // pointe du triangle (vers l'ouest)
const P3 = [P2[0] + pan * K45, 0]; // où le pan rejoint le mur nord
export const renfoncement = { retour, pan, P1, P2, P3 };

// Petite colonne qui sort du mur dans l'angle nord-est, à droite du bureau,
// à côté du lampadaire. Collée au mur nord et au mur est.
export const colonne = { largeur: 0.3, profondeur: 0.2 };

// Velux dans la pente, d'après tes photos. Le cadre est posé dans le plan extérieur du toit, le haut du cadre
// touche le haut de l'ouverture (coupe perpendiculaire à la pente, invisible de dessous) et le bas est taillé
// en rebord HORIZONTAL profond : c'est le grand appui pâle sous la vitre.
//   x : centre sur la largeur (0 = mur ouest) ; bas : position du bas du cadre, mesurée le long de la
//   pente depuis le haut du mur bas (négatif = le plan extérieur passe sous ce point) ;
//   largeur, longueur : le cadre en chêne (78 × 98 cm) ; profondeur : épaisseur du toit, du plâtre au
//   cadre ; appui : de combien le bord avant du rebord est plus haut que le bas du cadre, le long de la pente
//   (0 = rebord perpendiculaire, égal à la profondeur = rebord horizontal) ; evasement : de combien l'ouverture du plâtre dépasse le cadre de chaque côté.
export const velux = {
  x: 1.85,
  bas: -0.1,
  largeur: 0.78,
  longueur: 0.98,
  profondeur: 0.4,
  appui: 0.24,
  evasement: 0,
  description:
    "La fenêtre de toit (Velux) de la chambre : cadre en chêne, battant blanc avec sa poignée en bas, et un store occultant noir sur rails gris. Elle est encastrée dans un plâtre taillé d'aplomb, avec un large rebord horizontal. Clique dessus pour fermer ou ouvrir le store : fermé, il cache la vitre et coupe la lumière du jour dans la chambre.",
};

// Où se trouve la chambre : le lever et le coucher du soleil du site sont ceux de ce lieu, pour la date
// du jour (src/soleil.js). Change ces trois valeurs si tu n'habites pas à Paris.
//   lat : latitude (nord positif), lon : longitude (est positif)
export const lieu = { nom: 'Paris', lat: 48.8566, lon: 2.3522 };

// Charpente en bois sombre contre le mur ouest (chevron, poteau, entrait).
// La charpente du mur ouest, près de la TV (d'après ta photo) : trois pièces en bois sombre.
//  - le chevron longe la pente, plaqué contre le mur ;
//  - le poteau descend jusqu'au sol, derrière la TV, et se cale sous le chevron ;
//  - l'entrait (la poutre horizontale) part du poteau vers le coin du mur bas, avec son boulon.
// `profondeur` = de combien elles sortent du mur, `epaisseur` = leur grande face sous la pente.
export const poutre = {
  couleur: palette.poutre,
  profondeur: 0.12,
  epaisseur: 0.2,
  poteau: { z: 2.85, largeur: 0.14 },
  entrait: { y: 1.04, hauteur: 0.14, zFin: 3.69 },
};

// Décors plaqués sur un mur. s = position le long du mur (z pour est/ouest,
// x pour nord/sud), y = hauteur du centre. `cadres` = rectangles ajoutés par
// dessus (décalage `pos` = [dx, dy] par rapport au centre, `z` optionnel pour
// l'épaisseur).
// Un décor sur un mur en biais utilise `libre: { pos: [x, z], rotation }` au
// lieu de mur/s : `pos` est le centre sur le mur, `rotation` l'angle autour de
// la verticale (la face visible regarde vers +z quand rotation = 0).
// `glb` = modèle 3D du décor (origine au centre, la pièce du côté +z) ; `epaisseur` = épaisseur
// d'une affiche (un châssis derrière l'image).
// `description` s'affiche quand on clique dessus ; `interrupteur` = id d'un
// interrupteur (voir plus bas) que ce décor commande.
const milieuPan = [(P2[0] + P3[0]) / 2, (P2[1] + P3[1]) / 2];

export const decors = [
  {
    nom: 'porte',
    description:
      "La porte de la chambre, en bois clair à trois panneaux moulurés, avec son chambranle, ses charnières et sa poignée à levier. Elle est dans un renfoncement en triangle, donc pas dans l'alignement du mur de la TV.",
    glb: '/models/porte.glb', // origine au centre de la porte, sur le plan du mur
    sur: 'pan', // tombe avec le pan de mur qui la porte
    libre: { pos: milieuPan, rotation: Math.PI / 4 }, // le pan regarde vers le sud-est
    y: 1.02,
    taille: [0.83, 2.04],
  },
  {
    nom: 'interrupteur du renfoncement',
    description: "L'interrupteur à côté de la porte : il commande les trois spots du mur ouest.",
    interrupteur: 'spots',
    sur: 'retour',
    glb: '/models/interrupteur.glb',
    libre: { pos: [P2[0] + 0.12 * K45, P2[1] + 0.12 * K45], rotation: (3 * Math.PI) / 4 },
    y: 1.05,
    taille: [0.08, 0.08],
    couleur: '#e9eef4',
  },
  {
    nom: 'affiche W Korea « Front Row » — Ningning (aespa)',
    description:
      "Les trois couvertures de W Korea « Front Row » (volume 11, 2026) avec Ningning d'aespa : fond vert, portrait au manteau camel et costume prune. Accrochées en pile à côté de la porte, avec les trois spots juste au-dessus. Clique dessus pour changer de couverture : celle du dessus se découpe en petits blocs qui s'affaissent en vague, comme nos murs qui s'abaissent, et laisse voir la suivante.",
    mur: 'ouest',
    s: 1.4,
    y: 1.594,
    taille: [0.62, 0.812], // la couverture entière, sans rognage (rapport 0,76)
    epaisseur: 0.012,
    sens: 'chute', // la couverture du dessus tombe en petits blocs, comme un mur qui s'abaisse
    pages: ['/textures/w-ningning-vert.jpg', '/textures/w-ningning-brun.jpg', '/textures/w-ningning-rose.jpg'],
  },
  {
    nom: 'calendrier aespa 2027',
    description:
      "Calendrier mural 2027 d'aespa (Season's Greetings « One More Page, I Swear »), accroché au mur près de la commode, ouvert sur février. Clique dessus pour tourner la page : février, mars, avril, mai.",
    mur: 'est',
    s: 0.9,
    y: 1.62,
    taille: [0.297, 0.42], // A3 réel : 297 × 420 mm
    epaisseur: 0.008,
    // un clic tourne la page (vers le haut, comme un vrai calendrier mural) ; la liste boucle
    pages: ['/textures/cal-fevrier.jpg', '/textures/cal-mars.jpg', '/textures/cal-avril.jpg', '/textures/cal-mai.jpg'],
  },
  {
    nom: 'interrupteur du lampadaire',
    description: "L'interrupteur dans l'angle, près de la colonne : il commande le lampadaire.",
    interrupteur: 'lampadaire',
    glb: '/models/interrupteur.glb',
    mur: 'nord',
    s: 2.95,
    y: 1.05,
    taille: [0.08, 0.08],
    couleur: '#e9eef4',
  },
];

// Murs de photos : des posters collés au mur, comme scotchés. Les images sont dans
// public/photos/. Un mur est soit une grille (`fichiers` rangés rangée par rangée), soit une liste
// de posters placés à la main (`posters`). Les photos sont recadrées pour remplir leur cadre.
//   mur : nord / est / ouest / sud ; s = position le long du mur (x pour nord/sud, z pour est/ouest)
export const photosMur = [
  {
    // au-dessus du bureau : les 9 portraits en grille 3 × 3, dans l'ordre de tes fichiers (1 à 9 sur le Bureau)
    mur: 'nord',
    nom: 'mur de photos : les 9 portraits',
    description: "Les neuf portraits scotchés en grille 3 × 3 au-dessus du bureau.",
    colonnes: 3,
    cadre: [0.3, 0.4], // largeur, hauteur d'une photo (tes portraits sont en 3:4)
    pas: [0.35, 0.44], // distance entre deux centres
    s0: 1.85, // centre de la première colonne (le bureau est centré sur 2,20)
    yHaut: 2.1, // hauteur du centre de la première rangée
    fichiers: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09'].map((n) => `/photos/${n}.jpg`),
  },
  {
    // au-dessus du lit : les visuels en paysage, en grand. Le toit descend côté sud (z > 2,3),
    // donc le plus grand est au nord, et la rangée du bas va jusqu'à z = 2,76.
    mur: 'est',
    nom: 'posters au-dessus du lit',
    description: 'Les trois grands visuels en paysage collés au mur est, au-dessus de la tête de lit : la photo de groupe en haut, deux autres en dessous.',
    posters: [
      { fichier: '/photos/l3.jpg', s: 1.85, y: 2.03, taille: [0.86, 0.614] }, // photo de groupe
      { fichier: '/photos/l1.jpg', s: 1.74, y: 1.43, taille: [0.64, 0.457] },
      { fichier: '/photos/l2.jpg', s: 2.44, y: 1.43, taille: [0.64, 0.457] },
    ],
  },
];

// Objets posés sur les étagères de la vitrine (coordonnées de la pièce : x = position, y = hauteur
// du dessus de l'étagère). La face avant regarde la porte vitrée (+z).
//   taille : [largeur, hauteur, épaisseur] en mètres ; texture : image de la face avant
//   inclinaison : de combien l'objet penche vers l'arrière (radians)
//   contreMur : true = l'objet s'appuie contre le fond de la vitrine (sa profondeur est calculée)
//   devant : nom d'un autre objet contre lequel celui-ci s'appuie, posé devant lui
//   cote : couleur des tranches et du dos
// Étagères de la vitrine : 0,338 / 0,668 / 0,998 / 1,328 m (dessus du verre).
const VX = 1.265; // centre de la vitrine
export const objetsVitrine = [
  {
    nom: "coffret Season's Greetings aespa",
    description:
      "Coffret crème gaufré « One More Page, I Swear » : le Season's Greetings 2027 d'aespa (calendrier de bureau, carnet, photobook, cartes…), debout contre le fond de la vitrine, sur l'étagère du bas.",
    pos: [VX, 0.338],
    taille: [0.175, 0.245, 0.07],
    texture: '/textures/coffret.jpg',
    cote: '#e9e1d0',
    inclinaison: 0.05,
    contreMur: true,
  },
  // — troisième étage : les 4 albums membres d'ILLIT « Break Even » (version GLLIT), en éventail —
  // `avance` : de combien l'album est avancé (m) pour chevaucher le précédent sans se confondre avec lui.
  ...[
    ['yunah', 'Yunah', -0.132, 0],
    ['minju', 'Minju', -0.044, 0.011],
    ['wonhee', 'Wonhee', 0.044, 0.022],
    ['iroha', 'Iroha', 0.132, 0.033],
  ].map(([id, nom, dx, avance]) => ({
    nom: `album ILLIT « Break Even » — ${nom}`,
    description: `ILLIT, 5ᵉ mini-album « Break Even », version GLLIT : le folding package de ${nom} (115 × 165 mm, 9 mm d'épaisseur), appuyé contre le fond de la vitrine avec les trois autres versions membres.`,
    pos: [VX + dx, 0.998],
    taille: [0.115, 0.165, 0.009],
    texture: `/textures/illit-${id}.jpg`,
    cote: '#e6e9ec',
    inclinaison: 0.13,
    contreMur: true,
    avance,
  })),
  {
    // quatre boîtes rondes (une par version) empilées en cylindre, comme sur la photo du produit :
    // 135 mm de diamètre, 40 mm d'épaisseur chacune, du haut vers le bas.
    nom: 'LE SSERAFIM « PUREFLOW » (les 4 versions empilées)',
    description:
      "« PUREFLOW », 2ᵉ album studio de LE SSERAFIM : un « outer box » rond (135 × 40 mm) par version, empilés en cylindre. De haut en bas : Vol.1 Birch Scar (bleu), Vol.2 Yusu Lily (bleu clair), Vol.3 Peony Room (blanc), Vol.4 Tri Accord (beige).",
    pos: [VX - 0.1225, 0.668],
    pile: {
      rayon: 0.0675,
      epaisseur: 0.04,
      couvercle: '/textures/pureflow-couvercle.jpg',
      boites: [
        { couleur: '#a7c3e6', fond: '#bdd1ea' },
        { couleur: '#cfdcec', fond: '#dbe5f1' },
        { couleur: '#eceff2', fond: '#e4e8ec' },
        { couleur: '#dccbab', fond: '#d6c3a0' },
      ],
    },
  },
  {
    nom: 'LE SSERAFIM « PUREFLOW » — Compact, Innocent Green (Yunjin)',
    description:
      "« PUREFLOW », version Compact « Innocent Green » (celle de Yunjin) : la grande couverture souple de 230 × 297 mm du 2ᵉ album studio de LE SSERAFIM, appuyée contre le fond à côté de la pile des versions boîte.",
    pos: [VX + 0.075, 0.668],
    taille: [0.23, 0.297, 0.006],
    texture: '/textures/pureflow-yunjin.jpg',
    cote: '#1f9d55',
    inclinaison: 0.12,
    rotation: 0,
    contreMur: true,
  },
  {
    // couché devant les deux albums, tête vers la droite (mesures estimées : ~26 cm, tête Ø5 cm, manche Ø3,5 cm)
    nom: 'light stick officiel LE SSERAFIM',
    description:
      "Le light stick officiel de LE SSERAFIM : un cône argenté à reflets bleutés, large en haut et plus fin vers le manche, percé du logo du groupe en zigzag (vu de face) et du logo FEARNOT (vu de côté), avec sa couture et ses joints. Allumé, il brille d'abord en « Fearless Blue ». Ici posé couché devant les albums.",
    pos: [VX - 0.01, 0.668],
    baton: { longueur: 0.26, z: 0.255, angle: -0.1 },
  },
  // — étagère du haut : l'album et son contenu, tous appuyés contre le fond —
  {
    nom: 'TourBook KiiiKiii (Guide Book Ver.)',
    description:
      "Le photobook « TourBook » de l'EP WHYKiiiKiii de KiiiKiii, version Guide Book (150 × 210 mm) : un faux guide de voyage de l'île de Whykiiikiii, avec son macaron « 2026 Edition ».",
    pos: [VX - 0.1, 1.328],
    taille: [0.15, 0.21, 0.014],
    texture: '/textures/whykiiikiii-couverture.jpg',
    cote: '#eef1f6',
    inclinaison: 0.13,
    contreMur: true,
  },
  {
    nom: 'pochette « Travel Documents » KiiiKiii',
    description:
      "La pochette « Travel Documents from KiiiKiii Travel » de l'album, avec son adresse imaginaire à Whykiiikiii (WHKK, 29930), appuyée contre le fond.",
    pos: [VX + 0.1, 1.328],
    taille: [0.18, 0.116, 0.003],
    texture: '/textures/whykiiikiii-docs.jpg',
    cote: '#f4f4f4',
    inclinaison: 0.2,
    contreMur: true,
  },
  {
    nom: "billet d'avion KiiiKiii",
    description:
      "La carte « Air Ticket » (170 × 65 mm) de l'album : un faux billet de première classe pour Whykiiikiii Isle, siège A13, posée devant le photobook.",
    pos: [VX - 0.1, 1.328],
    taille: [0.17, 0.065, 0.002],
    texture: '/textures/whykiiikiii-billet.jpg',
    cote: '#dfeaf6',
    inclinaison: 0.5,
    devant: 'TourBook KiiiKiii (Guide Book Ver.)',
  },
  {
    nom: "carte d'identité KiiiKiii",
    description:
      "Une des cinq cartes « ID Photo Card » (85 × 55 mm) : une fausse carte d'identité de l'île, ici celle de Jiyu, née le 14 mai 2006, posée devant la pochette.",
    pos: [VX + 0.1, 1.328],
    taille: [0.085, 0.055, 0.002],
    texture: '/textures/whykiiikiii-carte.jpg',
    cote: '#ecebe8',
    inclinaison: 0.5,
    devant: 'pochette « Travel Documents » KiiiKiii',
  },
];

// Magazines posés à plat sur la commode, empilés à la main (couverture visible vers le haut, le
// haut de la couverture vers le mur). `liste` va du dessus de la pile vers le dessous. `dx`, `dz` =
// décalage par rapport au centre de la pile (m), `rotation` = léger travers (radians).
export const magazinesCommode = {
  y: 1.0, // dessus de la commode
  centre: [3.355, 0.955], // [x, z] du centre de la pile
  liste: [
    { nom: "Harper's Bazaar Korea (été 2026) — Sana", description: "Couverture de Harper's Bazaar Korea, édition d'été 2026, avec Sana de TWICE en tenue Alo. Posé sur le dessus de la pile de magazines.", fichier: '/photos/mag-bazaar.jpg', taille: [0.205, 0.256, 0.004], dx: 0.0, dz: 0.0, rotation: 0.04 },
    { nom: 'W Korea « born to be loud » — Keonho (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Keonho de CORTIS adossé à une moto rouge.', fichier: '/photos/mag-w-keonho.jpg', taille: [0.2, 0.265, 0.004], dx: 0.012, dz: -0.028, rotation: -0.07 },
    { nom: 'W Korea « born to be loud » — Martin (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Martin de CORTIS en long manteau et bottes vernies.', fichier: '/photos/mag-w-martin.jpg', taille: [0.2, 0.265, 0.004], dx: -0.01, dz: 0.03, rotation: 0.09 },
    { nom: 'W Korea « born to be loud » — Seonghyeon (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Seonghyeon de CORTIS assis dans le sable avec un caméléon.', fichier: '/photos/mag-w-seonghyeon.jpg', taille: [0.2, 0.265, 0.004], dx: 0.006, dz: -0.012, rotation: -0.03 },
  ],
};

// Chaque meuble : `pos` = [x, z] du centre de sa base, `rotation` en radians
// autour de la verticale, et `parties` = formes qui le composent.
//   partie.pos = [dx, y du bas, dz] relatif au centre du meuble
//   partie.taille = [l, h, p] (boîte), [diamètre, hauteur] (cylindre),
//                   [diamètre] (sphère) ou [diamètre, épaisseur du tube] (tore)
//   forme : 'boite' (défaut) | 'cylindre' | 'sphere' | 'tore'
//   options : rot [rx,ry,rz], centre (pos y = centre), verre, metal, texture,
//             ecran (face avant = écran de la TV)
// `description` s'affiche quand on clique ; `interrupteur` = id d'un interrupteur
// que ce meuble commande ; `mur` = mur auquel il est fixé (il tombe avec lui).
// Modèles 3D : `glb` = fichier dans public/models/ (ceux fournis sont créés par
// src/modeles/meubles.js, voir la page /modeles.html). `ajuster: false` = le modèle
// est posé tel quel, au même repère que les formes ci-dessous ; sans cette option
// le modèle est mis à l'échelle et centré dans l'emprise des formes (pratique pour
// un fichier venu d'ailleurs, un scan par exemple), avec en plus `orientation`
// (rotation en radians), `echelle`, `etirer` et `decalage: [dx, dy, dz]`.
// Les formes de `parties` restent affichées tant que le modèle n'est pas chargé
// (et si le fichier est introuvable).
const BOIS = '#d9a463';
const BOIS_FONCE = '#8f5f2e';
const METAL = '#9aa0a8';

export const meubles = [
  {
    // Lit 160 × 210, tête de lit collée au mur est, collé à la table verte
    // d'un côté et à la commode de l'autre.
    nom: 'lit',
    glb: '/models/lit.glb', ajuster: false,
    description:
      'Lit de 160 × 210 cm, cadre en bois clair et tête de lit à deux lattes. Il est collé au mur, à la commode et à la table de chevet verte, avec sa couette à gros carreaux rouge et orange.',
    pos: [2.5, 2.2],
    parties: [
      // cadre : 4 pieds, plateforme et rebord plus clair tout autour
      { taille: [0.09, 0.1, 0.09], pos: [0.95, 0, 0.78], couleur: '#b98445' },
      { taille: [0.09, 0.1, 0.09], pos: [0.95, 0, -0.78], couleur: '#b98445' },
      { taille: [0.09, 0.1, 0.09], pos: [-0.95, 0, 0.78], couleur: '#b98445' },
      { taille: [0.09, 0.1, 0.09], pos: [-0.95, 0, -0.78], couleur: '#b98445' },
      { taille: [2.12, 0.2, 1.7], pos: [0.01, 0.1, 0], couleur: BOIS },
      { taille: [2.1, 0.04, 0.06], pos: [0, 0.3, 0.82], couleur: '#c98f4c' },
      { taille: [2.1, 0.04, 0.06], pos: [0, 0.3, -0.82], couleur: '#c98f4c' },
      { taille: [0.06, 0.04, 1.7], pos: [-1.02, 0.3, 0], couleur: '#c98f4c' },
      { taille: [1.98, 0.2, 1.58], pos: [-0.02, 0.3, 0], couleur: '#f1ece2' },
      // couette à carreaux, avec le rabat près des oreillers et des retombées
      { taille: [1.62, 0.06, 1.74], pos: [-0.2, 0.5, 0], texture: 'couette' },
      { taille: [0.34, 0.07, 1.74], pos: [0.58, 0.53, 0], texture: 'couette' },
      { taille: [1.62, 0.16, 0.04], pos: [-0.2, 0.36, 0.87], texture: 'couette' },
      { taille: [1.62, 0.16, 0.04], pos: [-0.2, 0.36, -0.87], texture: 'couette' },
      { taille: [0.04, 0.16, 1.74], pos: [-1.0, 0.36, 0], texture: 'couette' },
      // deux oreillers (des pavés), avec leur taie plus claire sous le rabat
      { taille: [0.45, 0.14, 0.7], pos: [0.78, 0.58, 0.45], couleur: '#f2a22a' },
      { taille: [0.45, 0.14, 0.7], pos: [0.78, 0.58, -0.45], couleur: '#d9531e' },
      // tête de lit : deux lattes entre deux montants métalliques, plaquée contre le mur est (x = 3.6)
      { taille: [0.06, 0.2, 1.7], pos: [1.077, 0.44, 0], couleur: BOIS },
      { taille: [0.06, 0.2, 1.7], pos: [1.077, 0.7, 0], couleur: BOIS },
      { taille: [0.08, 1.08, 0.07], pos: [1.065, 0, 0.76], couleur: '#7a7f88', metal: true },
      { taille: [0.08, 1.08, 0.07], pos: [1.065, 0, -0.76], couleur: '#7a7f88', metal: true },
    ],
  },
  {
    nom: 'commode',
    glb: '/models/commode.glb', ajuster: false,
    description:
      'Commode à quatre tiroirs en bois clair, contre le mur est, à côté du lit. Elle est vide : plateau nu.',
    pos: [3.355, 0.955],
    parties: [
      { taille: [0.5, 1.0, 0.8], pos: [0, 0, 0], couleur: '#d6a05f' },
      // façades des 4 tiroirs : fentes et poignées
      { taille: [0.005, 0.012, 0.76], pos: [-0.255, 0.25, 0], couleur: BOIS_FONCE },
      { taille: [0.005, 0.012, 0.76], pos: [-0.255, 0.5, 0], couleur: BOIS_FONCE },
      { taille: [0.005, 0.012, 0.76], pos: [-0.255, 0.75, 0], couleur: BOIS_FONCE },
      { taille: [0.014, 0.018, 0.14], pos: [-0.262, 0.12, 0], couleur: '#5a3a1e' },
      { taille: [0.014, 0.018, 0.14], pos: [-0.262, 0.37, 0], couleur: '#5a3a1e' },
      { taille: [0.014, 0.018, 0.14], pos: [-0.262, 0.62, 0], couleur: '#5a3a1e' },
      { taille: [0.014, 0.018, 0.14], pos: [-0.262, 0.87, 0], couleur: '#5a3a1e' },
      // diplôme encadré posé contre le mur
      { taille: [0.03, 0.26, 0.34], pos: [0.1, 1.0, 0.05], couleur: '#d9b46c' },
      { taille: [0.005, 0.2, 0.28], pos: [0.083, 1.03, 0.05], couleur: '#f3efe6' },
      // bois flotté et tranche d'agate
      { taille: [0.05, 0.04, 0.32], pos: [-0.05, 1.0, -0.22], rot: [0, 0.35, 0], couleur: '#8a6a4a' },
      { taille: [0.025, 0.11, 0.09], pos: [0.12, 1.0, 0.32], couleur: '#b98a88' },
    ],
  },
  {
    nom: 'lampadaire',
    glb: '/models/lampadaire.glb', ajuster: false,
    description:
      'Lampadaire argenté avec une grande vasque qui éclaire le plafond et une petite liseuse orientable. Il est dans le coin, à côté de la colonne.',
    interrupteur: 'lampadaire',
    pos: [3.05, 0.35],
    parties: [
      { forme: 'cylindre', taille: [0.28, 0.03], pos: [0, 0, 0], couleur: '#c4c8ce', metal: true },
      { forme: 'cylindre', taille: [0.035, 1.75], pos: [0, 0.03, 0], couleur: '#c4c8ce', metal: true },
      { forme: 'cylindre', taille: [0.36, 0.06], pos: [0, 1.76, 0], couleur: '#d6d9de', metal: true },
      // boîtier de commande sur le fût
      { taille: [0.05, 0.1, 0.04], pos: [0, 1.0, 0], couleur: '#8e949c', metal: true },
      // bras de la liseuse, incliné vers l'est, et sa petite vasque
      { forme: 'cylindre', taille: [0.015, 0.4], pos: [0.157, 1.5, 0], centre: true, rot: [0, 0, -0.9], couleur: '#c4c8ce', metal: true },
      { forme: 'cylindre', taille: [0.15, 0.03], pos: [0.33, 1.62, 0], couleur: '#d6d9de', metal: true },
    ],
  },
  {
    nom: 'bureau',
    glb: '/models/bureau.glb', ajuster: false,
    description:
      'Bureau en bouleau clair avec un plateau de verre, contre le mur nord, entre la vitrine et le lampadaire. Un petit caisson à tiroirs est glissé sous le plateau, des cartons à côté.',
    pos: [2.2, 0.3],
    parties: [
      { taille: [1.4, 0.03, 0.6], pos: [0, 0.72, 0], couleur: '#dccb8a' },
      { taille: [1.4, 0.01, 0.6], pos: [0, 0.75, 0], couleur: '#cfe0c4', verre: true },
      { taille: [0.03, 0.72, 0.6], pos: [-0.685, 0, 0], couleur: '#dccb8a' },
      { taille: [0.03, 0.72, 0.6], pos: [0.685, 0, 0], couleur: '#dccb8a' },
      { taille: [1.3, 0.4, 0.02], pos: [0, 0.3, -0.29], couleur: '#dccb8a' },
      // caisson à 3 tiroirs sous le plateau, côté ouest
      { taille: [0.38, 0.66, 0.5], pos: [-0.465, 0.05, 0.02], couleur: '#d3c07e' },
      { taille: [0.36, 0.008, 0.005], pos: [-0.465, 0.27, 0.272], couleur: BOIS_FONCE },
      { taille: [0.36, 0.008, 0.005], pos: [-0.465, 0.49, 0.272], couleur: BOIS_FONCE },
      { taille: [0.1, 0.018, 0.016], pos: [-0.465, 0.16, 0.278], couleur: '#8e949c', metal: true },
      { taille: [0.1, 0.018, 0.016], pos: [-0.465, 0.38, 0.278], couleur: '#8e949c', metal: true },
      { taille: [0.1, 0.018, 0.016], pos: [-0.465, 0.6, 0.278], couleur: '#8e949c', metal: true },
      // cartons sous le bureau
      { taille: [0.4, 0.3, 0.4], pos: [0.15, 0, -0.05], couleur: '#b79a73' },
    ],
  },
  {
    nom: 'chaise',
    glb: '/models/chaise.glb', ajuster: false,
    description: 'Chaise de bureau en métal gris, avec une veste beige jetée sur le dossier.',
    pos: [2.45, 0.85],
    parties: [
      { taille: [0.42, 0.04, 0.42], pos: [0, 0.44, 0], couleur: '#8c929c', metal: true },
      { taille: [0.42, 0.38, 0.03], pos: [0, 0.48, 0.2], couleur: '#8c929c', metal: true },
      { taille: [0.46, 0.05, 0.04], pos: [0, 0.86, 0.2], couleur: '#7a8089', metal: true },
      { taille: [0.03, 0.44, 0.03], pos: [0.18, 0, 0.18], couleur: '#8c929c', metal: true },
      { taille: [0.03, 0.44, 0.03], pos: [-0.18, 0, 0.18], couleur: '#8c929c', metal: true },
      { taille: [0.03, 0.44, 0.03], pos: [0.18, 0, -0.18], couleur: '#8c929c', metal: true },
      { taille: [0.03, 0.44, 0.03], pos: [-0.18, 0, -0.18], couleur: '#8c929c', metal: true },
      // traverses entre les pieds
      { taille: [0.36, 0.02, 0.02], pos: [0, 0.16, 0.18], couleur: '#8c929c', metal: true },
      { taille: [0.36, 0.02, 0.02], pos: [0, 0.16, -0.18], couleur: '#8c929c', metal: true },
      // veste beige sur le dossier
      { taille: [0.38, 0.5, 0.1], pos: [0, 0.4, 0.24], couleur: '#b79c87' },
    ],
  },
  {
    // Vitrine IKEA, 43 × 163 cm, à gauche du bureau
    nom: 'vitrine',
    glb: '/models/vitrine.glb', ajuster: false,
    description:
      "Vitrine à quatre étagères de verre, contre le mur nord. Elle est vide pour l'instant, c'est là que les figurines viendront.",
    pos: [1.265, 0.18],
    parties: [
      { taille: [0.43, 1.63, 0.02], pos: [0, 0, -0.165], couleur: '#e2d2a8' },
      { taille: [0.025, 1.63, 0.35], pos: [0.2025, 0, 0], couleur: '#e6d3a3' },
      { taille: [0.025, 1.63, 0.35], pos: [-0.2025, 0, 0], couleur: '#e6d3a3' },
      { taille: [0.43, 0.04, 0.35], pos: [0, 0, 0], couleur: '#e6d3a3' },
      { taille: [0.43, 0.025, 0.35], pos: [0, 1.605, 0], couleur: '#e6d3a3' },
      { taille: [0.4, 0.012, 0.33], pos: [0, 0.33, 0], couleur: '#bcd4d8', verre: true },
      { taille: [0.4, 0.012, 0.33], pos: [0, 0.66, 0], couleur: '#bcd4d8', verre: true },
      { taille: [0.4, 0.012, 0.33], pos: [0, 0.99, 0], couleur: '#bcd4d8', verre: true },
      { taille: [0.4, 0.012, 0.33], pos: [0, 1.32, 0], couleur: '#bcd4d8', verre: true },
      { taille: [0.4, 1.58, 0.01], pos: [0, 0.03, 0.17], couleur: '#bcd4d8', verre: true },
      // cadre de la porte vitrée et petite poignée
      { taille: [0.02, 1.6, 0.015], pos: [-0.2, 0.02, 0.175], couleur: '#e6d3a3' },
      { taille: [0.02, 1.6, 0.015], pos: [0.2, 0.02, 0.175], couleur: '#e6d3a3' },
      { taille: [0.02, 0.1, 0.02], pos: [0.15, 0.85, 0.19], couleur: '#8e949c', metal: true },
    ],
  },
  {
    // TV pile en face du lit : même z que le centre du lit
    nom: 'TV sur coffre en osier',
    glb: '/models/tv.glb', ajuster: false,
    description:
      "TV à écran plat posée sur un coffre en osier blanc, pile en face du lit. Clique sur « Allumer » pour la mettre en marche.",
    interrupteur: 'tv',
    pos: [0.25, 2.2],
    parties: [
      // coffre en osier : corps, couvercle et tressage
      { taille: [0.45, 0.45, 0.8], pos: [0, 0, 0], couleur: '#e6dfcf' },
      { taille: [0.47, 0.03, 0.82], pos: [0, 0.42, 0], couleur: '#d8cfba' },
      { taille: [0.004, 0.012, 0.78], pos: [0.226, 0.1, 0], couleur: '#cfc6b0' },
      { taille: [0.004, 0.012, 0.78], pos: [0.226, 0.2, 0], couleur: '#cfc6b0' },
      { taille: [0.004, 0.012, 0.78], pos: [0.226, 0.3, 0], couleur: '#cfc6b0' },
      // pied et pavé de la TV
      { taille: [0.2, 0.02, 0.4], pos: [0, 0.45, 0], couleur: '#15151a' },
      { taille: [0.04, 0.06, 0.12], pos: [0, 0.47, 0], couleur: '#15151a' },
      // écran : la face qui regarde le lit (+x) s'allume
      { taille: [0.04, 0.55, 0.95], pos: [0, 0.5, 0], couleur: '#15151a', ecran: true },
      // cadre noir autour de l'écran
      { taille: [0.006, 0.03, 0.95], pos: [0.021, 0.5, 0], couleur: '#0c0c10' },
      { taille: [0.006, 0.03, 0.95], pos: [0.021, 1.02, 0], couleur: '#0c0c10' },
      { taille: [0.006, 0.55, 0.03], pos: [0.021, 0.5, 0.46], couleur: '#0c0c10' },
      { taille: [0.006, 0.55, 0.03], pos: [0.021, 0.5, -0.46], couleur: '#0c0c10' },
    ],
  },
  {
    nom: 'ventilateur sur pied',
    glb: '/models/ventilateur.glb', ajuster: false,
    description: 'Grand ventilateur sur pied, entre la TV et la porte, avec sa grille et ses trois pales.',
    pos: [0.4, 1.5],
    parties: [
      { forme: 'cylindre', taille: [0.4, 0.03], pos: [0, 0, 0], couleur: '#3a3a3d' },
      { forme: 'cylindre', taille: [0.035, 1.0], pos: [0, 0.03, 0], couleur: '#3a3a3d' },
      // tête : moteur, moyeu, grille (deux anneaux) et trois pales
      { forme: 'cylindre', taille: [0.1, 0.12], pos: [0.0, 1.2, 0], centre: true, rot: [0, 0, Math.PI / 2], couleur: '#4a4a4f' },
      { forme: 'sphere', taille: [0.07], pos: [0.07, 1.2, 0], centre: true, couleur: '#2f2f33' },
      { forme: 'tore', taille: [0.42, 0.012], pos: [0.08, 1.2, 0], centre: true, rot: [0, Math.PI / 2, 0], couleur: '#6a6a70', metal: true },
      { forme: 'tore', taille: [0.3, 0.008], pos: [0.08, 1.2, 0], centre: true, rot: [0, Math.PI / 2, 0], couleur: '#6a6a70', metal: true },
      { taille: [0.008, 0.17, 0.05], pos: [0.07, 1.3, 0], centre: true, rot: [0, 0, 0], couleur: '#3a3a3f' },
      { taille: [0.008, 0.17, 0.05], pos: [0.07, 1.15, 0.0866], centre: true, rot: [(2 * Math.PI) / 3, 0, 0], couleur: '#3a3a3f' },
      { taille: [0.008, 0.17, 0.05], pos: [0.07, 1.15, -0.0866], centre: true, rot: [(-2 * Math.PI) / 3, 0, 0], couleur: '#3a3a3f' },
    ],
  },
  {
    // Étagère à 3 niveaux, montants courbes gris-vert, planches en bois clair
    nom: 'étagère murale',
    glb: '/models/etagere.glb', ajuster: false,
    description:
      'Étagère murale à trois niveaux, montants gris-vert et planches en bois clair, au-dessus de la TV. Elle est vide pour l\'instant.',
    mur: 'ouest', // fixée au mur : tombe avec lui
    pos: [0.09, 2.06], // décalée vers le sud pour ne plus toucher l'affiche
    parties: [
      { taille: [0.17, 0.015, 0.4], pos: [0, 1.12, 0], couleur: '#d9b27a' },
      { taille: [0.17, 0.015, 0.4], pos: [0, 1.36, 0], couleur: '#d9b27a' },
      { taille: [0.17, 0.015, 0.4], pos: [0, 1.6, 0], couleur: '#d9b27a' },
      { taille: [0.03, 0.55, 0.02], pos: [0.07, 1.08, 0.2], couleur: '#9aa89a', metal: true },
      { taille: [0.03, 0.55, 0.02], pos: [0.07, 1.08, -0.2], couleur: '#9aa89a', metal: true },
    ],
  },
  {
    // Table de chevet 55 × 55 cm, collée au mur est ET au lit
    nom: 'table de chevet verte',
    glb: '/models/table-chevet.glb', ajuster: false,
    description:
      'Petite table de chevet verte, collée au mur et au lit. Un petit ventilateur blanc est posé dessus, avec un boîtier noir.',
    pos: [3.325, 3.325],
    parties: [
      { taille: [0.4, 0.04, 0.4], pos: [0, 0.41, 0], couleur: '#4f7d4a' },
      { taille: [0.03, 0.41, 0.03], pos: [0.17, 0, 0.17], couleur: '#4f7d4a' },
      { taille: [0.03, 0.41, 0.03], pos: [-0.17, 0, 0.17], couleur: '#4f7d4a' },
      { taille: [0.03, 0.41, 0.03], pos: [0.17, 0, -0.17], couleur: '#4f7d4a' },
      { taille: [0.03, 0.41, 0.03], pos: [-0.17, 0, -0.17], couleur: '#4f7d4a' },
      // étagère basse entre les pieds
      { taille: [0.34, 0.02, 0.34], pos: [0, 0.14, 0], couleur: '#4f7d4a' },
      { taille: [0.15, 0.05, 0.1], pos: [0.05, 0.45, 0.12], couleur: '#111114' },
      // petit ventilateur blanc : pied, moyeu, anneau et pales
      { forme: 'cylindre', taille: [0.12, 0.03], pos: [-0.05, 0.45, -0.05], couleur: '#f2f2f2' },
      { forme: 'cylindre', taille: [0.025, 0.15], pos: [-0.05, 0.48, -0.05], couleur: '#f2f2f2' },
      { forme: 'sphere', taille: [0.045], pos: [-0.04, 0.72, -0.05], centre: true, couleur: '#dcdcdc' },
      { forme: 'tore', taille: [0.26, 0.008], pos: [-0.02, 0.72, -0.05], centre: true, rot: [0, Math.PI / 2, 0], couleur: '#f4f4f4' },
      { taille: [0.006, 0.1, 0.04], pos: [-0.035, 0.78, -0.05], centre: true, couleur: '#e4e4e4' },
      { taille: [0.006, 0.1, 0.04], pos: [-0.035, 0.69, 0.002], centre: true, rot: [(2 * Math.PI) / 3, 0, 0], couleur: '#e4e4e4' },
      { taille: [0.006, 0.1, 0.04], pos: [-0.035, 0.69, -0.102], centre: true, rot: [(-2 * Math.PI) / 3, 0, 0], couleur: '#e4e4e4' },
    ],
  },
];

// Lumières : s'allument quand la nuit tombe (ou à la main avec les interrupteurs).
//  - `spots: true` : chaque entrée de `ampoules` ([x, y, z], x = 0 contre le mur) devient un vrai
//    spot (platine, bras, douille, ampoule en verre) avec sa propre lumière, `intensite` par spot.
//  - sinon `ampoules` = petites sphères lumineuses ; sans elles, une ampoule posée en `pos`.
export const lumieres = [
  {
    // trois spots collés au mur ouest, au-dessus de l'affiche Harper's Bazaar (qui finit à 2,0 m)
    nom: 'spots du mur ouest',
    mur: 'ouest', // les spots s'abaissent avec le mur
    spots: true,
    couleur: '#ffe6bd',
    intensite: 0.65, // par spot
    portee: 6,
    ombres: true, // seul le spot du milieu projette des ombres
    ampoules: [
      [0, 2.2, 1.1],
      [0, 2.2, 1.4],
      [0, 2.2, 1.7],
    ],
  },
  { nom: 'lampadaire', pos: [3.05, 1.85, 0.35], couleur: '#ffd9a0', intensite: 3.5, portee: 4 },
];

// Boutons marche/arrêt en bas de l'écran. `lumieres` = noms des lumières
// ci-dessus ; `tv: true` = la TV. En « auto » les lumières suivent la nuit.
export const interrupteurs = [
  { id: 'spots', label: 'Spots', lumieres: ['spots du mur ouest'] },
  { id: 'lampadaire', label: 'Lampadaire', lumieres: ['lampadaire'] },
  { id: 'tv', label: 'TV', tv: true },
];

// Vues prédéfinies (boutons en haut). `camera` et `cible` sont en repère de
// la pièce [x, y, z]. Les vues « de l'intérieur » mettent la caméra dans la pièce
// et ouvrent le champ de vision (`fov`, 35 par défaut) pour tout voir de près.
export const vues = [
  { id: 'ensemble', label: "Vue d'ensemble", cible: [1.8, 0.9, 1.85], camera: [-2.8, 7.6, -4.35] },
  { id: 'lit', label: 'Lit', cible: [2.7, 0.4, 2.3], camera: [1.1, 2.0, 0.95], fov: 58 },
  { id: 'bureau', label: 'Bureau', cible: [2.2, 0.85, 0.35], camera: [1.0, 1.65, 1.5], fov: 58 },
  { id: 'tv', label: 'TV', cible: [0.25, 0.9, 2.2], camera: [2.4, 1.5, 2.2], fov: 58 },
  { id: 'porte', label: 'Porte', cible: [0.0, 1.0, 0.4], camera: [2.4, 1.7, 2.4], fov: 58 },
  { id: 'velux', label: 'Velux', cible: [1.85, 1.45, 3.35], camera: [1.85, 1.05, 1.5], fov: 58 },
];
