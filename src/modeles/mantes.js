import * as THREE from 'three';
import { creerMateriaux, boite, cylindre, sphere, tore, barre, tube, tourne, tissu, plan, pales, fusionner } from './outils.js';
import { creer, image } from '../textures.js';
import { modeles as meublesParis, oreiller, macbook } from './meubles.js';

// Les meubles de la chambre de Mantes-la-Jolie, modélisés en code d'après tes photos, avec les mêmes outils et
// le même niveau de détail que ceux de la chambre de Paris (src/modeles/meubles.js) : couleurs unies et mates,
// tout le détail dans la géométrie (fentes d'ombre, charnières, roulettes, touches, grilles…).
// Chaque fonction renvoie un groupe dont l'origine est le centre du meuble au sol.
// Repère de chaque meuble : le DOS est du côté +x (le meuble est « contre un mur est » quand il n'est pas
// tourné), l'avant du côté −x, et z court le long du mur. src/mantes.js le tourne contre le mur voulu.

const PI = Math.PI;
const groupe = (nom, ...enfants) => {
  const g = new THREE.Group();
  g.name = nom;
  g.add(...enfants);
  return g;
};
const axeX = [0, 0, PI / 2]; // couche un cylindre pour que son axe soit x
const axeZ = [PI / 2, 0, 0]; // … ou z
// un sous-groupe placé et tourné (pour poser un objet de travers, ou réutiliser un modèle bâti dans un autre repère)
const place = (enfants, [x, y, z], rotY = 0) => {
  const g = new THREE.Group();
  g.add(...enfants);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
};

