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

// Chambre de rêve : murs blancs, comme sur ta photo d'inspiration ; le plafond et la pente étoilée passent au
// blanc aussi. Le sol est un parquet de chêne, dessiné dans src/textures.js (`parquet`) : il ne passe pas par
// cette palette.
export const paletteReve = {
  mur: '#f7f6f3',
  murAlt: '#f1f0ec',
  murBord: '#c9ced8',
  plafond: '#fbfaf8',
  pente: '#f6f3f0', // fond de la pente, sous les étoiles
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

// La chambre voisine, derrière le mur nord, d'après tes photos : la même largeur que la chambre et son toit
// en miroir (plafond plat, puis une pente qui descend vers le nord jusqu'à un mur bas de la même hauteur),
// avec une lucarne au milieu de la pente. Dans la chambre de rêve, le mur nord est abattu : les deux pièces
// n'en font plus qu'une. La colonne et le renfoncement de la porte restent.
//   profondeur : du mur abattu au mur bas du fond (z), la pente occupe ses `penteProfondeur` derniers mètres
//   lucarne : x = centre (0 = mur ouest), largeur, hauteur = son plafond plat ; fenetre = la fenêtre en bois
//   à deux battants dans sa façade, `bas` = hauteur de l'allège
export const voisine = {
  profondeur: 3.4,
  lucarne: { x: 1.9, largeur: 1.0, hauteur: 2.15, fenetre: { largeur: 0.8, hauteur: 0.95, bas: 1.06 } },
};

// Disposition de la chambre de rêve, « Studio + coin nuit » (d'après ta photo d'inspiration) : la partie
// nouvelle (z < 0) devient un studio, avec le bureau sous la fenêtre de la lucarne et un coin détente au
// milieu ; ta chambre garde le lit, la commode et la TV.
//   poses : nouvelle place des meubles existants ({ pos: [x, z], rotation }) ; ce qui les accompagne suit
//           (la chaise du bureau, le contenu de la vitrine, la lumière du lampadaire) ;
//   nouveaux : les meubles neufs, modélisés en code dans src/modeles/reve.js et livrés en .glb (même format
//           que `meubles` plus bas ; `parties` ne sert plus qu'aux collisions du petit bonhomme) ;
//   provisoires : de faux meubles, de simples blocs aux bonnes dimensions avec leur nom au-dessus, en
//           attendant de vrais modèles (même format que `meubles` plus bas). Vide pour l'instant.
export const agencementReve = {
  poses: {
    bureau: {
      pos: [1.9, -3.09],
      rotation: 0,
      glb: '/models/bureau-studio.glb', // le bureau du studio : celui de Paris, garni (voir bureauStudio, reve.js)
      description: 'Bureau en bouleau clair avec un plateau de verre, sous la fenêtre de la lucarne. Dessus, sur un grand sous-main bleu en forme de plan (« Get task done more better ») : le MacBook sur son support, un cahier ouvert, et dans le coin la lampe champignon, avec trois livres devant elle. Dessous, la boîte d’archives Lyreco et le panier « Flower Shop ».',
    },
    // près du poteau de la charpente (qui finit en z = −2,48), à 11 cm de lui : ça libère le mur ouest entre elle
    // et la porte
    vitrine: {
      pos: [0.18, -2.14],
      rotation: Math.PI / 2,
      description: 'Vitrine à quatre étagères de verre, contre le mur ouest du studio, près de la charpente.',
    },
    // tourné d'un quart de tour : la liseuse éclaire vers la commode et le lit (droite, elle rentrait dans le mur)
    // et son câble arrive au pied du mur est, où est sa prise
    // (et reculé vers la commode, pour que le rideau replié puisse se coller au mur est)
    lampadaire: { pos: [3.3, 0.38], rotation: -Math.PI / 2, hauteur: 0.012 }, // (posé sur les tatamis)
    commode: { hauteur: 0.012 }, // posée sur les tatamis
    // la table de chevet est retirée : le lit glisse jusqu'au mur bas du sud (sa tête de lit, 1,76 m, touche le mur ;
    // elle fait 92 cm de haut, sous la pente qui est à 1 m au pied du mur)
    lit: { pos: [2.5, 2.82] },
    // à gauche de la TV (vu du lit), entre son coffre et la charpente, tourné vers le lit
    'ventilateur sur pied': {
      pos: [0.33, 2.08],
      rotation: -0.33,
      description: 'Grand ventilateur sur pied, entre la TV et le retour du bureau bas, tourné vers le lit, avec sa grille et ses cinq pales.',
    },
    // la TV, pile en face du lit (même z), son coffre contre le poteau de la charpente (qui sort de 12 cm du mur)
    'TV sur coffre en osier': { pos: [0.35, 2.82] },
  },
  nouveaux: [
    {
      // à la place de l'ancienne bibliothèque basse, contre le mur est du studio, sous les neuf portraits :
      // le meuble à vinyles au nord, le banc-canapé au sud (l'origine est au pied du mur, entre les deux)
      nom: 'coin salon',
      glb: '/models/coin-salon.glb', ajuster: false,
      description: 'Le coin salon, d’après ta photo d’inspiration : un seul meuble en chêne. Le meuble à vinyles (vinyles et magazines dans ses cases, le dessus libre) et le banc-canapé qui part de son flanc jusqu’à une haute joue, avec deux gros coussins blancs et deux coussins de dossier noirs capitonnés.',
      pos: [3.6, -1.75],
      rotation: -Math.PI / 2,
      parties: [
        { taille: [0.92, 0.75, 0.66], pos: [-0.46, 0, 0.33], couleur: '#e3c08f' }, // le meuble à vinyles
        { taille: [1.77, 0.49, 0.66], pos: [0.885, 0, 0.33], couleur: '#f4f2ee' }, // le banc-canapé et son assise
      ],
    },
    {
      // sur le meuble à vinyles (dessus à 75 cm), au milieu de sa largeur, l'arrière à 12 cm du mur est : le
      // couvercle a la place de s'ouvrir ; la façade regarde la pièce (ouest)
      nom: 'platine Rega Planar 1',
      hauteur: 0.75,
      glb: '/models/platine-rega.glb', ajuster: false,
      description: 'La platine vinyle Rega Planar 1, blanc mat, sur le meuble à vinyles : son plateau en résine phénolique noire, le bras RB110 et sa cellule Carbon, un vinyle de YEONJUN (« NO LABELS ») prêt à jouer. Clique pour la lancer : le couvercle s’ouvre, le plateau tourne à 33 tours et le bras se pose sur le disque. Clique encore pour l’arrêter.',
      pos: [3.3, -2.21],
      rotation: -Math.PI / 2,
      parties: [{ taille: [0.447, 0.117, 0.36], pos: [0, 0, 0], couleur: '#f1efea' }],
    },
    {
      // à la place de l'ancien tapis rond noir, au milieu du sol libre du studio, un peu de travers (décalé vers la porte
      // pour laisser la place à la table basse, à 17 cm d'elle) ; les oreilles vers le sud-est (vers le coin nuit) :
      // Miffy est à l'endroit dans la vue d'ensemble
      nom: 'tapis Miffy',
      glb: '/models/tapis-miffy.glb', ajuster: false,
      description: 'Un tapis tufté en forme de tête de Miffy (environ 60 × 80 cm) : bouclette blanche toute douce, gros contour noir, deux yeux ronds et la petite bouche en croix. Il est posé au milieu du studio.',
      pos: [1.25, -1.1],
      rotation: -2.5,
      parties: [{ taille: [0.6, 0.017, 0.8], pos: [0, 0, -0.15], couleur: '#f2efe8' }],
    },
    {
      // devant le banc-canapé du coin salon (dont le devant est en x 2,94) : centrée sur son assise (z −0,88), à 30 cm
      // de lui ; le fil du plateau parallèle au canapé
      nom: 'table basse',
      glb: '/models/table-basse.glb', ajuster: false,
      description: 'Une table basse japonaise ronde, un chabudai : un plateau de 75 cm en chêne clair, cinq lames au chant adouci, à 33 cm du sol, devant le banc-canapé. Ses quatre pieds carrés se replient sous la ceinture, sur leurs ferrures d’acier.',
      pos: [2.265, -0.88],
      rotation: Math.PI / 2,
      parties: [{ forme: 'cylindre', taille: [0.75, 0.33], pos: [0, 0, 0], couleur: '#e3c08f' }],
    },
    {
      // sur la table basse (dessus à 33 cm), presque au centre, en long comme le canapé, un peu de travers
      nom: 'plateau repas',
      hauteur: 0.33,
      glb: '/models/plateau-repas.glb', ajuster: false,
      description: 'Un petit plateau repas en inox brossé, vide, sur la table basse : 36 × 26 cm, son fond plat, sa paroi évasée et son bord roulé.',
      pos: [2.25, -0.9],
      rotation: Math.PI / 2 + 0.12,
      parties: [{ taille: [0.36, 0.022, 0.26], pos: [0, 0, 0], couleur: '#dfe2e6' }],
    },
    {
      nom: 'monstera',
      glb: '/models/plante.glb', ajuster: false,
      // dans le coin à droite du bureau de la lucarne (vu de la chaise), entre lui, le mur est et le meuble à vinyles ;
      // sans rotation : ses feuilles sont orientées pour ce coin dans le modèle (plante, src/modeles/reve.js)
      description: 'Un grand monstera de 1,30 m dans un cache-pot crème, qui grimpe le long d’un tuteur en fibre de coco, dans le coin à droite du bureau de la lucarne. Ses grandes feuilles découpées penchent vers la fenêtre et la pièce.',
      pos: [3.12, -2.9],
      rotation: 0,
      parties: [
        { forme: 'cylindre', taille: [0.34, 0.32], pos: [0, 0, 0], couleur: '#f4f2ee' },
        { forme: 'cylindre', taille: [0.06, 1.0], pos: [-0.02, 0.29, 0.01], couleur: '#b39477' }, // le tuteur
      ],
    },
    {
      // le dos contre le mur ouest (à 3 cm : la place de la pince du bras d'écran), entre le coffre de la TV et la porte
      nom: 'bureau bas',
      hauteur: 0.012, // posé sur les tatamis
      glb: '/models/bureau-bas.glb', ajuster: false,
      description: 'Le deuxième bureau, à la japonaise : un plateau en chêne clair à cinq lames, à 44 cm du sol sur quatre pieds fins, contre le mur ouest entre la TV et la porte, sous l’affiche de Ningning. Un écran 27 pouces y flotte sur un bras articulé pincé au bord arrière, avec la barque sur l’étang aux nymphéas en fond d’écran ; à sa gauche, le ThinkPad X201i ouvert sur son support incliné, branché à l’écran par un câble VGA ; devant, le clavier VIVA63 et la souris G PRO 2 sur le tapis à pivoines.',
      pos: [0.33, 0.77],
      rotation: Math.PI / 2,
      parties: [
        { taille: [1.2, 0.028, 0.6], pos: [0, 0.412, 0], couleur: '#e3c08f' }, // plateau
        { taille: [0.042, 0.412, 0.042], pos: [0.54, 0, 0.245], couleur: '#d8b483' }, // pieds
        { taille: [0.042, 0.412, 0.042], pos: [-0.54, 0, 0.245], couleur: '#d8b483' },
        { taille: [0.042, 0.412, 0.042], pos: [0.54, 0, -0.245], couleur: '#d8b483' },
        { taille: [0.042, 0.412, 0.042], pos: [-0.54, 0, -0.245], couleur: '#d8b483' },
        { taille: [0.62, 0.37, 0.06], pos: [0.12, 0.557, -0.14], couleur: '#2b2a36' }, // écran
        { taille: [0.04, 0.37, 0.04], pos: [0.5, 0.44, -0.255], couleur: '#3d3b4c' }, // mât du bras
        { taille: [0.3, 0.1, 0.24], pos: [-0.36, 0.44, 0.02], couleur: '#3a3846' }, // le ThinkPad sur son support
        { taille: [0.33, 0.035, 0.115], pos: [0.1, 0.444, 0.135], couleur: '#2a2832' }, // le clavier
      ],
    },
    {
      // à angle droit avec le bureau bas, entre son bout (z = 1,37) et le coffre de la TV (z = 1,78) ; part du mur
      // (x = 0,03) et avance jusqu'à x = 0,73, 10 cm plus loin que le bureau. Son devant regarde le siège.
      nom: 'retour du bureau',
      hauteur: 0.012, // posé sur les tatamis
      glb: '/models/bureau-retour.glb', ajuster: false,
      description: 'Le retour d’angle du bureau bas : une plaque plus basse (34 cm du sol, 70 × 39 cm), du même chêne clair, à angle droit avec le bureau, entre lui et la TV. Elle avance 10 cm plus loin que le bureau dans la pièce.',
      pos: [0.38, 1.575],
      rotation: Math.PI,
      parties: [
        { taille: [0.7, 0.026, 0.39], pos: [0, 0.314, 0], couleur: '#e3c08f' }, // plaque
        { taille: [0.042, 0.308, 0.042], pos: [0.29, 0, 0.14], couleur: '#d8b483' }, // pieds
        { taille: [0.042, 0.308, 0.042], pos: [-0.29, 0, 0.14], couleur: '#d8b483' },
        { taille: [0.042, 0.308, 0.042], pos: [0.29, 0, -0.14], couleur: '#d8b483' },
        { taille: [0.042, 0.308, 0.042], pos: [-0.29, 0, -0.14], couleur: '#d8b483' },
      ],
    },
    {
      // sur le retour, côté mur : son bras passe au-dessus du bout du bureau bas et amène la tête au-dessus du
      // ThinkPad et du clavier (la pose est dans TOLOMEO, src/modeles/reve.js)
      nom: 'lampe Tolomeo',
      hauteur: 0.012, // posée sur le retour, lui-même sur les tatamis
      glb: '/models/tolomeo.glb', ajuster: false,
      interrupteur: 'tolomeo',
      description: 'La lampe de bureau Artemide Tolomeo, en aluminium, posée sur le retour : ses deux bras équilibrés par des ressorts et des câbles d’acier amènent son diffuseur en cloche au-dessus du setup. Clique pour l’allumer ou l’éteindre.',
      pos: [0.26, 1.53],
      rotation: 2.795,
      parties: [
        { forme: 'cylindre', taille: [0.23, 0.02], pos: [0, 0.34, 0], couleur: '#d5dbe0' }, // la base
        { forme: 'cylindre', taille: [0.03, 0.48], pos: [0, 0.36, -0.05], couleur: '#d5dbe0' }, // le bras bas
      ],
    },
    {
      // sous la tasse, de biais ; son origine est son milieu
      nom: 'serviette TWICE « Spotless »',
      hauteur: 0.012, // posé sur les tatamis
      glb: '/models/serviette.glb', ajuster: false,
      description: 'La serviette (20 × 20 cm) du Season’s Greetings 2027 de TWICE « Spotless » : neuf cases vert pomme et rose avec les mascottes, son biais et sa boucle roses. La tasse de matcha est posée dessus.',
      pos: [0.55, 1.585],
      rotation: 0.45, // posée de biais
      parties: [{ taille: [0.2, 0.003, 0.2], pos: [0, 0.34, 0], couleur: '#f2c9dc' }],
    },
    {
      // contre le mur ouest du studio, entre la vitrine et la porte ; l'avant vers la pièce
      nom: 'meuble hi-fi',
      glb: '/models/meuble-hifi.glb', ajuster: false,
      description: 'Un meuble bas en chêne, dans le style du bureau bas. Sur sa tablette, cinq vinyles présentés en éventail : CORTIS « GREENGREEN », Chuu « XO, My Cyberlove », YEONJUN « NO LABELS » et deux autres pochettes ; devant eux, à plat, deux albums en jewel case : Hearts2Hearts « Lemon Tang » et LNGSHOT « Training Day ». Dessus : le lecteur CD Moondrop DiscDream 2 Ultra en aluminium brossé, entre les deux enceintes Edifier R1280DB en bois (l’active à droite, avec ses molettes).',
      pos: [0.2, -1.47],
      rotation: Math.PI / 2,
      parties: [
        { taille: [0.8, 0.5, 0.38], pos: [0, 0, 0], couleur: '#e3c08f' }, // le meuble
        { taille: [0.146, 0.234, 0.196], pos: [-0.315, 0.5, -0.03], couleur: '#93633f' }, // les enceintes
        { taille: [0.146, 0.234, 0.196], pos: [0.315, 0.5, -0.03], couleur: '#93633f' },
      ],
    },
    {
      // par terre, à gauche du bureau du studio (vu de la chaise), presque contre son flanc (qui est en x = 1,2) ;
      // un peu tourné vers la pièce
      nom: 'Macintosh Plus',
      glb: '/models/macintosh-plus.glb', ajuster: false,
      description: 'Un Macintosh Plus de 1986, en plastique beige platine, posé par terre contre le bureau. Il sert de terminal au NAS : un câble série le relie au Raspberry Pi du mini-rack, et son petit écran cathodique de 9 pouces surveille le stockage en direct, en noir et blanc (le remplissage des disques, leur température, les lectures et écritures, le journal des sauvegardes). La fente de la disquette 3,5 pouces, la pomme arc-en-ciel ; derrière, sa poignée creusée et ses ouïes (il n’a pas de ventilateur).',
      pos: [1.049, -3.0],
      rotation: 0.12,
      parties: [{ taille: [0.246, 0.345, 0.276], pos: [0, 0, 0], couleur: '#ddd6c4' }],
    },
    {
      // par terre, à gauche du Macintosh Plus, tourné un peu vers la pièce ; sa prise est au mur ouest (branchements)
      nom: 'mini-rack NAS',
      glb: '/models/rack-nas.glb', ajuster: false,
      description: 'Un mini-rack 10 pouces en plastique beige platine, assorti au Macintosh Plus : le NAS de la maison. Le panneau de brassage et ses câbles bleus, deux petits switchs, la passerelle ; un petit boîtier, un boîtier argent et le Raspberry Pi dans son boîtier ; deux mini-PC ; le panneau de ventilation et son écran de température ; l’onduleur ; la multiprise aux interrupteurs rouges allumés. Dessus, le ThinkPad qui lui sert de console ; à côté, le Macintosh Plus branché en terminal. Il est branché à la prise double du mur, avec le Mac.',
      pos: [0.743, -3.0],
      rotation: 0.2,
      parties: [{ taille: [0.27, 0.62, 0.25], pos: [0, 0, 0], couleur: '#ddd6c4' }],
    },
    {
      // sous la pente, à gauche de la TV vu du lit : entre le bout de son coffre (z = 3,24) et le mur bas du sud
      // (z = 3,7), la barre parallèle au mur ouest ; assez bas pour passer sous le toit (1,03 m au pied du mur bas),
      // et assez au sud pour ne pas cacher l'écran depuis le lit
      nom: 'rack à vêtements',
      glb: '/models/rack-vetements.glb', ajuster: false,
      description: 'Un petit portant chromé à roulettes, glissé sous la pente à côté de la TV : cinq cintres en fil vides sur la barre ; en bas, un panier en fil avec un magazine et un pull beige plié.',
      pos: [0.44, 3.475],
      rotation: 0,
      parties: [{ taille: [0.5, 1.0, 0.44], pos: [0, 0, 0], couleur: '#e4e8eb' }],
    },
    {
      // punaisé au mur ouest au-dessus des deux posters du coin hi-fi, centré sur le meuble (z = −1,47) : entre le
      // chambranle de la porte et le début de la pente ; tombe avec le mur ouest
      nom: 'drapeau « Servir le peuple »',
      glb: '/models/drapeau.glb', ajuster: false,
      mur: 'ouest',
      description: 'Un drapeau rouge de 75 × 50 cm, la calligraphie dorée « 为人民服务 » (« Servir le peuple ») dans le coin, punaisé au mur par ses quatre coins avec des punaises dorées, au-dessus du coin hi-fi.',
      pos: [0, -1.47],
      parties: [],
    },
    {
      // sur la planche du haut de l'étagère murale (au-dessus de la TV) ; tombent avec le mur ouest, comme elle
      nom: 'coffrets Season’s Greetings',
      glb: '/models/season-greetings.glb', ajuster: false,
      mur: 'ouest',
      description: 'Les deux coffrets des Season’s Greetings 2027, debout sur l’étagère : NMIXX « Mixx on the Road » (satin blanc, strass roses) et TWICE « Spotless » (bulles et lettres roses).',
      pos: [0.09, 2.06],
      parties: [],
    },
    {
      // quatre tatamis côte à côte, du mur ouest au mur est, entre le rideau et le coffre de la TV (z 0,18 → 1,76) : sous
      // le bureau bas, son retour, le siège, la commode, le lampadaire et le bord du lit. Ce qui est posé dessus est
      // relevé de leur épaisseur (`hauteur`).
      nom: 'tatamis',
      glb: '/models/tatami.glb', ajuster: false,
      description: 'Quatre tatamis en paille de jonc vert tendre, bordés d’un liseré sombre sur les grands côtés, d’un mur à l’autre : le coin bureau, la commode et le bord du lit sont posés dessus, comme dans une chambre japonaise.',
      pos: [1.8075, 0.97],
      parties: [],
    },
    {
      // le long du lit, côté tatamis : un bureau bas à la hauteur du retour (34 cm), du lit (z 1,97) jusqu'à 11 cm sur
      // les tatamis (z 1,65), d'un bout à l'autre du lit ; son devant vers les tatamis
      nom: 'console du lit',
      glb: '/models/console-lit.glb', ajuster: false,
      description: 'Un bureau bas en chêne clair, à la hauteur du retour (34 cm), tout le long du lit ; il dépasse un peu sur les tatamis. L’iPad est posé au bout, au niveau des oreillers, et ta Nintendo 3DS blanche juste à côté, ouverte sur Pokémon Lune.',
      pos: [2.5, 1.808],
      rotation: Math.PI,
      parties: [{ taille: [2.08, 0.34, 0.31], pos: [0, 0, 0], couleur: '#e3c08f' }],
    },
    {
      // au pied du lit, sur le parquet, face à la TV : le dos appuyé sur le bord du cadre du lit (x 1,45, à 34 cm), son
      // pivot 5,5 cm devant (il penche de 9°) ; tourné d'un quart de tour (sa face avant vers −x)
      nom: 'sac à dos',
      glb: '/models/sac-mantis.glb', ajuster: false,
      description: 'Le sac à dos Arc’teryx Mantis 26 noir, adossé au pied du lit.',
      pos: [1.395, 2.4],
      rotation: -Math.PI / 2,
      parties: [{ taille: [0.28, 0.46, 0.2], pos: [0, 0, 0.1], couleur: '#2c2b33' }],
    },
    {
      // les prises murales et les câbles qui y mènent (modèle en coordonnées de la pièce)
      nom: 'prises',
      glb: '/models/branchements.glb', ajuster: false,
      description: 'Les prises au ras du sol : celle du lampadaire au mur est, et au pied du mur ouest, derrière le ventilateur, une multiprise où sont branchés la Tolomeo et le ventilateur. Chaque câble finit dans sa fiche.',
      pos: [0, 0],
      parties: [],
    },
    {
      // sur le retour, devant la Tolomeo (côté pièce), l'anse tournée vers le siège
      nom: 'tasse de matcha',
      hauteur: 0.012, // posé sur les tatamis
      glb: '/models/tasse.glb', ajuster: false,
      description: 'Une grande tasse vert matcha, pleine de matcha latte, avec une paille en papier à rayure verte. Posée sur la serviette TWICE, au pied de la Tolomeo.',
      pos: [0.53, 1.6],
      rotation: 1.14,
      parties: [{ forme: 'cylindre', taille: [0.095, 0.11], pos: [0, 0.3425, 0], couleur: '#c2d9a6' }],
    },
    {
      // face au bureau bas, le devant de la coque juste sous le bord du plateau
      nom: 'siège au sol',
      hauteur: 0.012, // posé sur les tatamis
      glb: '/models/chaise-sol.glb', ajuster: false,
      description: 'Le siège de sol (zaisu) du bureau bas : coque noire posée à plat avec sa poignée percée, coussin noir, dossier inclinable en maille grise et accoudoirs en boucle.',
      pos: [0.91, 0.77],
      rotation: -Math.PI / 2,
      parties: [
        { taille: [0.52, 0.12, 0.54], pos: [0, 0, 0.0], couleur: '#363443' }, // coque et coussin
        { taille: [0.5, 0.6, 0.12], pos: [0, 0.1, -0.29], couleur: '#a6a3b4' }, // dossier
      ],
    },
  ],
  // les meubles de la chambre qui n'existent pas dans la chambre de rêve (par leur nom)
  retires: ['table de chevet verte'],
  // aucun faux meuble pour l'instant (le canapé a été retiré : plus de canapé dans la chambre de rêve)
  provisoires: [],
  // les lumières en plus de celles de la chambre (même format que `lumieres` plus bas) ; `cible` en fait un
  // projecteur qui éclaire dans une direction (angle : demi-ouverture du cône, penombre : douceur du bord)
  lumieres: [
    {
      // l'ampoule de la Tolomeo, dans son diffuseur (dont le bord est à 0.923 m) : la tête est en
      // [0.479, 1.068, 0.924] (calculée d'après TOLOMEO, reve.js) ; elle éclaire le ThinkPad et le clavier
      nom: 'lampe Tolomeo',
      pos: [0.479, 0.97, 0.924],
      ampoules: [[0.479, 0.992, 0.924]],
      tailleAmpoule: 0.4,
      halo: 0.14, // petit : il reste caché dans la cloche, on ne le voit que par en dessous
      cible: [0.42, 0.44, 0.86],
      angle: 0.8,
      penombre: 0.7,
      couleur: '#ffe2b8',
      intensite: 1.6,
      portee: 2.5,
      ombres: true,
    },
    {
      // la lampe champignon, dans le coin arrière droit du bureau du studio : son globe de verre opalin s'allume en
      // orangé (`corps` : le nom du matériau du modèle que le programme fait briller) et éclaire le bureau et le mur
      nom: 'lampe champignon',
      pos: [2.35, 0.985, -3.23],
      ampoules: [],
      corps: 'champignon-verre',
      couleur: '#ffb15e',
      intensite: 1.1,
      portee: 2.5,
    },
  ],
  // des posters en plus, scotchés (même format que `photosMur` plus bas) : au-dessus du bureau bas, à gauche de
  // l'affiche W Korea (qui commence à z = 1,09)
  photos: [
    {
      mur: 'ouest',
      nom: 'posters au-dessus du bureau bas',
      description: 'Trois posters scotchés au mur au-dessus du bureau bas : un grand en paysage en haut, deux portraits en dessous.',
      posters: [
        { fichier: '/photos/reve/b1.jpg', s: 0.55, y: 1.78, taille: [0.45, 0.36] },
        { fichier: '/photos/reve/b2.jpg', s: 0.37, y: 1.3, taille: [0.28, 0.35] },
        { fichier: '/photos/reve/b3.jpg', s: 0.73, y: 1.3, taille: [0.28, 0.35] },
      ],
    },
    {
      // une colonne de trois petits posters de TWICE pour compléter ce mur, côté porte : entre les posters du
      // dessus du bureau bas (b2 finit en s = 0,23) et le chambranle (vers s = −0,12) ; le haut aligné sur b1
      mur: 'ouest',
      nom: 'petits posters TWICE',
      description: 'Trois petits posters de TWICE en colonne, à côté de ceux du bureau bas : la photo de groupe dans l’escalier et le grand ménage dans la chambre fleurie de « Spotless », puis les neuf en maillots bleu ciel « THIS IS FOR » de leur tournée mondiale.',
      posters: [
        { fichier: '/photos/reve/twice-spotless-escalier.jpg', s: 0.08, y: 1.883, taille: [0.23, 0.184] },
        { fichier: '/photos/reve/twice-spotless-chambre.jpg', s: 0.08, y: 1.649, taille: [0.23, 0.184] },
        { fichier: '/photos/reve/twice-this-is-for.jpg', s: 0.08, y: 1.421, taille: [0.23, 0.1725] },
      ],
    },
    {
      // au-dessus du meuble hi-fi, sous le drapeau : une rangée de trois affiches centrées à 1,20 m, sur le mur libre
      // entre le chambranle de la porte (z ≈ −1,08) et la vitrine (z −1,925), 1,5 cm entre elles. Côté porte The
      // First Frost, au milieu Exclusive Fairy Tales, côté vitrine le poster au chat.
      mur: 'ouest',
      nom: 'poster « study in china »',
      description: 'Le petit poster au chat zen « 留学在中国 / study in china », au papier déchiré sur le côté, avec son autocollant Kodak Gold, scotché au-dessus des enceintes.',
      posters: [{ fichier: '/photos/reve/study-in-china.jpg', s: -1.765, y: 1.2, taille: [0.3, 0.424] }],
    },
    {
      mur: 'ouest',
      nom: 'affiche « Exclusive Fairy Tales »',
      description: 'L’affiche de la série chinoise « 独家童话 / Exclusive Fairy Tales » : deux lycéens en survêtement d’uniforme blanc et bleu marine, lui accoudé sur son épaule, elle levant les yeux vers lui, sous un arbre plein de soleil ; le titre écrit à la main en blanc. Scotchée entre l’affiche de The First Frost et le poster au chat.',
      posters: [{ fichier: '/photos/reve/exclusive-fairy-tales.jpg', s: -1.4875, y: 1.2, taille: [0.225, 0.3] }],
    },
    {
      mur: 'ouest',
      nom: 'affiche « The First Frost »',
      description: 'L’affiche de la série chinoise « 难哄 / The First Frost » (Youku) : Zhang Miaoyi dans le rôle de Zhong Siqiao, accoudée à son pupitre, avec le compte à rebours « 开播倒计时 3 天 » (plus que 3 jours avant la diffusion). Scotchée côté porte.',
      posters: [{ fichier: '/photos/reve/the-first-frost.jpg', s: -1.225, y: 1.2, taille: [0.27, 0.48] }],
    },
    {
      // au mur est, au-dessus du meuble à vinyles (son dessus est à 75 cm), entre la pente et la grille des neuf
      // portraits (qui commence en z = −1,38) : elles prennent presque toute la place. Leurs bas sont alignés à 13 cm
      // au-dessus du meuble ; le haut de l'affiche en portrait est sur celui de la 2ᵉ rangée de la grille (1,86), celle
      // en paysage, plus basse, glisse sous la pente (son coin haut reste 20 cm sous elle), derrière les feuilles du
      // monstera. 5 cm entre elles et jusqu'à la grille, comme entre les portraits.
      mur: 'est',
      nom: 'affiches du drama de JTBC',
      description: 'Deux affiches du drama de JTBC « 모두가 자신의 무가치함과 싸우고 있다 » (« Chacun se bat contre sa propre insignifiance ») au-dessus du meuble à vinyles : en grand, elle, la nuit, en manteau noir et écharpe bordeaux, devant les lumières floues de la ville ; à côté, lui, penché sur son ordinateur au milieu des livres, une caméra derrière.',
      posters: [
        { fichier: '/photos/reve/drama-jtbc-nuit.jpg', s: -1.82, y: 1.3675, taille: [0.78, 0.975] },
        { fichier: '/photos/reve/drama-jtbc-bureau.jpg', s: -2.58, y: 1.0933, taille: [0.64, 0.4267] },
      ],
    },
  ],
  // et leurs boutons (même format que `interrupteurs` plus bas) ; `rideau: true` = le bouton ouvre ou ferme le rideau
  // (allumé = fermé ; son animation est la sienne, dans src/main.js)
  interrupteurs: [
    { id: 'tolomeo', label: 'Lampe de bureau', lumieres: ['lampe Tolomeo'] },
    { id: 'champignon', label: 'Lampe champignon', lumieres: ['lampe champignon'] },
    { id: 'rideau', label: 'Rideau', rideau: true },
  ],
  // Le rideau qui sépare la pièce en deux, sur la ligne de l'ancien mur : un voilage en lin crème suspendu à un
  // rail au plafond, du mur ouest (le long du bord du bureau bas) jusqu'au mur est. Ouvert, il est ramassé en plis
  // profonds contre le mur est, comme ancré dans le mur d'origine ; fermé, il court jusqu'au mur ouest en larges
  // ondulations.
  //   z : la ligne du rail ; x0, x1 : ses bouts ; haut : sa hauteur ; ouvert : la largeur du rideau ramassé ;
  //   plis : leur nombre ; ampleur : la longueur de tissu rapportée à celle du rail (1,35 : déployé, il ondule
  //   encore en souplesse). Ramassé, il est noué à une embrasse sur le mur est.
  rideau: { z: 0.12, x0: 0.02, x1: 3.588, haut: 2.385, ouvert: 0.42, plis: 18, ampleur: 1.35, couleur: '#f3ead9' },
};

// La visite guidée de la chambre de rêve (src/visite.js) : les plans, dans l'ordre, en coordonnées de la pièce.
//   partie, titre, texte : la légende ; de, a : la caméra et ce qu'elle regarde au début et à la fin du plan (elle
//   dérive lentement de l'un à l'autre) ; fov : le champ de vision (50 par défaut) ; duree, transition : en secondes ;
//   projecteur : un petit projecteur doux sur ce qu'on regarde ; geste : une commande basculée le temps du plan.
export const visiteReve = [
  {
    partie: 'Visite', titre: 'La chambre de rêve', texte: 'Le mur abattu : ma chambre et la pièce d’à côté, réunies en une seule.',
    de: { camera: [-4.6, 6.4, 1.4], cible: [1.8, 0.4, 0.6] }, a: { camera: [-2.4, 5.2, 6.2], cible: [1.8, 0.4, 1.6] }, fov: 38, duree: 6, transition: 3,
  },
  // — le coin nuit —
  {
    partie: 'Le coin nuit', titre: 'Les tatamis', texte: 'Quatre tatamis de jonc d’un mur à l’autre, bordés de leur liseré sombre.',
    de: { camera: [3.0, 1.6, 0.45], cible: [1.6, 0.05, 1.3] }, a: { camera: [2.2, 1.35, 0.5], cible: [1.0, 0.05, 1.2] }, transition: 3.2,
  },
  {
    partie: 'Le coin nuit', titre: 'Le lit', texte: 'Glissé contre le mur, sous la pente, avec sa couette à carreaux.',
    de: { camera: [1.05, 1.45, 1.35], cible: [2.6, 0.45, 2.75] }, a: { camera: [1.15, 1.3, 1.95], cible: [2.7, 0.45, 2.9] },
  },
  {
    partie: 'Le coin nuit', titre: 'La console du lit', texte: 'Un bureau bas tout le long du lit ; l’iPad et ta 3DS, ouverte sur Pokémon Lune, au niveau des oreillers.',
    de: { camera: [2.5, 0.85, 1.25], cible: [3.15, 0.36, 1.81] }, a: { camera: [2.8, 0.75, 1.38], cible: [3.15, 0.37, 1.8] }, projecteur: true,
  },
  {
    partie: 'Le coin nuit', titre: 'La TV, le rack et le ventilateur', texte: 'La TV pile en face du lit ; le rack à vêtements glissé sous la pente, le ventilateur de l’autre côté.',
    de: { camera: [2.7, 1.0, 2.95], cible: [0.35, 0.75, 2.85] }, a: { camera: [2.35, 0.95, 2.6], cible: [0.35, 0.75, 2.6] },
  },
  {
    partie: 'Le coin nuit', titre: 'Le coffre en osier', texte: 'Tressé brin par brin autour de ses montants, et ses losanges couleur rotin.',
    de: { camera: [1.25, 0.62, 2.45], cible: [0.4, 0.33, 2.85] }, a: { camera: [1.12, 0.55, 2.75], cible: [0.4, 0.33, 2.85] }, projecteur: true,
  },
  {
    partie: 'Le coin nuit', titre: 'Les Season’s Greetings', texte: 'NMIXX « Mixx on the Road » et TWICE « Spotless », sur l’étagère.',
    de: { camera: [0.95, 1.65, 1.95], cible: [0.04, 1.75, 2.05] }, a: { camera: [0.9, 1.6, 2.2], cible: [0.04, 1.75, 2.05] }, projecteur: true,
  },
  {
    partie: 'Le coin nuit', titre: 'Le Mantis 26', texte: 'Le sac Arc’teryx, adossé au pied du lit, et son archæoptéryx brodé.',
    de: { camera: [0.7, 0.6, 2.05], cible: [1.3, 0.27, 2.4] }, a: { camera: [0.75, 0.55, 2.7], cible: [1.3, 0.27, 2.4] }, projecteur: true,
  },
  {
    partie: 'Le coin nuit', titre: 'La commode et le lampadaire', texte: 'Les magazines étalés sur la commode, le lampadaire dans le coin.',
    de: { camera: [2.3, 1.55, 1.5], cible: [3.35, 1.0, 0.85] }, a: { camera: [2.45, 1.45, 1.0], cible: [3.35, 1.0, 0.75] },
  },
  {
    partie: 'Le coin nuit', titre: 'Le rideau', texte: 'Sur la ligne de l’ancien mur : il referme le coin nuit quand il faut.',
    de: { camera: [0.75, 1.65, 1.55], cible: [2.4, 1.1, 0.12] }, a: { camera: [0.85, 1.6, 1.25], cible: [2.5, 1.1, 0.12] }, duree: 5.5, geste: 'rideau',
  },
  // — le coin bureau —
  {
    partie: 'Le coin bureau', titre: 'Le bureau bas', texte: 'À la japonaise, sur les tatamis : l’écran sur son bras, le siège au sol.',
    de: { camera: [1.55, 1.1, 0.55], cible: [0.3, 0.55, 0.8] }, a: { camera: [1.4, 0.98, 1.05], cible: [0.3, 0.55, 0.8] }, transition: 2.6,
  },
  {
    partie: 'Le coin bureau', titre: 'Le ThinkPad X201i', texte: 'Ouvert sur son support, branché à l’écran par son câble VGA.',
    de: { camera: [0.85, 0.78, 1.3], cible: [0.35, 0.52, 1.12] }, a: { camera: [0.8, 0.72, 1.05], cible: [0.35, 0.52, 1.12] }, projecteur: true,
  },
  {
    partie: 'Le coin bureau', titre: 'Clavier, souris et photocards', texte: 'Le VIVA63, la G PRO 2 et les polaroids NMIXX sur le tapis à pivoines.',
    de: { camera: [1.0, 0.9, 0.6], cible: [0.42, 0.46, 0.5] }, a: { camera: [0.95, 0.85, 0.35], cible: [0.42, 0.46, 0.45] }, projecteur: true,
  },
  {
    partie: 'Le coin bureau', titre: 'La Tolomeo et le matcha', texte: 'La lampe Artemide penchée sur le setup, la tasse posée sur la serviette TWICE.',
    de: { camera: [1.25, 0.95, 1.8], cible: [0.4, 0.55, 1.45] }, a: { camera: [1.1, 1.0, 1.5], cible: [0.4, 0.55, 1.45] },
  },
  {
    partie: 'Le coin bureau', titre: 'Les posters', texte: 'Scotchés au-dessus du bureau, des couvertures de W Korea aux petits TWICE.',
    de: { camera: [1.75, 1.6, 0.6], cible: [0.0, 1.55, 0.8] }, a: { camera: [1.65, 1.55, 1.05], cible: [0.0, 1.55, 0.8] },
  },
  // — le studio —
  {
    partie: 'Le studio', titre: 'De l’autre côté', texte: 'La pièce d’à côté, avec sa lucarne et son coin salon.',
    de: { camera: [3.0, 1.9, 0.05], cible: [1.5, 0.6, -2.0] }, a: { camera: [2.6, 1.8, -0.4], cible: [1.5, 0.6, -2.0] }, transition: 3,
  },
  {
    partie: 'Le studio', titre: 'Le coin salon', texte: 'Le banc-canapé en chêne, ses coussins blancs, ses dossiers capitonnés et la table basse ronde à la japonaise.',
    de: { camera: [1.6, 1.3, -0.55], cible: [3.2, 0.6, -1.2] }, a: { camera: [1.7, 1.25, -1.3], cible: [3.2, 0.7, -1.0] },
  },
  {
    partie: 'Le studio', titre: 'Les neuf portraits', texte: 'Scotchés en grille au-dessus du canapé.',
    de: { camera: [1.9, 1.75, -0.6], cible: [3.6, 1.65, -0.88] }, a: { camera: [1.95, 1.7, -1.1], cible: [3.6, 1.65, -0.88] },
  },
  {
    partie: 'Le studio', titre: 'Le meuble à vinyles', texte: 'Vinyles et magazines dans les cases, la platine Rega Planar 1 sur le dessus ; au-dessus, les deux affiches du drama de JTBC.',
    de: { camera: [1.75, 1.3, -1.25], cible: [3.4, 1.08, -2.25] }, a: { camera: [1.75, 1.3, -1.55], cible: [3.4, 1.15, -2.25] },
  },
  {
    partie: 'Le studio', titre: 'Le bureau sous la lucarne', texte: 'Le MacBook sur son support, un cahier ouvert, des livres ; le monstera dans le coin.',
    de: { camera: [1.9, 1.55, -1.7], cible: [1.9, 0.85, -3.1] }, a: { camera: [2.2, 1.45, -2.0], cible: [1.9, 0.85, -3.1] },
  },
  {
    partie: 'Le studio', titre: 'La lampe champignon', texte: 'Son globe de verre opalin s’allume en orangé.',
    de: { camera: [2.0, 1.2, -2.5], cible: [2.35, 0.92, -3.23] }, a: { camera: [2.08, 1.13, -2.68], cible: [2.35, 0.92, -3.23] }, duree: 4.5, geste: 'champignon',
  },
  {
    partie: 'Le studio', titre: 'Le mini-rack NAS', texte: 'Le serveur de la maison, entre la vitrine et le bureau, branché à sa prise au mur.',
    de: { camera: [1.6, 1.1, -1.9], cible: [0.6, 0.45, -2.85] }, a: { camera: [1.45, 0.98, -2.15], cible: [0.6, 0.4, -2.9] },
  },
  {
    partie: 'Le studio', titre: 'Le Macintosh Plus', texte: 'Relié au Raspberry Pi du rack, il surveille les disques en direct.',
    de: { camera: [1.14, 0.37, -2.38], cible: [1.06, 0.23, -2.89] }, a: { camera: [1.11, 0.33, -2.54], cible: [1.06, 0.23, -2.89] },
  },
  {
    partie: 'Le studio', titre: 'Le drapeau', texte: 'Punaisé au-dessus de The First Frost et du chat zen.',
    de: { camera: [1.55, 1.8, -1.15], cible: [0, 1.8, -1.47] }, a: { camera: [1.5, 1.45, -1.3], cible: [0, 1.4, -1.47] },
  },
  {
    partie: 'Le studio', titre: 'Le coin hi-fi', texte: 'Le lecteur Moondrop entre les deux Edifier.',
    de: { camera: [1.35, 1.0, -0.95], cible: [0.2, 0.62, -1.47] }, a: { camera: [1.3, 0.95, -1.25], cible: [0.2, 0.62, -1.47] },
  },
  {
    partie: 'Le studio', titre: 'Les vinyles', texte: 'Chuu, CORTIS, YEONJUN… et à plat devant, Hearts2Hearts et LNGSHOT.',
    de: { camera: [0.9, 0.38, -1.25], cible: [0.2, 0.2, -1.47] }, a: { camera: [0.88, 0.36, -1.6], cible: [0.2, 0.2, -1.47] }, projecteur: true,
  },
];

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
    // le light stick (un modèle .glb, voir baguetteKiiikiii dans src/modeles/reve.js) : couché devant les
    // objets de l'album, l'étoile à gauche, le manche vers la droite et un peu vers la porte vitrée ; `z` = la
    // profondeur de son axe, `rotation` = son orientation (π/2 : le manche vers +x)
    nom: 'light stick KiiiKiii',
    description:
      "Le light stick officiel de KiiiKiii : une étoile dodue en acrylique clair, avec dedans deux étoiles givrées en gradins, sur un col blanc et un manche carré givré (on devine l'électronique en haut, le capot des piles en bas). Clique pour l'allumer ou l'éteindre.",
    glb: '/models/baguette-kiiikiii.glb',
    pos: [VX - 0.13, 1.328],
    z: 0.262,
    rotation: Math.PI / 2 - 0.1,
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

// Magazines posés à plat sur la commode (couverture visible vers le haut, le haut de la couverture vers
// le mur), étalés côte à côte en éventail le long de la commode : ils ne se chevauchent que d'un bord, pour
// que toutes les couvertures se voient. `liste` va du dessus vers le dessous (celui du dessus recouvre le
// bord de son voisin). `dx`, `dz` = décalage par rapport au centre de la commode (m), `rotation` = léger
// travers (radians).
export const magazinesCommode = {
  y: 1.0, // dessus de la commode
  centre: [3.355, 0.955], // [x, z] du centre de la commode
  liste: [
    { nom: "Harper's Bazaar Korea (été 2026) — Sana", description: "Couverture de Harper's Bazaar Korea, édition d'été 2026, avec Sana de TWICE en tenue Alo. Posé au bout de la rangée de magazines.", fichier: '/photos/mag-bazaar.jpg', taille: [0.205, 0.256, 0.004], dx: -0.012, dz: 0.268, rotation: 0.05 },
    { nom: 'W Korea « born to be loud » — Keonho (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Keonho de CORTIS adossé à une moto rouge.', fichier: '/photos/mag-w-keonho.jpg', taille: [0.2, 0.265, 0.004], dx: 0.008, dz: 0.09, rotation: -0.03 },
    { nom: 'W Korea « born to be loud » — Martin (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Martin de CORTIS en long manteau et bottes vernies.', fichier: '/photos/mag-w-martin.jpg', taille: [0.2, 0.265, 0.004], dx: -0.006, dz: -0.088, rotation: 0.035 },
    { nom: 'W Korea « born to be loud » — Seonghyeon (CORTIS)', description: 'Couverture de W Korea, numéro « born to be loud » : Seonghyeon de CORTIS assis dans le sable avec un caméléon.', fichier: '/photos/mag-w-seonghyeon.jpg', taille: [0.2, 0.265, 0.004], dx: 0.01, dz: -0.266, rotation: -0.045 },
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
      "Ta TV Brandt, sur son pied central, posée sur le coffre en osier blanc tressé à la main (les losanges couleur rotin sur la face avant, les poignées dans les côtés, le couvercle tressé serré), pile en face du lit. Clique sur « Allumer » pour la mettre en marche.",
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
//    `tailleAmpoule` réduit (ou grossit) ces sphères (1 = 10 cm de diamètre).
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
  // l'ampoule est au fond de la vasque (de 1,74 à 1,81 m), assez petite pour ne pas dépasser du bord
  { nom: 'lampadaire', pos: [3.05, 1.772, 0.35], tailleAmpoule: 0.35, couleur: '#ffd9a0', intensite: 3.5, portee: 4 },
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

// ===========================================================================================
// Chambre de Mantes-la-Jolie (« Villa des Îles », chambre 2 du plan) : une pièce rectangulaire, plafond plat,
// la fenêtre au NORD. Construite dans src/mantes.js, ses meubles dans src/modeles/mantes.js.
// Repère identique aux autres pièces : x ouest -> est, z nord (fenêtre) -> sud (porte), y sol -> plafond.
// Dimensions estimées d'après ta photo et le plan (12,15 m²), à confirmer avec un mètre.
// ===========================================================================================
export const mantes = {
  lieu: { nom: 'Mantes-la-Jolie', lat: 48.9908, lon: 1.7172 },
  largeur: 3.05, // x : mur ouest (bureau) -> mur est (lit)
  profondeur: 4.0, // z : mur nord (fenêtre) -> mur sud (porte, penderie)
  hauteur: 2.5,
  palette: {
    mur: '#f6f5f2',
    murAlt: '#efeeea',
    murBord: '#c9ced8',
    sol: '#aaa093', // stratifié chêne gris
    solLigne: '#968c80',
    plafond: '#fbfaf8',
  },
  // fenêtre à deux vantaux gris anthracite avec son coffre de volet roulant au-dessus
  fenetre: { x: 0.13, largeur: 1.3, bas: 0.65, haut: 2.1 },
  // porte blanche vers le couloir, dans le mur sud, charnières côté ouest
  porte: { x: 0.07, largeur: 0.83, hauteur: 2.04 },
  // penderie à portes coulissantes, dans le mur sud côté est
  penderie: { x: 1.75, largeur: 1.3, hauteur: 2.4 },
};

// Les meubles : `modele` = fonction de src/modeles/mantes.js ; `contre` = le mur contre lequel il est posé (son dos
// en est tourné) ; `pos` = [x, z] du centre au sol ; `rotation` en plus de `contre`, pour un meuble libre.
export const meublesMantes = [
  {
    nom: 'lit', modele: 'lit', contre: 'est', pos: [2.6, 1.1],
    description: 'Banquette-lit blanche de 90 × 200 cm à deux tiroirs, pied et tête arrondis, drap housse gris foncé, oreiller à étoiles bleues et plaid vert d’eau plié au pied.',
  },
  {
    nom: 'Kallax', modele: 'kallax', contre: 'est', pos: [2.855, 3.44],
    description: 'Étagère à cases 3 × 4 blanche, trois casiers à trous en bas, albums, coffrets et figurines dans les cases. Dessus : le cube vitrine et sa figurine noire, la boîte Nike et la basket rouge.',
  },
  {
    nom: 'lampadaire', modele: 'lampadaire', rotation: Math.PI, pos: [2.75, 2.5], interrupteur: 'lampadaire',
    description: 'Le lampadaire argenté, entre le pied du lit et le Kallax.',
  },
  {
    nom: 'bureau', modele: 'bureau', contre: 'ouest', pos: [0.4, 1.15],
    description: 'Bureau blanc assis-debout : la tour PC vitrée aux ventilateurs bleus côté fenêtre, l’écran 27 pouces et son fond d’écran, le MacBook, les deux enceintes Logitech Z207, le tapis XXL noir à pivoines blanches et le porte-gobelet avec la bouteille d’eau.',
  },
  {
    nom: 'chaise de bureau', modele: 'chaise', rotation: 0.15, pos: [1.2, 1.55],
    description: 'Chaise de bureau noire à dossier filet et accoudoirs, avec un coussin jaune pâle dans le dos et un vert d’eau sur l’assise.',
  },
  {
    nom: 'pouf', modele: 'pouf', contre: 'ouest', pos: [0.3, 2.3],
    description: 'Pouf coffre vert d’eau à pieds en bois, contre le mur du bureau.',
  },
  {
    nom: 'étagère à enceintes', modele: 'etagere', contre: 'sud', pos: [1.32, 3.82],
    description: 'Étagère blanche à quatre plateaux : deux enceintes Edifier et le lecteur CD dessus, des figurines vertes, la boîte CORTIS, un éventail rond à photo, des albums à plat (le rose « NO LABELS »).',
  },
  {
    nom: 'chevet à roulettes', modele: 'chevet', contre: 'nord', pos: [1.08, 0.2],
    description: 'Petit chariot blanc à roulettes sous la fenêtre : mouchoirs, boîte noire et petit cadre dessus, un bac en bois clair au milieu, le casque accroché au côté.',
  },
  {
    nom: 'radiateur', modele: 'radiateur', contre: 'nord', pos: [1.7, 0.045],
    description: 'Radiateur électrique blanc, entre la fenêtre et le lit.',
  },
  {
    nom: 'ventilateur', modele: 'ventilateur', rotation: Math.PI / 2, pos: [0.5, 0.25],
    description: 'Le ventilateur sur pied, devant la fenêtre, à côté du PC.',
  },
];

// Affiches et toiles collées au mur : aucune pour l'instant (toutes retirées à ta demande).
// Format : { nom, description, mur: nord | est | ouest | sud, s: position le long du mur (x pour nord/sud, z pour
// est/ouest), y: centre, taille: [l, h], image: nom d'un fichier de public/photos/mantes/ sans « .jpg » }.
export const decorsMantes = [];

// Lumières et interrupteurs (même principe que pour la chambre de Paris)
export const lumieresMantes = [{ nom: 'lampadaire', pos: [2.75, 1.772, 2.5], tailleAmpoule: 0.35, couleur: '#ffd9a0', intensite: 3.5, portee: 4 }];
export const interrupteursMantes = [
  { id: 'lampadaire', label: 'Lampadaire', lumieres: ['lampadaire'] },
  { id: 'tv', label: 'TV', tv: true },
];

// Vues prédéfinies (repère de la pièce)
export const vuesMantes = [
  { id: 'ensemble', label: "Vue d'ensemble", cible: [1.525, 0.9, 2.0], camera: [-2.7, 7.7, -4.0] },
  { id: 'lit', label: 'Lit', cible: [2.6, 0.45, 1.1], camera: [0.95, 1.9, 3.3], fov: 58 },
  { id: 'bureau', label: 'Bureau', cible: [0.35, 1.0, 1.15], camera: [2.2, 1.7, 2.7], fov: 58 },
  { id: 'tv', label: 'TV', cible: [0.0, 1.55, 1.15], camera: [2.2, 1.4, 1.15], fov: 58 },
  { id: 'porte', label: 'Porte et penderie', cible: [1.1, 1.0, 4.0], camera: [1.9, 1.7, 1.2], fov: 58 },
  { id: 'fenetre', label: 'Fenêtre', cible: [0.8, 1.4, 0.0], camera: [1.6, 1.5, 2.7], fov: 58 },
];