// Extrude une forme 2D (dessinée en X, Y) sur `profondeur` et la place avec `matrice`.
function extrusion(forme, profondeur, materiau, matrice) {
  const geo = new THREE.ExtrudeGeometry(forme, { depth: profondeur, bevelEnabled: false, curveSegments: 10 });
  geo.applyMatrix4(matrice);
  const m = new THREE.Mesh(geo, materiau);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
// Taie à étoiles du lit : bleu acier, étoiles blanches à six branches.
function texEtoiles() {
  return creer(256, 256, (g, w, h) => {
    g.fillStyle = '#56798f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#eef2f4';
    const etoile = (cx, cy, r) => {
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i * PI) / 6 - PI / 2;
        const rr = i % 2 ? r * 0.32 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    };
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) etoile(20 + x * 43 + (y % 2) * 21, 20 + y * 43, 6 + ((x * 7 + y * 3) % 3) * 2);
  });
}
// Trame du filet de la chaise : fils sombres croisés.
function texFilet() {
  const t = creer(64, 64, (g, w, h) => {
    g.fillStyle = '#25262d';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3d3e47';
    g.lineWidth = 1;
    for (let k = -w; k < w * 2; k += 6) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + h, h);
      g.moveTo(k + h, 0);
      g.lineTo(k, h);
      g.stroke();
    }
  });
  t.repeat.set(4, 6);
  return t;
}
// --- Le lit : banquette-lit blanche à deux tiroirs, pied et tête de lit arrondis, drap housse gris ---
// 90 × 200 cm. La tête est au nord (−z quand le lit est contre le mur est), l'avant (les tiroirs) côté −x.
function lit() {
  const m = creerMateriaux();
  const ombre = m.uni('#c9cdd1');
  const drapGris = m.uni('#5e5d63');
  const etoiles = new THREE.MeshStandardMaterial({ map: texEtoiles(), roughness: 0.95 });
  etoiles.name = 'etoiles';
  const L = 2.0;
  const tiroirs = [-0.495, 0.495].flatMap((z) => [
    boite([0.02, 0.215, 0.965], m.blanc, [-0.46, 0.07, z], { r: 0.005 }),
    boite([0.006, 0.014, 0.42], ombre, [-0.472, 0.262, z], { r: 0.003 }), // la prise de main, creusée en haut
    ...[-0.4, 0.4].map((dz) => cylindre(0.045, 0.012, m.uni('#9a9ea4'), [-0.42, 0.006, z + dz], { rot: axeZ, centre: true, segments: 14 })), // roulettes
  ]);
  return groupe(
    'lit',
    boite([0.82, 0.05, L - 0.06], ombre, [0.03, 0.0, 0], { r: 0.004 }), // socle en retrait
    boite([0.88, 0.27, L], m.blanc, [0.01, 0.05, 0], { r: 0.008 }), // caisson
    boite([0.004, 0.205, 0.01], ombre, [-0.452, 0.075, 0], { r: 0.001 }), // fente entre les deux tiroirs
    ...tiroirs,
    // pied (sud) et tête (nord) : des panneaux épais aux coins du haut arrondis, qui encadrent le matelas
    panneauArrondiZ(0.92, 0.66, 0.036, m, L / 2 + 0.018),
    panneauArrondiZ(0.92, 0.6, 0.036, m, -L / 2 - 0.018),
    // le rebord côté mur, qui tient le matelas
    boite([0.03, 0.06, L], m.blanc, [0.43, 0.32, 0], { r: 0.008 }),
    // matelas sous son drap housse gris : les coins tirés, quelques plis
    tissu([0.86, 0.17, L - 0.02], drapGris, [-0.005, 0.32, 0], { r: 0.06, froissement: 0.006, graine: 4, divisions: [10, 3, 20] }),
    boite([0.87, 0.02, L - 0.03], drapGris, [-0.005, 0.315, 0], { r: 0.006 }), // l'élastique du drap, sous le matelas
    // oreiller gris clair contre la tête, l'oreiller à étoiles posé de travers dessus
    oreiller(0.6, 0.14, 0.42, m.uni('#c4bfbb'), [0.0, 0.48, -0.74], 2),
    place([oreiller(0.62, 0.17, 0.46, etoiles, [0, 0, 0], 6)], [-0.08, 0.56, -0.6], 0.28),
    // le plaid vert d'eau tricoté, plié en quatre au pied du lit
    tissu([0.4, 0.07, 0.34], m.uni('#a8d7c7'), [-0.1, 0.48, 0.8], { r: 0.025, froissement: 0.006, graine: 9 }),
    ...[0.83, 0.88, 0.93].map((z) => boite([0.38, 0.004, 0.006], m.uni('#94c7b6'), [-0.1, 0.552, z - 0.1], { r: 0.002 })), // les mailles
  );
}
// Panneau de bout de lit dans le plan (x, y), d'épaisseur z : coins du haut arrondis.
function panneauArrondiZ(l, h, e, m, z) {
  const f = new THREE.Shape();
  const r = 0.07;
  f.moveTo(-l / 2, 0);
  f.lineTo(l / 2, 0);
  f.lineTo(l / 2, h - r);
  f.quadraticCurveTo(l / 2, h, l / 2 - r, h);
  f.lineTo(-l / 2 + r, h);
  f.quadraticCurveTo(-l / 2, h, -l / 2, h - r);
  f.closePath();
  const geo = new THREE.ExtrudeGeometry(f, { depth: e, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, z - e / 2);
  const mesh = new THREE.Mesh(geo, m.blanc);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Figurine stylisée : socle rond, corps, tête, bras ; `ailes` pour le personnage aux ailes sombres.
function figurine(m, [x, y, z], couleur, { taille = 1, ailes = false, socle = '#2a2a30' } = {}) {
  const c = m.uni(couleur);
  const s = taille;
  const el = [
    cylindre(0.07 * s, 0.012 * s, m.uni(socle), [x, y, z], { segments: 18 }),
    cylindre(0.03 * s, 0.07 * s, c, [x, y + 0.012 * s, z], { dBas: 0.045 * s }), // jambes
    cylindre(0.045 * s, 0.07 * s, c, [x, y + 0.08 * s, z], { dBas: 0.035 * s }), // torse
    sphere(0.04 * s, c, [x, y + 0.175 * s, z]),
    barre([x, y + 0.14 * s, z - 0.025 * s], [x - 0.02 * s, y + 0.09 * s, z - 0.05 * s], 0.008 * s, c, 6),
    barre([x, y + 0.14 * s, z + 0.025 * s], [x - 0.03 * s, y + 0.18 * s, z + 0.05 * s], 0.008 * s, c, 6), // un bras levé
  ];
  if (ailes) for (const sz of [-1, 1]) el.push(boite([0.006, 0.12 * s, 0.08 * s], m.uni('#1d1d24'), [x + 0.02 * s, y + 0.1 * s, z + sz * 0.05 * s], { r: 0.002, rot: [sz * 0.5, 0, 0] }));
  return el;
}
// Album posé debout (boîtier ou livre photo) : épaisseur x, largeur z, hauteur y.
const album = (m, [x, y, z], [ep, l, h], couleur, rotX = 0) => boite([ep, h, l], m.uni(couleur), [x, y, z], { r: 0.003, rot: [rotX, 0, 0] });

// --- Le Kallax 3 × 4 blanc : cadre épais, cloisons fines, casiers à trous en bas, et tout ce qu'il y a dedans ---
// 112 × 147 × 39 cm. Dessus : le cube vitrine et sa figurine noire, la boîte Nike et la basket rouge.
function kallax() {
  const m = creerMateriaux();
  const [L, Hh, P] = [1.12, 1.47, 0.39];
  const E = 0.038; // cadre extérieur
  const e = 0.016; // cloisons et tablettes
  const lc = (L - 2 * E - 2 * e) / 3; // largeur d'une case
  const hc = (Hh - 2 * E - 3 * e) / 4; // hauteur d'une case
  const zc = (j) => -L / 2 + E + lc / 2 + j * (lc + e);
  const yb = (i) => E + i * (hc + e);
  const parts = [];
  // cadre : flancs, dessus, dessous (chants plus épais), puis cloisons et tablettes fines, et le fond
  parts.push(boite([P, Hh, E], m.blanc, [0, 0, -L / 2 + E / 2], { r: 0.004 }), boite([P, Hh, E], m.blanc, [0, 0, L / 2 - E / 2], { r: 0.004 }));
  parts.push(boite([P, E, L], m.blanc, [0, 0, 0], { r: 0.004 }), boite([P, E, L], m.blanc, [0, Hh - E, 0], { r: 0.004 }));
  for (const j of [0, 1]) parts.push(boite([P - 0.004, Hh - 2 * E, e], m.blanc, [-0.002, E, zc(j) + lc / 2 + e / 2], { r: 0.002 }));
  for (const i of [1, 2, 3]) parts.push(boite([P - 0.004, e, L - 2 * E], m.blanc, [-0.002, yb(i) - e, 0], { r: 0.002 }));
  parts.push(boite([0.006, Hh - 0.01, L - 0.01], m.uni('#eceeef'), [P / 2 - 0.003, 0.005, 0], { r: 0.001 }));
  // rangée du bas : trois casiers à porte, la façade percée d'une grille de 3 × 3 trous carrés
  const trou = m.uni('#5a5d66');
  for (const j of [0, 1, 2]) {
    parts.push(boite([0.018, hc - 0.008, lc - 0.008], m.blanc, [-P / 2 + 0.012, yb(0) + 0.004, zc(j)], { r: 0.004 }));
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) parts.push(boite([0.004, 0.03, 0.03], trou, [-P / 2 + 0.002, yb(0) + hc * 0.32 + a * 0.05, zc(j) - 0.05 + b * 0.05], { r: 0.003 }));
  }
  const contenu = []; // ce qu'il y a dans les cases, avancé vers l'avant
  // rangée 2 (au-dessus des casiers) : cadres photo, coffrets sombres, magazines empilés
  contenu.push(
    album(m, [-0.02, yb(1), zc(0) - 0.08], [0.02, 0.15, 0.2], '#2c2a33', -0.08),
    album(m, [-0.04, yb(1), zc(0) + 0.06], [0.02, 0.13, 0.17], '#d6c3b5', -0.05),
    boite([0.2, 0.05, 0.14], m.uni('#e7e1da'), [-0.02, yb(1), zc(0) + 0.05], { r: 0.003 }),
    boite([0.16, 0.12, 0.2], m.uni('#33313b'), [0.03, yb(1), zc(1) - 0.05], { r: 0.004 }),
    boite([0.12, 0.08, 0.1], m.uni('#9b2c33'), [-0.05, yb(1), zc(1) + 0.1], { r: 0.004 }),
    ...[0, 1, 2, 3, 4].map((k) => boite([0.24, 0.012, 0.3], m.uni(['#d9cfc5', '#7f97b8', '#e8e4dd', '#c08a8a', '#efe9e0'][k]), [0.0, yb(1) + k * 0.013, zc(2) + (k % 2) * 0.01], { r: 0.002, rot: [0, k * 0.04, 0] })),
  );
  // rangée 3 : album vert debout et boîtes bleu clair, grande pochette verte au milieu, albums sombres à droite
  contenu.push(
    album(m, [-0.01, yb(2), zc(0) - 0.07], [0.03, 0.24, 0.28], '#3f8a4d', -0.04),
    boite([0.22, 0.05, 0.2], m.uni('#cfe2ee'), [-0.02, yb(2), zc(0) + 0.04], { r: 0.004 }),
    boite([0.2, 0.04, 0.18], m.uni('#8db3cf'), [-0.02, yb(2) + 0.05, zc(0) + 0.04], { r: 0.004 }),
    album(m, [0.0, yb(2), zc(1)], [0.02, 0.3, 0.3], '#b8c75a'),
    boite([0.003, 0.18, 0.12], m.uni('#5d6c2d'), [-0.012, yb(2) + 0.06, zc(1) - 0.02], { r: 0.001 }), // le visage de la pochette
    ...[0, 1, 2].map((k) => album(m, [-0.02 - k * 0.025, yb(2), zc(2) + 0.06 - k * 0.04], [0.02, 0.2, 0.28 - k * 0.02], ['#202027', '#3d3c46', '#e8e3dc'][k], -0.04 * k)),
    boite([0.16, 0.06, 0.12], m.uni('#d6b25c'), [-0.04, yb(2), zc(2) - 0.1], { r: 0.004 }),
  );
  // rangée du haut : photo debout et coffret rose, deux figurines (une sombre ailée, une dorée), boîte verte
  contenu.push(
    album(m, [0.0, yb(3), zc(0) - 0.06], [0.015, 0.2, 0.28], '#e9e4e6'),
    boite([0.003, 0.24, 0.16], m.uni('#3c3743'), [-0.01, yb(3) + 0.02, zc(0) - 0.06], { r: 0.001 }),
    boite([0.17, 0.07, 0.2], m.uni('#f2b6c6'), [-0.04, yb(3), zc(0) + 0.06], { r: 0.004 }),
    cylindre(0.03, 0.2, m.blanc, [-0.1, yb(3), zc(0) + 0.13]), // le lightstick blanc
    sphere(0.07, m.uni('#f6f6f8'), [-0.1, yb(3) + 0.23, zc(0) + 0.13]),
    ...figurine(m, [0.0, yb(3), zc(1) - 0.07], '#2d2f3a', { taille: 1.1, ailes: true }),
    ...figurine(m, [-0.03, yb(3), zc(1) + 0.08], '#d9b44a', { taille: 1.25, socle: '#b8952f' }),
    boite([0.24, 0.07, 0.3], m.uni('#3f9a59'), [0.0, yb(3), zc(2)], { r: 0.004 }),
    boite([0.24, 0.06, 0.28], m.uni('#2f7c45'), [0.0, yb(3) + 0.07, zc(2)], { r: 0.004 }),
    boite([0.003, 0.03, 0.2], m.uni('#e9f2ea'), [-0.121, yb(3) + 0.09, zc(2)], { r: 0.001 }), // l'étiquette
  );

  parts.push(place(contenu, [-0.07, 0, 0]));

  // dessus : le cube vitrine blanc à façade vitrée, la figurine noire dedans, la boîte Nike et la basket
  const H = Hh;
  const cube = 0.34;
  const zCube = 0.33;
  parts.push(
    boite([cube, 0.012, cube], m.blanc, [0.02, H, zCube], { r: 0.003 }),
    boite([cube, 0.012, cube], m.blanc, [0.02, H + cube - 0.012, zCube], { r: 0.003 }),
    boite([cube, cube, 0.012], m.blanc, [0.02, H, zCube - cube / 2 + 0.006], { r: 0.003 }),
    boite([cube, cube, 0.012], m.blanc, [0.02, H, zCube + cube / 2 - 0.006], { r: 0.003 }),
    boite([0.012, cube, cube], m.blanc, [0.02 + cube / 2 - 0.006, H, zCube], { r: 0.003 }),
    boite([0.006, cube - 0.03, cube - 0.03], m.verre, [0.02 - cube / 2 + 0.004, H + 0.015, zCube], { r: 0.002 }),
    boite([0.012, 0.03, 0.03], m.metalClair, [0.02 - cube / 2, H + cube / 2, zCube + cube / 2 - 0.03], { r: 0.004 }), // le bouton
    // la figurine : casque évasé, cape, buste
    cylindre(0.1, 0.012, m.uni('#26262c'), [0.02, H + 0.012, zCube]),
    cylindre(0.08, 0.16, m.uni('#17171c'), [0.02, H + 0.024, zCube], { dBas: 0.12 }), // cape
    cylindre(0.06, 0.05, m.uni('#26262c'), [0.02, H + 0.18, zCube]),
    sphere(0.06, m.uni('#101015'), [0.02, H + 0.25, zCube], { echelle: [1, 0.9, 1] }), // casque
    cylindre(0.08, 0.025, m.uni('#101015'), [0.02, H + 0.215, zCube], { dBas: 0.095 }),
    boite([0.004, 0.02, 0.03], m.metalFonce, [-0.012, H + 0.235, zCube], { r: 0.002 }), // le masque
    // la boîte Nike noire au logo orange, et la basket rouge et blanche posée dessus
    boite([0.34, 0.12, 0.2], m.uni('#1d1c22'), [0.02, H + cube, zCube], { r: 0.005 }),
    boite([0.35, 0.025, 0.21], m.uni('#26252c'), [0.02, H + cube + 0.105, zCube], { r: 0.004 }), // couvercle
    boite([0.003, 0.03, 0.08], m.uni('#e8582b'), [0.02 - 0.172, H + cube + 0.05, zCube], { r: 0.001, rot: [0.25, 0, 0] }),
    ...basket(m, [0.02, H + cube + 0.13, zCube]),
  );
  return groupe('kallax', ...parts);
}
// Basket montante rouge et blanche (type Jordan 1), posée sur le côté, la pointe vers −x.
function basket(m, [x, y, z]) {
  const rouge = m.uni('#c3262f');
  const blanc = m.uni('#f2eee9');
  return [
    boite([0.3, 0.03, 0.11], blanc, [x, y, z], { r: 0.012 }), // semelle
    boite([0.28, 0.006, 0.112], m.uni('#d8c9b5'), [x, y + 0.004, z], { r: 0.003 }),
    boite([0.26, 0.07, 0.1], blanc, [x + 0.01, y + 0.03, z], { r: 0.03 }), // tige
    sphere(0.1, rouge, [x - 0.1, y + 0.05, z], { echelle: [1.1, 0.55, 0.95] }), // pointe rouge
    boite([0.1, 0.13, 0.1], rouge, [x + 0.08, y + 0.03, z], { r: 0.03 }), // col montant
    boite([0.03, 0.13, 0.102], m.uni('#1d1c22'), [x + 0.12, y + 0.04, z], { r: 0.01 }), // talon noir
    boite([0.16, 0.012, 0.103], m.uni('#1d1c22'), [x, y + 0.06, z], { r: 0.004, rot: [0, 0, -0.25] }), // la virgule
    ...[0, 1, 2, 3].map((k) => boite([0.01, 0.004, 0.06], blanc, [x - 0.05 + k * 0.03, y + 0.1 - k * 0.004, z], { r: 0.002 })), // lacets
  ];
}

// Un ventilateur de boîtier de 12 cm : cadre noir aux coins carrés, anneau lumineux, sept pales, moyeu.
// Bâti avec son axe selon x ; `axe` = 'x', 'y' ou 'z' le tourne.
function ventiloPC(m, led, [x, y, z], axe = 'x') {
  const noir = m.uni('#141419');
  const g = new THREE.Group();
  g.add(tore(0.108, 0.006, led, [0, 0, 0], [0, PI / 2, 0]));
  g.add(tore(0.118, 0.004, noir, [0.004, 0, 0], [0, PI / 2, 0]));
  for (const [sy, sz2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) g.add(boite([0.025, 0.022, 0.022], noir, [0, sy * 0.049 - 0.011, sz2 * 0.049], { r: 0.003 }));
  g.add(pales(7, 0.048, m.uni('#2b2c35'), [0, 0, 0], { pas: 0.5 }));
  g.add(cylindre(0.036, 0.022, noir, [0, 0, 0], { rot: axeX, centre: true, segments: 18 }));
  g.add(cylindre(0.016, 0.023, m.uni('#3a3b45'), [0, 0, 0], { rot: axeX, centre: true, segments: 12 }));
  g.position.set(x, y, z);
  if (axe === 'y') g.rotation.z = PI / 2;
  if (axe === 'z') g.rotation.y = PI / 2;
  return g;
}

// --- La tour PC, d'après tes photos : boîtier noir à double vitre (face avant tournée vers la pièce et flanc côté
// fenêtre), bandeau en alu brossé avec les prises et le dongle, dessus percé de deux zones de fentes en quinconce,
// watercooling à trois ventilateurs sous le dessus, trois ventilateurs debout côté fenêtre, pompe à anneau lumineux,
// barrettes de mémoire, carte graphique, cache-alimentation à fentes. 46 × 46 × 29 cm.
// Repère : vitre principale vers −x, vitre du flanc vers +z. [x, y, z] = centre du dessous. Un objet à part
// (« objet_pc ») : le programme y allume une lueur bleue et le rend cliquable.
function tourPC(m, [x, y, z]) {
  const [P, H, L] = [0.29, 0.46, 0.46];
  const noir = m.uni('#121217');
  const fonce = m.uni('#1a1b22');
  const alu = m.uni('#25262d');
  const fente = m.uni('#050508');
  const vitre = new THREE.MeshStandardMaterial({ color: '#0b0d18', transparent: true, opacity: 0.38, roughness: 0.05, depthWrite: false });
  vitre.name = 'vitrePC';
  const led = new THREE.MeshStandardMaterial({ color: '#3fb4ff', emissive: '#1e8fff', emissiveIntensity: 2.4, roughness: 0.4 });
  led.name = 'led';
  const cyan = new THREE.MeshStandardMaterial({ color: '#7fe6ff', emissive: '#3fd2ff', emissiveIntensity: 2, roughness: 0.4 });
  cyan.name = 'ledCyan';
  const el = [];
  // caisson : socle à patins, dessus, dos, flanc plein côté porte, montant d'angle entre les deux vitres
  el.push(boite([P, 0.022, L], noir, [0, 0.012, 0], { r: 0.004 }));
  for (const [sx2, sz2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) el.push(cylindre(0.04, 0.012, m.uni('#1d1d22'), [sx2 * (P / 2 - 0.035), 0, sz2 * (L / 2 - 0.05)], { segments: 14 }));
  el.push(boite([P, 0.016, L], noir, [0, H - 0.016, 0], { r: 0.004 }));
  el.push(boite([0.01, H - 0.03, L], noir, [P / 2 - 0.005, 0.02, 0], { r: 0.002 }));
  el.push(boite([P, H - 0.03, 0.01], noir, [0, 0.02, -L / 2 + 0.005], { r: 0.002 }));
  el.push(boite([0.012, H - 0.03, 0.012], noir, [-P / 2 + 0.006, 0.02, L / 2 - 0.006], { r: 0.002 }));
  // dessus : deux zones de fentes en quinconce (une grande devant, une plus petite au fond)
  const zone = (x0, x1, demi) => {
    let rang = 0;
    for (let fx = x0; fx <= x1; fx += 0.011, rang++) {
      for (let fz = -demi + (rang % 2) * 0.022; fz <= demi; fz += 0.045) el.push(boite([0.0045, 0.002, 0.034], fente, [fx, H - 0.001, fz], { r: 0.001 }));
    }
  };
  zone(-0.12, -0.02, 0.19);
  zone(0.045, 0.115, 0.15);
  // bandeau en alu brossé au-dessus de la vitre principale : bouton à liseré bleu, dongle, USB-A, deux jacks, USB-C
  const yb = H - 0.07;
  el.push(boite([0.014, 0.055, L], alu, [-P / 2 + 0.007, yb, 0], { r: 0.002 }));
  for (let k = 0; k < 6; k++) el.push(boite([0.0006, 0.0015, L - 0.01], m.uni('#30313a'), [-P / 2 - 0.0003, yb + 0.008 + k * 0.008, 0])); // brossé
  const face = -P / 2 - 0.001;
  const yp = yb + 0.027;
  el.push(boite([0.004, 0.014, 0.028], led, [face, yp - 0.007, -0.17], { r: 0.003 }));
  el.push(boite([0.004, 0.009, 0.02], m.uni('#0d0d10'), [face - 0.0005, yp - 0.0045, -0.17], { r: 0.002 }));
  el.push(boite([0.022, 0.011, 0.016], m.uni('#18181d'), [face - 0.011, yp - 0.0055, -0.115], { r: 0.003 })); // le dongle Logitech
  el.push(boite([0.004, 0.009, 0.02], m.uni('#2b2c33'), [face, yp - 0.0045, -0.07], { r: 0.001 }));
  el.push(boite([0.0045, 0.0025, 0.014], m.uni('#9aa0a8'), [face - 0.0003, yp - 0.0015, -0.07]));
  for (const zj of [-0.035, -0.012]) el.push(tore(0.012, 0.0022, m.metalClair, [face - 0.001, yp, zj], [0, PI / 2, 0]), cylindre(0.007, 0.004, fente, [face, yp, zj], { rot: axeX, centre: true, segments: 10 }));
  el.push(boite([0.004, 0.006, 0.016], m.metalClair, [face, yp - 0.003, 0.02], { r: 0.0025 }));
  // les deux vitres : la grande face (avec son bandeau noir en bas) et le flanc côté fenêtre
  el.push(boite([0.005, H - 0.105, L - 0.014], vitre, [-P / 2 + 0.0025, 0.04, -0.002], { r: 0.001 }));
  el.push(boite([0.01, 0.026, L], noir, [-P / 2 + 0.005, 0.016, 0], { r: 0.002 }));
  el.push(boite([P - 0.016, H - 0.05, 0.005], vitre, [0.002, 0.03, L / 2 - 0.0025], { r: 0.001 }));
  // l'intérieur : carte mère sombre contre le dos, pompe à anneau lumineux, barrettes, carte graphique
  el.push(boite([0.006, 0.3, 0.27], m.uni('#13151f'), [P / 2 - 0.016, 0.1, -0.06], { r: 0.002 }));
  el.push(boite([0.004, 0.05, 0.08], m.uni('#1d2236'), [P / 2 - 0.02, 0.33, -0.12], { r: 0.002 })); // radiateur des étages d'alim
  el.push(cylindre(0.07, 0.035, noir, [P / 2 - 0.04, 0.26, -0.07], { rot: axeX, centre: true, segments: 24 }));
  el.push(tore(0.06, 0.006, cyan, [P / 2 - 0.058, 0.26, -0.07], [0, PI / 2, 0]));
  el.push(boite([0.002, 0.016, 0.016], cyan, [P / 2 - 0.058, 0.26, -0.07], { rot: [PI / 4, 0, 0] }));
  for (const yr of [0.31, 0.335]) el.push(boite([0.03, 0.012, 0.13], led, [P / 2 - 0.035, yr, 0.06], { r: 0.004 }));
  el.push(boite([0.12, 0.05, 0.28], m.uni('#1e1f27'), [P / 2 - 0.08, 0.13, -0.04], { r: 0.006 }));
  el.push(boite([0.002, 0.02, 0.05], cyan, [P / 2 - 0.141, 0.145, -0.1], { r: 0.001, rot: [0.3, 0, 0] })); // le logo
  el.push(boite([0.004, 0.006, 0.27], cyan, [P / 2 - 0.141, 0.17, -0.04], { r: 0.001 })); // liseré lumineux, sur la tranche
  // cache-alimentation : un caisson bas percé de fentes claires
  el.push(boite([P - 0.03, 0.085, 0.2], noir, [0.0, 0.024, -0.11], { r: 0.003 }));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) el.push(boite([0.002, 0.008, 0.032], m.uni('#8d919b'), [-(P - 0.03) / 2 - 0.001, 0.04 + r * 0.016, -0.18 + c * 0.042 + (r % 2) * 0.02], { r: 0.001 }));
  // panneau de passe-câbles côté porte, à fentes verticales
  el.push(boite([P - 0.05, 0.32, 0.005], fonce, [0.01, 0.11, -L / 2 + 0.03], { r: 0.002 }));
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) el.push(boite([0.006, 0.035, 0.002], m.uni('#474954'), [-0.09 + c * 0.045, 0.13 + r * 0.055, -L / 2 + 0.0335], { r: 0.001 }));
  // watercooling : radiateur sous le dessus, trois ventilateurs tournés vers le bas, tuyaux tressés vers la pompe
  el.push(boite([0.12, 0.028, 0.4], m.uni('#17171c'), [-0.02, H - 0.05, 0.0], { r: 0.003 }));
  for (const zf of [-0.13, 0.0, 0.13]) el.push(ventiloPC(m, led, [-0.02, H - 0.065, zf], 'y'));
  el.push(tube([[P / 2 - 0.06, 0.27, -0.05], [0.02, 0.3, 0.02], [-0.03, 0.36, 0.08], [-0.04, H - 0.06, 0.15]], 0.008, m.uni('#16161b'), 20));
  el.push(tube([[P / 2 - 0.06, 0.25, -0.06], [0.0, 0.27, 0.03], [-0.06, 0.34, 0.1], [-0.07, H - 0.06, 0.16]], 0.008, m.uni('#16161b'), 20));
  // trois ventilateurs debout côté fenêtre, qui soufflent dans le boîtier
  for (const yf of [0.1, 0.225, 0.35]) el.push(ventiloPC(m, led, [-0.03, yf, L / 2 - 0.03], 'z'));
  return [groupe('objet_pc', ...el).translateX(x).translateY(y).translateZ(z)];
}

// Enceinte Logitech Z207 : un petit caisson noir aux bords arrondis, légèrement penché en arrière, la façade
// percée de deux disques cerclés d'argent (le haut-parleur en haut, le radiateur passif en bas). La droite porte
// la molette marche / volume, le bouton Bluetooth à voyant et la prise casque. Façade vers −x.
function z207(m, [x, y, z], droite = false) {
  const noir = m.uni('#1a1a20');
  const fonce = m.uni('#26262d');
  const [P, H, L] = [0.088, 0.17, 0.09];
  const el = [
    boite([P, H, L], noir, [0, 0.008, 0], { r: 0.03 }),
    boite([P + 0.006, 0.01, L + 0.004], m.uni('#121216'), [0.004, 0, 0], { r: 0.004 }), // le socle
    // haut-parleur : bague argentée, membrane en cône, cache-noyau
    tore(0.064, 0.0035, m.metalClair, [-P / 2 - 0.001, 0.125, 0], [0, PI / 2, 0]),
    cylindre(0.058, 0.012, fonce, [-P / 2 + 0.004, 0.125, 0], { rot: axeX, centre: true, segments: 24, dBas: 0.03 }),
    sphere(0.02, noir, [-P / 2 - 0.001, 0.125, 0], { echelle: [0.4, 1, 1] }),
    // radiateur passif : un grand disque plat, sa bague
    tore(0.07, 0.0035, m.metalClair, [-P / 2 - 0.001, 0.055, 0], [0, PI / 2, 0]),
    cylindre(0.064, 0.004, m.uni('#2e2e36'), [-P / 2, 0.055, 0], { rot: axeX, centre: true, segments: 24 }),
    cylindre(0.03, 0.005, m.uni('#38383f'), [-P / 2 - 0.001, 0.055, 0], { rot: axeX, centre: true, segments: 16 }),
    boite([0.002, 0.004, 0.024], m.metalClair, [-P / 2 - 0.002, 0.02, 0], { r: 0.001 }), // le logo
    // câble qui part derrière
    tube([[P / 2 - 0.01, 0.03, 0], [P / 2 + 0.03, 0.01, 0.01], [P / 2 + 0.12, 0.002, 0.03]], 0.0025, m.noirMat, 8),
  ];
  if (droite) {
    el.push(
      cylindre(0.024, 0.012, m.uni('#30303a'), [-0.01, H + 0.008, 0.015], { segments: 18 }), // molette sur le dessus
      tore(0.024, 0.0015, m.metalClair, [-0.01, H + 0.02, 0.015], [PI / 2, 0, 0]),
      cylindre(0.014, 0.004, m.uni('#3a3a44'), [0.018, H + 0.006, -0.02], { segments: 12 }), // bouton Bluetooth
      sphere(0.004, m.uni('#4aa3ff'), [0.018, H + 0.009, -0.02]),
      cylindre(0.008, 0.004, fente(m), [-P / 2 - 0.0005, 0.02, 0.03], { rot: axeX, centre: true, segments: 10 }), // prise casque
    );
  }
  return [place(el, [x, y, z], 0).rotateZ(-0.1)];
}
const fente = (m) => m.uni('#060608');

// Le tapis de souris XXL (90 × 40 cm) de ta photo : pivoines blanches sur fond noir, coins arrondis, bord cousu.
// Couché à plat, la grande longueur selon z ; [x, y, z] = centre du dessous.
function tapisSouris([x, y, z]) {
  const [A, B, E, R] = [0.9, 0.4, 0.004, 0.02];
  const f = new THREE.Shape();
  f.moveTo(-A / 2 + R, -B / 2);
  f.lineTo(A / 2 - R, -B / 2);
  f.quadraticCurveTo(A / 2, -B / 2, A / 2, -B / 2 + R);
  f.lineTo(A / 2, B / 2 - R);
  f.quadraticCurveTo(A / 2, B / 2, A / 2 - R, B / 2);
  f.lineTo(-A / 2 + R, B / 2);
  f.quadraticCurveTo(-A / 2, B / 2, -A / 2, B / 2 - R);
  f.lineTo(-A / 2, -B / 2 + R);
  f.quadraticCurveTo(-A / 2, -B / 2, -A / 2 + R, -B / 2);
  const geo = new THREE.ExtrudeGeometry(f, { depth: E, bevelEnabled: false, curveSegments: 6 });
  // l'image couvre le dessus : u le long des 90 cm, v le long des 40 cm
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + A / 2) / A, (p.getY(i) + B / 2) / B);
  // (X forme, Y forme, épaisseur) -> (z, x, y) : la largeur de 40 cm part vers le fond du bureau (+x)
  geo.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, x, 0, 0, 1, y, 1, 0, 0, z, 0, 0, 0, 1));
  const dessus = new THREE.MeshStandardMaterial({ map: image('/photos/mantes/tapis.jpg'), roughness: 0.95 });
  dessus.name = 'tapis';
  const mesh = new THREE.Mesh(geo, [dessus, new THREE.MeshStandardMaterial({ color: '#0c0c0f', roughness: 0.8 })]);
  mesh.name = 'tapis'; // gardé à part à la fusion (deux matériaux)
  mesh.receiveShadow = true;
  return mesh;
}

// --- Le bureau blanc assis-debout : plateau 160 × 80, deux colonnes télescopiques à patins ---
// Dessus, de la porte vers la fenêtre : l'enceinte gauche, l'écran 27" et le MacBook devant, l'enceinte droite,
// puis la tour PC ; devant, le tapis XXL et la souris ; au bord, le porte-gobelet avec la bouteille d'eau.
function bureau() {
  const m = creerMateriaux();
  const blancPied = m.uni('#f3f3f1');
  const Y = 0.72; // dessous du plateau
  const T = Y + 0.025; // dessus du plateau
  const ZE = -0.15; // centre de l'écran
  const pied = (z) => [
    boite([0.7, 0.03, 0.07], blancPied, [0.0, 0.012, z], { r: 0.014 }), // patin
    ...[-0.3, 0.3].map((dx) => cylindre(0.028, 0.012, m.uni('#9aa0a6'), [dx, 0, z])), // vérins
    boite([0.09, 0.4, 0.06], blancPied, [0.06, 0.04, z], { r: 0.006 }), // colonne basse
    boite([0.075, 0.3, 0.048], blancPied, [0.06, 0.42, z], { r: 0.005 }), // colonne haute, télescopique
    boite([0.6, 0.04, 0.06], blancPied, [0.0, Y - 0.04, z], { r: 0.006 }), // console sous le plateau
  ];
  return groupe(
    'bureau',
    boite([0.8, 0.025, 1.6], m.blanc, [0, Y, 0], { r: 0.008 }),
    boite([0.804, 0.006, 1.604], m.uni('#e8e9ea'), [0, Y + 0.004, 0], { r: 0.003 }), // chant du plateau
    ...pied(-0.68),
    ...pied(0.68),
    boite([0.06, 0.05, 1.3], blancPied, [0.08, Y - 0.05, 0], { r: 0.006 }), // traverse avec le moteur
    boite([0.03, 0.03, 0.09], m.uni('#dfe0e2'), [-0.38, Y - 0.03, -0.62], { r: 0.008 }), // le boîtier de commande
    ...[0, 1].map((k) => boite([0.006, 0.006, 0.016], m.uni('#9aa0a6'), [-0.396, Y - 0.02 - k * 0.012, -0.62], { r: 0.002 })),
    // la tour, côté fenêtre (+z)
    ...tourPC(m, [0.235, T, 0.53]),
    // écran 27" : dalle fine, cadre noir, pied en V ; l'image vient de ta photo (le programme la pose par son nom)
    boite([0.025, 0.37, 0.625], m.uni('#0f0f14'), [0.09, Y + 0.17, ZE], { r: 0.005 }),
    plan(0.61, 0.345, m.ecran, [0.077, Y + 0.355, ZE], { nom: 'ecran-pc', rotY: -PI / 2 }),
    boite([0.02, 0.012, 0.625], m.uni('#1b1b21'), [0.077, Y + 0.17, ZE], { r: 0.003 }), // menton du cadre
    boite([0.04, 0.2, 0.06], m.uni('#1b1b21'), [0.12, Y + 0.03, ZE], { r: 0.008 }),
    ...[-1, 1].map((s) => boite([0.2, 0.012, 0.035], m.uni('#1b1b21'), [0.08, T, ZE + s * 0.07], { r: 0.006, rot: [0, s * 0.55, 0] })),
    // le MacBook ouvert devant l'écran, l'écran tourné vers le bord du bureau (−x)
    place(macbook(m, 0, T + 0.004, 0), [-0.12, 0, ZE], -PI / 2),
    // les deux enceintes Z207 de part et d'autre de l'écran (la droite, côté PC, porte les commandes)
    ...z207(m, [0.11, T, ZE - 0.39], false),
    ...z207(m, [0.11, T, ZE + 0.38], true),
    // tapis XXL, souris
    tapisSouris([-0.17, T, -0.08]),
    boite([0.11, 0.035, 0.065], m.uni('#24242b'), [-0.2, T + 0.004, 0.2], { r: 0.03 }),
    // à gauche (côté porte) : une petite boîte bleue, un étui
    boite([0.12, 0.05, 0.08], m.uni('#3c5d99'), [0.0, T, -0.7], { r: 0.006 }),
    boite([0.08, 0.04, 0.16], m.uni('#e9edf2'), [0.25, T, -0.66], { r: 0.012 }),
    // porte-gobelet noir vissé au bord avant, avec la bouteille d'eau au bouchon bleu
    boite([0.05, 0.05, 0.04], m.uni('#17171c'), [-0.41, Y - 0.025, -0.33], { r: 0.006 }),
    tourne([[0.0, 0], [0.045, 0], [0.047, 0.11], [0.044, 0.11], [0.042, 0.005], [0, 0.005]], m.uni('#17171c'), [-0.47, Y - 0.06, -0.33]),
    tourne([[0.0, 0], [0.033, 0], [0.034, 0.16], [0.03, 0.2], [0.012, 0.22], [0, 0.22]], m.uni('#d9e7ef'), [-0.47, Y - 0.055, -0.33]),
    boite([0.068, 0.04, 0.068], m.uni('#3a74c9'), [-0.47, Y + 0.02, -0.33], { r: 0.03 }), // l'étiquette
    cylindre(0.026, 0.02, m.uni('#2e66c2'), [-0.47, Y + 0.163, -0.33]),
    // câbles qui descendent derrière le bureau
    tube([[0.3, T, -0.1], [0.36, Y - 0.2, -0.15], [0.38, 0.2, -0.2], [0.39, 0.01, -0.3]], 0.005, m.noirMat, 16),
  );
}

// --- La chaise de bureau ergonomique : piètement 5 branches à roulettes, assise galbée, dossier en filet ---
// Elle regarde −x : le dossier est du côté +x. Coussin jaune pâle contre le dossier, coussin vert d'eau tricoté.
function chaise() {
  const m = creerMateriaux();
  const noir = m.uni('#1b1b20');
  const plastique = m.uni('#26262d');
  const branches = [0, 1, 2, 3, 4].flatMap((i) => {
    const a = (i * 2 * PI) / 5 + 0.3;
    const [cx, cz] = [Math.cos(a), Math.sin(a)];
    const bout = [cx * 0.31, 0.075, cz * 0.31];
    return [
      barre([0, 0.105, 0], bout, 0.02, plastique, 8),
      boite([0.05, 0.025, 0.05], plastique, [bout[0], 0.055, bout[2]], { r: 0.01 }), // la chape de la roulette
      // roulette double : deux galets de part et d'autre
      ...[-1, 1].map((s) => cylindre(0.05, 0.016, noir, [bout[0] - sz(a) * s * 0.012, 0.025, bout[2] + sx(a) * s * 0.012], { rot: [PI / 2, a, 0], centre: true, segments: 16 })),
    ];
  });
  // dossier : un filet tendu dans un cadre courbe ; le profil monte en S et s'incline vers l'arrière
  const profil = (t) => [0.25 + 0.06 * t + 0.03 * Math.sin(t * PI), 0.52 + 0.56 * t]; // [x, y] le long du dossier
  const cadre = [-1, 1].map((s) => tube(Array.from({ length: 7 }, (_, k) => {
    const [px, py] = profil(k / 6);
    return [px, py, s * (0.22 - 0.03 * Math.sin((k / 6) * PI))];
  }), 0.016, noir, 24));
  const traverseHaut = tube([[profil(1)[0], profil(1)[1], -0.22], [profil(1)[0] + 0.01, profil(1)[1] + 0.02, 0], [profil(1)[0], profil(1)[1], 0.22]], 0.018, noir, 12);
  // le filet : une surface continue qui suit le cadre, avec une fine trame
  const trame = new THREE.MeshStandardMaterial({ map: texFilet(), roughness: 0.9, side: THREE.DoubleSide });
  trame.name = 'filet';
  const geoFilet = new THREE.PlaneGeometry(1, 1, 8, 16);
  const pf = geoFilet.attributes.position;
  for (let i = 0; i < pf.count; i++) {
    const s2 = pf.getX(i) * 2; // −1 … 1 sur la largeur
    const t = pf.getY(i) + 0.5; // 0 en bas, 1 en haut
    const [px, py] = profil(t);
    const demi = 0.22 - 0.03 * Math.sin(t * PI) - 0.008;
    pf.setXYZ(i, px + 0.004 + 0.02 * s2 * s2, py, s2 * demi); // légèrement creusé, comme un filet qui épouse le dos
  }
  geoFilet.computeVertexNormals();
  const filetDos = new THREE.Mesh(geoFilet, trame);
  filetDos.castShadow = true;
  filetDos.receiveShadow = true;
  return groupe(
    'chaise',
    ...branches,
    cylindre(0.07, 0.05, plastique, [0, 0.085, 0]), // moyeu
    cylindre(0.05, 0.16, noir, [0, 0.13, 0]), // cache du vérin
    cylindre(0.028, 0.12, m.chrome, [0, 0.28, 0]), // vérin
    boite([0.22, 0.05, 0.2], plastique, [0.02, 0.39, 0], { r: 0.012 }), // mécanisme
    barre([0.0, 0.41, 0.1], [-0.06, 0.39, 0.22], 0.007, plastique, 6), // manette
    // assise galbée : coque, coussin, bord avant arrondi
    boite([0.48, 0.03, 0.48], plastique, [0.0, 0.43, 0], { r: 0.012 }),
    tissu([0.5, 0.075, 0.5], noir, [-0.005, 0.455, 0], { r: 0.035, froissement: 0.003, graine: 2 }),
    cylindre(0.08, 0.5, noir, [-0.24, 0.49, 0], { rot: axeZ, centre: true, segments: 16 }),
    // support du dossier, cadre, filet, appui lombaire
    boite([0.06, 0.14, 0.1], plastique, [0.24, 0.42, 0], { r: 0.015 }),
    ...cadre,
    traverseHaut,
    filetDos,
    tissu([0.04, 0.08, 0.32], plastique, [0.255, 0.66, 0], { r: 0.02, froissement: 0.002 }),
    // accoudoirs réglables : jambe, gâchette, manchette
    ...[-0.28, 0.28].flatMap((z) => [
      boite([0.06, 0.03, 0.04], plastique, [0.1, 0.43, z * 0.85], { r: 0.008 }),
      boite([0.045, 0.2, 0.035], noir, [0.08, 0.45, z], { r: 0.008 }),
      boite([0.012, 0.03, 0.016], m.metalFonce, [0.055, 0.6, z], { r: 0.003 }),
      boite([0.26, 0.03, 0.08], m.uni('#24252e'), [-0.0, 0.65, z], { r: 0.014 }),
    ]),
    // les coussins : le jaune pâle calé dans le dos, le vert d'eau tricoté sur l'assise
    place([oreiller(0.4, 0.12, 0.38, m.uni('#f1e3a1'), [0, 0, 0], 4)], [0.2, 0.72, 0.0], 0).rotateZ(1.25),
    tissu([0.34, 0.04, 0.4], m.uni('#cfe6dd'), [-0.06, 0.52, 0], { r: 0.018, froissement: 0.004, graine: 6 }),
    ...[-0.12, -0.04, 0.04, 0.12].map((z) => boite([0.32, 0.004, 0.012], m.uni('#bcdacf'), [-0.06, 0.561, z], { r: 0.003 })),
  );
}
const sx = (a) => Math.cos(a);
const sz = (a) => Math.sin(a);

// --- Le pouf coffre vert d'eau : rembourré, passepoil autour du couvercle, pieds fuselés en chêne ---
function pouf() {
  const m = creerMateriaux();
  const vert = m.uni('#b8dccf');
  const vertFonce = m.uni('#a3cbbd');
  const [L, P, Hc] = [0.5, 0.38, 0.27];
  const y0 = 0.13;
  const pieds = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([s, t]) => {
    const g = cylindre(0.042, 0.14, m.chene, [0, 0, 0], { dBas: 0.026, segments: 12 });
    return place([g], [s * (L / 2 - 0.05), y0 - 0.14, t * (P / 2 - 0.05)], 0).rotateZ(s * 0.08).rotateX(-t * 0.08);
  });
  return groupe(
    'pouf',
    ...pieds,
    tissu([L, Hc - 0.07, P], vert, [0, y0, 0], { r: 0.03, froissement: 0.004, graine: 8 }), // le coffre
    tissu([L + 0.01, 0.075, P + 0.01], vert, [0, y0 + Hc - 0.075, 0], { r: 0.035, froissement: 0.003, graine: 3 }), // le couvercle rembourré
    // passepoils : en haut et à la jonction couvercle / coffre
    ...[y0 + Hc - 0.004, y0 + Hc - 0.078].flatMap((y) => [
      boite([L + 0.012, 0.01, 0.01], vertFonce, [0, y, P / 2 + 0.002], { r: 0.005 }),
      boite([L + 0.012, 0.01, 0.01], vertFonce, [0, y, -P / 2 - 0.002], { r: 0.005 }),
      boite([0.01, 0.01, P + 0.012], vertFonce, [L / 2 + 0.002, y, 0], { r: 0.005 }),
      boite([0.01, 0.01, P + 0.012], vertFonce, [-L / 2 - 0.002, y, 0], { r: 0.005 }),
    ]),
    // la feuille posée dessus, et une deuxième en dessous, décalée
    boite([0.21, 0.002, 0.297], m.papier, [-0.03, y0 + Hc + 0.003, 0.03], { rot: [0, 0.25, 0] }),
    boite([0.21, 0.002, 0.297], m.uni('#efede8'), [0.0, y0 + Hc + 0.001, 0.0], { rot: [0, 0.1, 0] }),
    ...[0, 1, 2, 3, 4, 5].map((k) => boite([0.12 - (k % 3) * 0.02, 0.0005, 0.006], m.encre, [-0.05, y0 + Hc + 0.0045, -0.06 + k * 0.03], { rot: [0, 0.25, 0] })),
  );
}

// Enceinte Edifier : flancs en bois, façade gris anthracite avec son filet argenté vertical, vers −x.
function edifier(m, [x, y, z], molettes = false) {
  const [P, H, L] = [0.2, 0.24, 0.15];
  const el = [
    boite([P, H, L], m.uni('#8a5c3b'), [x, y, z], { r: 0.006 }),
    boite([0.012, H - 0.004, L - 0.004], m.uni('#33343b'), [x - P / 2, y + 0.002, z], { r: 0.004 }),
    boite([0.003, H - 0.06, 0.004], m.metalClair, [x - P / 2 - 0.006, y + 0.03, z], { r: 0.001 }),
    boite([0.002, 0.008, 0.035], m.metalClair, [x - P / 2 - 0.006, y + 0.012, z], { r: 0.001 }), // le logo
    boite([P - 0.02, 0.01, L - 0.02], m.uni('#7a4f31'), [x, y - 0.006, z], { r: 0.003 }), // socle
  ];
  if (molettes) for (const h of [0.06, 0.11, 0.16]) el.push(cylindre(0.03, 0.012, m.uni('#26262c'), [x + 0.02, y + h, z + L / 2 + 0.004], { rot: axeZ, centre: true, segments: 16 }));
  return el;
}
// Lecteur CD blanc à couvercle transparent, posé à plat, molette jaune.
function lecteurCD(m, [x, y, z]) {
  return [
    boite([0.19, 0.045, 0.19], m.uni('#f2f1ec'), [x, y, z], { r: 0.012 }),
    cylindre(0.12, 0.003, m.chrome, [x + 0.02, y + 0.045, z]),
    cylindre(0.03, 0.004, m.uni('#d8dde2'), [x + 0.02, y + 0.046, z]),
    boite([0.15, 0.006, 0.15], m.verre, [x + 0.02, y + 0.046, z], { r: 0.01 }),
    ...[0, 1, 2, 3].map((k) => cylindre(0.014, 0.008, m.uni('#c9ccd0'), [x - 0.08, y + 0.04, z - 0.045 + k * 0.03], { segments: 10 })),
    cylindre(0.024, 0.016, m.uni('#f0b43a'), [x - 0.096, y + 0.02, z + 0.07], { rot: axeX, centre: true, segments: 14 }),
    boite([0.003, 0.012, 0.05], m.uni('#5b6470'), [x - 0.095, y + 0.02, z - 0.03], { r: 0.001 }), // l'afficheur
  ];
}
// Petite figurine verte (type Smiski) : un bonhomme tout rond.
const smiski = (m, [x, y, z], s = 1) => [
  cylindre(0.03 * s, 0.035 * s, m.uni('#b9dc7c'), [x, y, z], { dBas: 0.034 * s, segments: 12 }),
  sphere(0.042 * s, m.uni('#c4e388'), [x, y + 0.055 * s, z]),
];

// --- L'étagère blanche à enceintes : quatre plateaux sur quatre montants ronds, pieds boules ---
// Dessus : les deux enceintes Edifier et le lecteur CD. Puis les albums, la boîte CORTIS, l'éventail à photo.
function etagere() {
  const m = creerMateriaux();
  const [L, P] = [0.8, 0.36];
  const niveaux = [0.13, 0.37, 0.6, 0.84];
  const parts = [];
  const coins = [[-P / 2 + 0.025, -L / 2 + 0.025], [-P / 2 + 0.025, L / 2 - 0.025], [P / 2 - 0.025, -L / 2 + 0.025], [P / 2 - 0.025, L / 2 - 0.025]];
  for (const [x, z] of coins) {
    parts.push(cylindre(0.032, 0.84, m.blanc, [x, 0.03, z], { segments: 14 }), sphere(0.04, m.blanc, [x, 0.03, z]));
  }
  for (const y of niveaux) {
    parts.push(boite([P, 0.022, L], m.blanc, [0, y - 0.022, 0], { r: 0.005 }));
    parts.push(boite([0.012, 0.03, L - 0.04], m.blanc, [P / 2 - 0.006, y, 0], { r: 0.003 })); // rebord au dos
  }
  // dessus : enceintes, lecteur CD, une figurine verte sur chaque enceinte
  const H = niveaux[3];
  parts.push(...edifier(m, [0.0, H, -0.3]), ...edifier(m, [0.0, H, 0.3], true), ...lecteurCD(m, [0.02, H, 0.0]));
  parts.push(...smiski(m, [0.0, H + 0.24, 0.32], 0.8), ...smiski(m, [-0.12, H, -0.16], 0.7));
  parts.push(boite([0.14, 0.012, 0.14], m.uni('#3a3842'), [-0.08, H, 0.14], { r: 0.002, rot: [0, 0.3, 0] }), boite([0.14, 0.012, 0.14], m.uni('#a8b6d8'), [-0.09, H + 0.012, 0.14], { r: 0.002, rot: [0, 0.1, 0] }));
  // niveau 3 : magazines et pochettes d'albums, une figurine verte
  const N3 = niveaux[2];
  parts.push(
    ...[0, 1, 2].map((k) => boite([0.25, 0.008, 0.2], m.uni(['#e7cfd9', '#2d2c35', '#f0efea'][k]), [-0.02, N3 + k * 0.008, -0.24 + k * 0.01], { r: 0.002, rot: [0, k * 0.06, 0] })),
    boite([0.2, 0.025, 0.18], m.uni('#47454f'), [0.02, N3, 0.03], { r: 0.003 }),
    album(m, [0.13, N3, 0.26], [0.02, 0.2, 0.2], '#c9d8ee', -0.12),
    ...smiski(m, [-0.13, N3, 0.3], 0.8),
  );
  // niveau 2 : la boîte CORTIS debout, l'éventail rond à photo dans son support, des cartes photo
  const N2 = niveaux[1];
  parts.push(
    boite([0.16, 0.2, 0.08], m.uni('#efede8'), [0.02, N2, -0.28], { r: 0.004 }),
    boite([0.003, 0.03, 0.06], m.uni('#1e1e24'), [-0.061, N2 + 0.15, -0.28], { r: 0.001 }), // le logo
    boite([0.003, 0.05, 0.05], m.uni('#9fb6d6'), [-0.061, N2 + 0.06, -0.28], { r: 0.001 }),
    cylindre(0.2, 0.004, m.uni('#f6f1ea'), [0.05, N2 + 0.13, 0.05], { rot: axeX, centre: true, segments: 32 }), // l'éventail
    cylindre(0.13, 0.002, m.uni('#e8c9a6'), [0.047, N2 + 0.13, 0.05], { rot: axeX, centre: true, segments: 24 }), // la photo
    boite([0.01, 0.1, 0.022], m.uni('#f6f1ea'), [0.05, N2, 0.05], { r: 0.003 }), // le manche
    ...[0, 1, 2].map((k) => boite([0.055, 0.085, 0.002], m.uni(['#d6a6b6', '#a8c4e0', '#e6d6a6'][k]), [-0.06, N2, 0.24 + k * 0.03], { rot: [0.2, 0, 0] })),
  );
  // niveau 1 : deux grands albums à plat, l'album blanc « OOO » et le rose « NO LABELS »
  const N1 = niveaux[0];
  parts.push(
    boite([0.3, 0.035, 0.3], m.uni('#f6f6f4'), [0.0, N1, -0.18], { r: 0.003 }),
    tore(0.08, 0.008, m.uni('#9aa0a6'), [0.0, N1 + 0.036, -0.18], [PI / 2, 0, 0]),
    boite([0.3, 0.04, 0.32], m.uni('#efc0cc'), [0.0, N1, 0.2], { r: 0.003 }),
    boite([0.08, 0.002, 0.2], m.uni('#9b5d72'), [-0.05, N1 + 0.041, 0.2]),
    ...smiski(m, [-0.12, N1 + 0.04, 0.32], 0.7),
  );
  return groupe('etagere', ...parts);
}

// --- Le chevet : un chariot blanc à roulettes, trois plateaux à rebords, un bac en bois clair au milieu ---
// Dessus : la boîte de mouchoirs, une boîte noire et un petit cadre ; un casque accroché au côté.
function chevet() {
  const m = creerMateriaux();
  const [L, P, Hh] = [0.42, 0.38, 0.62];
  const niveaux = [0.12, 0.36, Hh];
  const parts = [];
  for (const [sx2, sz2] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const [x, z] = [sx2 * (P / 2 - 0.015), sz2 * (L / 2 - 0.015)];
    parts.push(cylindre(0.02, Hh - 0.05, m.blanc, [x, 0.06, z], { segments: 10 }));
    parts.push(boite([0.03, 0.02, 0.03], m.blanc, [x, 0.045, z], { r: 0.005 }));
    parts.push(cylindre(0.045, 0.02, m.uni('#3c3c44'), [x, 0.022, z], { rot: axeZ, centre: true, segments: 14 })); // roulette
  }
  for (const y of niveaux) {
    parts.push(boite([P, 0.012, L], m.blanc, [0, y - 0.012, 0], { r: 0.004 }));
    // rebords tout autour
    parts.push(boite([P, 0.03, 0.01], m.blanc, [0, y - 0.012, L / 2 - 0.005], { r: 0.003 }), boite([P, 0.03, 0.01], m.blanc, [0, y - 0.012, -L / 2 + 0.005], { r: 0.003 }));
    parts.push(boite([0.01, 0.03, L], m.blanc, [P / 2 - 0.005, y - 0.012, 0], { r: 0.003 }), boite([0.01, 0.03, L], m.blanc, [-P / 2 + 0.005, y - 0.012, 0], { r: 0.003 }));
  }
  // le bac en bois clair du milieu, avec sa découpe de prise
  parts.push(
    boite([P - 0.04, 0.14, L - 0.04], m.uni('#e4cc9c'), [0, niveaux[1], 0], { r: 0.006 }),
    boite([0.004, 0.025, 0.1], m.uni('#b99c68'), [-P / 2 + 0.019, niveaux[1] + 0.1, 0], { r: 0.008 }),
  );
  // en bas : une boîte noire (le casque rangé)
  parts.push(boite([0.22, 0.07, 0.2], m.uni('#1d1d23'), [0, niveaux[0], 0.04], { r: 0.012 }));
  // dessus : mouchoirs, boîte noire, petit cadre
  parts.push(
    boite([0.12, 0.11, 0.12], m.uni('#d7e6ef'), [0.05, Hh, -0.1], { r: 0.008 }),
    boite([0.06, 0.003, 0.03], m.uni('#9ab5c9'), [0.05, Hh + 0.11, -0.1]),
    tissu([0.06, 0.04, 0.06], m.papier, [0.05, Hh + 0.105, -0.1], { r: 0.015, froissement: 0.01, graine: 13 }),
    boite([0.22, 0.04, 0.14], m.uni('#1c1c22'), [0.0, Hh, 0.09], { r: 0.008 }),
    boite([0.012, 0.11, 0.15], m.uni('#efeeea'), [0.02, Hh + 0.04, 0.12], { r: 0.003, rot: [0, 0, -0.25] }),
    boite([0.004, 0.08, 0.12], m.uni('#89a3b8'), [0.012, Hh + 0.055, 0.12], { r: 0.001, rot: [0, 0, -0.25] }),
  );
  // le casque noir accroché au flanc
  parts.push(
    tore(0.17, 0.012, m.uni('#1d1d23'), [-0.05, 0.45, -L / 2 - 0.03], [0, 0, 0]),
    ...[-1, 1].map((s) => cylindre(0.08, 0.04, m.uni('#2a2a31'), [-0.05 + s * 0.085, 0.4, -L / 2 - 0.03], { rot: axeZ, centre: true, segments: 18 })),
  );
  return groupe('chevet', ...parts);
}

// --- Le radiateur électrique blanc : convecteur, grille du dessus, boîtier de commande, pattes murales ---
function radiateur() {
  const m = creerMateriaux();
  const fente = m.uni('#cfd4d8');
  const [P, H, L] = [0.085, 0.45, 0.62];
  const y0 = 0.12;
  return groupe(
    'radiateur',
    boite([P, H, L], m.blanc, [0, y0, 0], { r: 0.012 }),
    // façade légèrement bombée, et la bande de fentes du bas
    boite([0.006, H - 0.06, L - 0.03], m.uni('#f7f7f6'), [-P / 2, y0 + 0.03, 0], { r: 0.004 }),
    ...Array.from({ length: 18 }, (_, k) => boite([0.006, 0.05, 0.008], fente, [-P / 2 - 0.002, y0 + 0.03, -L / 2 + 0.06 + k * 0.029], { r: 0.002 })),
    // grille du dessus : des lames
    ...Array.from({ length: 22 }, (_, k) => boite([P - 0.02, 0.004, 0.01], fente, [0, y0 + H + 0.001, -L / 2 + 0.035 + k * 0.026], { r: 0.001 })),
    // boîtier de commande à droite : molette, voyant
    boite([0.004, 0.14, 0.08], m.uni('#eef0f1'), [-P / 2 - 0.002, y0 + H - 0.18, L / 2 - 0.06], { r: 0.004 }),
    cylindre(0.035, 0.012, m.uni('#d8dcdf'), [-P / 2 - 0.006, y0 + H - 0.08, L / 2 - 0.06], { rot: axeX, centre: true, segments: 18 }),
    sphere(0.008, m.uni('#ff8a5c'), [-P / 2 - 0.004, y0 + H - 0.14, L / 2 - 0.06]),
    // pattes de fixation et câble
    ...[-0.2, 0.2].map((z) => boite([0.03, 0.06, 0.04], m.uni('#dfe2e4'), [P / 2 - 0.01, y0 - 0.03, z], { r: 0.004 })),
    tube([[0, y0, L / 2 - 0.02], [0.01, 0.06, L / 2 + 0.02], [0.03, 0.012, L / 2 + 0.06], [0.04, 0.012, L / 2 + 0.2]], 0.004, m.blanc, 12),
  );
}

const fabrique = (f) => () => fusionner(f());
export const modelesMantes = {
  lit: fabrique(lit),
  kallax: fabrique(kallax),
  bureau: fabrique(bureau),
  chaise: fabrique(chaise),
  pouf: fabrique(pouf),
  etagere: fabrique(etagere),
  chevet: fabrique(chevet),
  radiateur: fabrique(radiateur),
  // de la chambre de Paris, repris tels quels
  lampadaire: meublesParis.lampadaire,
  ventilateur: meublesParis.ventilateur,
};
