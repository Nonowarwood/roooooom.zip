import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { champMiffy, MIFFY } from './miffy.js';
import { macbook, bureauNu } from './meubles.js';
import { creerMateriaux, boite, cylindre, sphere, tore, barre, tube, tourne, tissu, fusionner, veines, veinerBois, RoundedBoxGeometry } from './outils.js';
import { agencementReve } from '../chambre.js';

// Les meubles neufs de la chambre de rêve (ceux qui n'existent pas dans la chambre de Paris), modélisés en code
// dans le même style que src/modeles/meubles.js : couleurs unies, pastel, mates, et le détail dans la géométrie.
// Chaque fonction renvoie un groupe dont l'origine est le centre du meuble au sol, la façade tournée vers +z ;
// `rotation` (dans agencementReve, chambre.js) le tourne à sa place. Exportés en .glb (public/models/) par la
// page modeles.html, comme les autres.

const PI = Math.PI;
const groupe = (nom, ...enfants) => {
  const g = new THREE.Group();
  g.name = nom;
  g.add(...enfants.flat());
  return g;
};
const mat = (nom, couleur, extra = {}) => {
  const m = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.9, metalness: 0, ...extra });
  m.name = nom;
  return m;
};
const ombres = (o) => {
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
// pseudo-hasard reproductible : le même modèle à chaque export
function hasard(graine) {
  let s = graine;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Petit cœur (feuille de pothos), dessiné dans le plan (x, y), pointe en bas.
function formeCoeur(t) {
  const f = new THREE.Shape();
  f.moveTo(0, -1 * t);
  f.bezierCurveTo(-0.25 * t, -0.75 * t, -1.2 * t, 0, -1.1 * t, 0.5 * t);
  f.bezierCurveTo(-1.0 * t, 1.1 * t, -0.25 * t, 1.2 * t, 0, 0.75 * t);
  f.bezierCurveTo(0.25 * t, 1.2 * t, 1.0 * t, 1.1 * t, 1.1 * t, 0.5 * t);
  f.bezierCurveTo(1.2 * t, 0, 0.25 * t, -0.75 * t, 0, -1 * t);
  return f;
}

// ===========================================================================================
// --- Le tapis tufté tête de Miffy (≈ 60 × 80 cm, d'après ta photo) ---
// Un relief de 1,6 cm d'épaisseur, arrondi au bord, sur une grille de 8 mm : la silhouette vient du champ de
// distance de src/modeles/miffy.js. Les points de la grille juste dehors sont ramenés sur le bord, à ras du sol :
// le contour est net, sans marches. Ses couleurs (bouclette blanche, contour, yeux et bouche noirs) sont une
// texture que le programme colle sur le maillage nommé « imprime-miffy » (src/textures.js, `tapisMiffy`).
// Origine : le centre de la tête, au sol ; les oreilles vers −z.
// ===========================================================================================
function tapisMiffy() {
  const champ = champMiffy();
  const { x0, y0, x1, y1 } = champ;
  const pas = 0.008;
  const E = MIFFY.epaisseur;
  const arrondi = 0.012; // la bouclette s'arrondit sur 12 mm au bord
  const nx = Math.ceil((x1 - x0) / pas) + 1;
  const ny = Math.ceil((y1 - y0) / pas) + 1;
  const positions = [];
  const uvs = [];
  const dedans = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let x = x0 + i * pas;
      let y = y0 + j * pas;
      const d = champ.lire(x, y);
      let h = 0.001; // 1 mm au-dessus du parquet, pour que le bord ne s'y mélange pas
      if (d > 0) {
        const [gx, gy] = champ.pente(x, y);
        x -= d * gx;
        y -= d * gy;
      } else {
        const t = Math.min(1, -d / arrondi);
        h += E * Math.sqrt(1 - (1 - t) * (1 - t)); // un quart de cercle, puis plat
      }
      positions.push(x, h, -y);
      uvs.push((x - x0) / (x1 - x0), (y - y0) / (y1 - y0));
      dedans.push(d <= 0);
    }
  }
  // on garde les triangles qui ont au moins un sommet dans le tapis
  const index = [];
  const k = (i, j) => j * nx + i;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const [a, b, c, e] = [k(i, j), k(i + 1, j), k(i + 1, j + 1), k(i, j + 1)];
      if (dedans[a] || dedans[b] || dedans[c]) index.push(a, b, c); // (sens qui fait regarder la face vers le haut)
      if (dedans[a] || dedans[c] || dedans[e]) index.push(a, c, e);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  // les sommets que plus aucun triangle n'utilise sont retirés (le fichier reste léger)
  geo = geo.toNonIndexed();
  geo = mergeVertices(geo, 1e-6);
  geo.computeVertexNormals();
  const tapis = new THREE.Mesh(geo, mat('miffy', '#f2efe8', { roughness: 1 }));
  tapis.name = 'imprime-miffy';
  tapis.receiveShadow = true;
  return groupe('tapis-miffy', tapis);
}

// ===========================================================================================
// --- Grande plante : un monstera de 1,30 m dans un cache-pot crème, sur un tuteur en fibre de coco ---
// Les feuilles sont découpées (fentes entre les nervures), pliées le long de la nervure centrale et tombent
// un peu au bout. Elles partent toutes vers la pièce ou de côté : le mur est est à 35 cm derrière (côté +x),
// (posé dans le coin de la lucarne, il est tourné d’un demi-tour : le mur est alors à −x).
// ===========================================================================================

// Demi-feuille de monstera dans le plan (x, y), base (attache du pétiole) en 0, pointe en (0, L), le bord du côté
// x > 0, puis la nervure centrale jusqu'à la base (ses sommets servent au pli).
function demiFeuille(L, w, fentes) {
  const bez = (a, b, c, d) => new THREE.CubicBezierCurve(new THREE.Vector2(...a), new THREE.Vector2(...b), new THREE.Vector2(...c), new THREE.Vector2(...d));
  const bord = new THREE.CurvePath();
  bord.add(bez([0, 0], [0.12 * w, -0.06 * L], [0.6 * w, -0.17 * L], [0.88 * w, -0.03 * L])); // le lobe, sous l'attache
  bord.add(bez([0.88 * w, -0.03 * L], [1.08 * w, 0.12 * L], [1.06 * w, 0.52 * L], [0.62 * w, 0.8 * L]));
  bord.add(bez([0.62 * w, 0.8 * L], [0.36 * w, 0.96 * L], [0.1 * w, 1.0 * L], [0, L]));
  const pts = bord.getSpacedPoints(70);
  // les fentes : à certains endroits du bord, l'entaille file vers la nervure centrale en suivant les nervures
  // (qui montent vers la pointe), et s'arrête avant elle
  // L'entaille s'ouvre en V vers le bord (on saute deux points du bord : environ 2,5 cm d'ouverture) et finit
  // en pointe arrondie à mi-chemin de la nervure centrale.
  const sortie = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    sortie.push(p);
    const t = i / (pts.length - 1);
    const f = fentes.find((s) => Math.abs(s - t) < 0.5 / pts.length);
    if (f === undefined || i + 3 >= pts.length) continue;
    const q = pts[i + 3]; // où l'entaille ressort
    const milieu = p.clone().lerp(q, 0.5);
    const yM = Math.max(0.04 * L, milieu.y - milieu.x * 0.75); // le départ de la nervure sur la nervure centrale
    const dir = new THREE.Vector2(milieu.x, milieu.y - yM);
    const fond = new THREE.Vector2(0, yM).addScaledVector(dir, 0.5);
    const perp = new THREE.Vector2(-dir.y, dir.x).setLength(0.003);
    const dirN = dir.clone().normalize();
    sortie.push(fond.clone().sub(perp), fond.clone().addScaledVector(dirN, -0.002), fond.clone().add(perp));
    i += 2; // les deux points du bord dans l'ouverture disparaissent
  }
  for (let k = 1; k < 14; k++) sortie.push(new THREE.Vector2(0, L * (1 - k / 14)));
  return new THREE.Shape(sortie);
}

// Une feuille entière, posée : base en `base`, qui part dans la direction (azimut `phi`, pente `theta`),
// tournée de `roulis` autour de sa nervure.
function feuilleMonstera({ L, base, phi, theta, roulis = 0, materiau, nervure, graine = 1 }) {
  const w = L * 0.52; // une feuille de monstera est presque aussi large que longue
  const alea = hasard(graine);
  const fentes = [0.3, 0.43, 0.56, 0.68].map((t) => t + (alea() - 0.5) * 0.03);
  const geos = [];
  for (const cote of [1, -1]) {
    const g = new THREE.ShapeGeometry(demiFeuille(L, w, fentes.map((t) => t + (cote < 0 ? 0.015 : 0))), 1);
    if (cote < 0) g.scale(-1, 1, 1);
    geos.push(g);
  }
  // pli en V le long de la nervure, pointe qui retombe, bord légèrement ondulé
  const plier = (x, y) => -0.12 * Math.abs(x) - 0.16 * L * (y / L) ** 2 + 0.006 * Math.sin(y * 40 + graine) * Math.abs(x) / w;
  for (const g of geos) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, plier(pos.getX(i), pos.getY(i)));
    g.computeVertexNormals();
  }
  const nerv = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(Array.from({ length: 8 }, (_, k) => new THREE.Vector3(0, (k / 7) * 0.85 * L, plier(0, (k / 7) * 0.85 * L) + 0.0015))),
    16,
    0.0028,
    5,
    false,
  );
  // repère de la feuille : y = direction, z = dessus de la feuille, x = côté
  const dir = new THREE.Vector3(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
  const dessus = new THREE.Vector3(-Math.sin(theta) * Math.cos(phi), Math.cos(theta), -Math.sin(theta) * Math.sin(phi));
  dessus.applyAxisAngle(dir, roulis);
  const cote = new THREE.Vector3().crossVectors(dir, dessus);
  const matrice = new THREE.Matrix4().makeBasis(cote, dir, dessus).setPosition(...base);
  const out = geos.map((g) => ombres(new THREE.Mesh(g.applyMatrix4(matrice), materiau)));
  out.push(ombres(new THREE.Mesh(nerv.applyMatrix4(matrice), nervure)));
  return { meshes: out, dir };
}

function plante() {
  const m = creerMateriaux();
  const feuilles = [mat('feuille', '#7fb38a', { side: THREE.DoubleSide }), mat('feuilleFoncee', '#6a9f7a', { side: THREE.DoubleSide })];
  const nervure = mat('nervure', '#a8d2a3');
  const tige = mat('tige', '#8dba86');
  const coco = mat('coco', '#b39477', { roughness: 1 });
  const racine = mat('racine', '#9a7d63');
  const parts = [];

  // le cache-pot crème, à lèvre arrondie, et son terreau
  const SOL = 0.29;
  parts.push(
    tourne(
      [[0, 0.004], [0.128, 0.004], [0.14, 0.0], [0.148, 0.006], [0.152, 0.02], [0.166, 0.29], [0.171, 0.31], [0.17, 0.322], [0.163, 0.326], [0.157, 0.318], [0.156, 0.3], [0.154, SOL - 0.01]],
      m.creme,
      [0, 0, 0],
      { segments: 40 },
    ),
    cylindre(0.312, 0.012, m.uni('#7a6252'), [0, SOL - 0.012, 0], { segments: 32 }),
  );
  // quelques billes d'argile sur le terreau
  const alea = hasard(3);
  for (let k = 0; k < 14; k++) {
    const a = alea() * 2 * PI;
    const r = 0.04 + alea() * 0.1;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), m.uni('#c99a7c'));
    b.position.set(r * Math.cos(a), SOL, r * Math.sin(a));
    parts.push(ombres(b));
  }

  // le tuteur en coco : un poteau un peu bosselé, deux attaches vertes
  {
    const g = new THREE.CylinderGeometry(0.026, 0.028, 1.0, 10, 24);
    const pos = g.attributes.position;
    const a2 = hasard(11);
    const bosses = Array.from({ length: 30 }, () => [a2() * 2 * PI, a2() - 0.5, 0.004 + a2() * 0.004]);
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const a = Math.atan2(z, x);
      let d = 0;
      for (const [ab, yb, h] of bosses) d += h * Math.exp(-6 * (((a - ab + 3 * PI) % (2 * PI)) - PI) ** 2 - ((y - yb) / 0.05) ** 2);
      const k = 1 + d / 0.027;
      pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    g.translate(-0.02, SOL + 0.5, 0.01);
    parts.push(ombres(new THREE.Mesh(g, coco)));
    for (const y of [0.62, 1.0]) parts.push(tore(0.064, 0.0035, m.uni('#6f9a6a'), [-0.02, SOL + y - 0.29, 0.01], [PI / 2, 0, 0]));
  }

  // la tige principale grimpe le long du tuteur (côté pièce)
  const tigeAu = (y) => [-0.055 + 0.006 * Math.sin(y * 9), y, 0.012 + 0.008 * Math.cos(y * 7)];
  parts.push(tube(Array.from({ length: 9 }, (_, k) => tigeAu(SOL - 0.01 + (k / 8) * (1.2 - SOL))), 0.011, tige, 30));
  // deux racines aériennes qui redescendent dans le terreau
  parts.push(tube([tigeAu(0.66), [-0.1, 0.55, 0.05], [-0.12, 0.42, 0.07], [-0.11, SOL - 0.005, 0.08]], 0.0035, racine, 18));
  parts.push(tube([tigeAu(0.82), [-0.09, 0.74, -0.05], [-0.1, 0.55, -0.08], [-0.07, SOL - 0.005, -0.1]], 0.003, racine, 18));

  // les feuilles : [longueur, azimut (degrés), hauteur de l'attache, distance de l'attache au tuteur, pente
  // (degrés), roulis]. Le monstera est dans le coin à droite du bureau de la lucarne, posé sans rotation : 0 = vers
  // le mur est, 90 = vers le meuble à vinyles (sud), 180 = vers le bureau et la fenêtre (ouest), 270 = vers le mur
  // bas du nord. Comme une vraie plante, il penche vers la lumière : les grandes feuilles partent vers la fenêtre et
  // la pièce ; celles qui passent au-dessus du meuble à vinyles restent plus haut que ses objets (~ 85 cm) ; les
  // petites du bas remplissent le coin, sous la pente.
  const liste = [
    [0.44, 150, 1.22, 0.1, 6, 0.1],
    [0.42, 188, 1.1, 0.13, -6, -0.15],
    [0.4, 115, 1.04, 0.14, -4, 0.2],
    [0.38, 228, 0.86, 0.13, -2, -0.1],
    [0.34, 72, 0.98, 0.1, 2, 0.25],
    [0.36, 160, 0.86, 0.15, -8, 0.05],
    [0.32, 300, 0.7, 0.15, 4, 0.15],
    [0.3, 252, 0.6, 0.14, 0, -0.2],
    [0.27, 345, 0.52, 0.12, 12, 0.1],
    [0.18, 135, 1.28, 0.06, 38, -0.4], // une jeune feuille qui se déplie, en haut
  ];
  liste.forEach(([L, phiD, y, r, thetaD, roulis], k) => {
    const phi = (phiD * PI) / 180;
    const base = [r * Math.cos(phi) - 0.02, y, r * Math.sin(phi) + 0.01];
    const { meshes, dir } = feuilleMonstera({ L, base, phi, theta: (thetaD * PI) / 180, roulis, materiau: feuilles[k % 2], nervure, graine: k + 1 });
    parts.push(...meshes);
    // le pétiole : il part de la tige, monte en s'écartant et arrive dans l'axe de la feuille
    const depart = tigeAu(Math.max(SOL + 0.03, y - 0.26 - r * 0.6));
    const arrivee = new THREE.Vector3(...base);
    const avant = arrivee.clone().addScaledVector(dir, -0.07).add(new THREE.Vector3(0, -0.05, 0));
    const milieu = new THREE.Vector3(...depart).lerp(avant, 0.5).add(new THREE.Vector3(0, 0.06, 0));
    parts.push(tube([depart, milieu.toArray(), avant.toArray(), base], 0.0055, tige, 20));
  });

  return groupe('plante', parts);
}

// Une barre à section rectangulaire arrondie entre deux points (les bras du support d'écran).
function barrePlate(a, b, [larg, haut], materiau, r = 0.008) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const geo = new RoundedBoxGeometry(d.length() + larg, haut, larg, 2, r);
  const mesh = ombres(new THREE.Mesh(geo, materiau));
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  return mesh;
}

// Rectangle aux coins arrondis, tracé dans un Shape ou un Path.
function rectArrondi(chemin, x0, y0, x1, y1, r) {
  chemin.moveTo(x0 + r, y0);
  chemin.lineTo(x1 - r, y0);
  chemin.quadraticCurveTo(x1, y0, x1, y0 + r);
  chemin.lineTo(x1, y1 - r);
  chemin.quadraticCurveTo(x1, y1, x1 - r, y1);
  chemin.lineTo(x0 + r, y1);
  chemin.quadraticCurveTo(x0, y1, x0, y1 - r);
  chemin.lineTo(x0, y0 + r);
  chemin.quadraticCurveTo(x0, y0, x0 + r, y0);
  return chemin;
}

// ===========================================================================================
// --- Le ThinkPad X201i (295 × 233 mm, écran 12,1 pouces en 16:10), d'après tes photos ---
// La base noire mate et son clavier ThinkPad touche par touche : en haut Échap, les trois boutons du volume, le
// bouton ThinkVantage bleu, le bouton d'alimentation, puis Impr. écran, Arrêt défil., Pause, Inser, Début, Page
// préc. ; F1–F12 par groupes de quatre, puis Suppr, Fin, Page suiv. ; les cinq rangées pleines, Entrée en bleu ;
// en bas Fn, Ctrl, Windows, Alt, espace, Alt, menu, Ctrl et le pavé de flèches qui descend sous la rangée (avec
// précédent et suivant au-dessus de ← et →). Le TrackPoint rouge entre G, H et B, ses trois boutons dans leur
// creux (rayures rouges, points sur celui du milieu), le lecteur d'empreintes et son témoin, l'autocollant Intel,
// le logo ThinkPad en biais. Sur les côtés : à gauche la fiche VGA bleue branchée, la grille du ventilateur et un
// USB ; à droite deux USB, l'Ethernet, la prise casque et la fente ExpressCard ; au dos la prise d'alimentation.
// L'écran : son cadre épais, la dalle (le fond d'écran, maillage « ecran-thinkpad »), les deux crochets et la
// ThinkLight en haut, les témoins (un vert allumé), « lenovo » et « X201i » en bas, les deux charnières claires ; au
// dos du capot, le logo ThinkPad et son point rouge. Le capot pivote autour de la charnière
// (« pivot_ecran_thinkpad ») : le programme l'ouvre ou le ferme au clic, comme le MacBook.
// Origine : le dessous de la base, au centre ; le clavier regarde +z. Renvoie aussi le bout de la fiche VGA
// (sortieVGA) et la direction dans laquelle le câble en sort (dirVGA), pour le tirer jusqu'à l'écran.
// ===========================================================================================
function thinkpad(m, { ecran = 'ecran-thinkpad' } = {}) {
  const W = 0.295;
  const D = 0.233;
  const HB = 0.021; // épaisseur de la base
  const PIEDS = 0.0015;
  const yd = PIEDS + HB; // le dessus de la base
  const coque = m.uni('#3a3846'); // le noir mat ThinkPad, adouci comme tous les noirs du site
  const pont = m.uni('#3f3d4c'); // le dessus de la base, un rien plus clair que les flancs
  const touche = m.uni('#2b2934');
  const creux = m.uni('#211f28');
  const bleu = m.uni('#7088bd');
  const rouge = m.uni('#dc4552');
  const argent = m.uni('#c8ccd3');
  const el = [];

  // — la base : la coque, puis le dessus ; quatre pieds en caoutchouc —
  el.push(boite([W, HB - 0.001, D], coque, [0, PIEDS, 0], { r: 0.004 }));
  el.push(boite([W - 0.003, 0.0012, D - 0.003], pont, [0, yd - 0.0012, 0], { r: 0.0006 }));
  for (const sx of [-0.12, 0.12]) for (const sz of [-0.09, 0.09]) el.push(cylindre(0.012, PIEDS, m.noirMat, [sx, 0, sz], { segments: 12 }));

  // — le clavier, rangée par rangée (positions en unités de touche, 15 unités de large) —
  const U = 0.0178;
  const JEU = 0.0029; // l'espace entre deux touches
  const HT = 0.0028; // hauteur d'une touche
  const yt = yd + 0.0002; // le pied des touches
  const xk = (u) => -7.5 * U + u * U;
  const touches = []; // chaque touche, dans l'ordre de pose : pour y imprimer sa légende
  const tch = (u0, w, z0, h, materiau = touche) => {
    touches.push({ x: xk(u0 + w / 2), z: z0 + (h * U) / 2, l: w * U - JEU, p: h * U - JEU });
    el.push(boite([w * U - JEU, HT, h * U - JEU], materiau, [xk(u0 + w / 2), yt, z0 + (h * U) / 2], { r: 0.0009 }));
  };
  const zClavier = -D / 2 + 0.013;
  let zr = zClavier;
  // 1re rangée : Échap à gauche ; les boutons ; les touches système à droite
  const h0 = 0.64;
  tch(0, 1, zr, h0);
  for (const [u0, w] of [[8.55, 0.95], [9.55, 0.95], [10.55, 0.95], [11.95, 1], [12.97, 1], [13.99, 1]]) tch(u0, w, zr, h0);
  const zb = zr + (h0 * U) / 2;
  for (const u of [1.6, 2.15, 2.7]) el.push(cylindre(0.0062, 0.0016, touche, [xk(u), yd, zb], { segments: 14 })); // volume −, +, muet
  el.push(boite([1.05 * U, 0.0012, 0.36 * U], bleu, [xk(3.75), yd, zb], { r: 0.0012 })); // ThinkVantage
  el.push(cylindre(0.0084, 0.0018, touche, [xk(7.85), yd, zb], { segments: 18 })); // alimentation
  el.push(tore(0.0106, 0.0008, m.uni('#5d5b6a'), [xk(7.85), yd + 0.0003, zb], [PI / 2, 0, 0])); // sa bague
  zr += h0 * U;
  // 2e rangée : F1–F12 par groupes de quatre, Suppr, Fin, Page suiv.
  const h1 = 0.64;
  for (const g of [0, 3.88, 7.76]) for (let k = 0; k < 4; k++) tch(g + k * 0.92, 0.9, zr, h1);
  for (const u0 of [11.95, 12.97, 13.99]) tch(u0, 1, zr, h1);
  zr += h1 * U;
  // les quatre rangées pleines (chiffres, tab, verr. maj. et Entrée bleue, maj.)
  const debutRangee = [];
  [
    [...Array(13).fill(1), 2],
    [1.5, ...Array(12).fill(1), 1.5],
    [1.75, ...Array(11).fill(1), 2.25],
    [2.25, ...Array(10).fill(1), 2.75],
  ].forEach((largeurs, i) => {
    debutRangee.push(zr);
    let u = 0;
    largeurs.forEach((w, k) => {
      tch(u, w, zr, 1, i === 2 && k === largeurs.length - 1 ? bleu : touche);
      u += w;
    });
    zr += U;
  });
  // la rangée du bas, puis le pavé de flèches (précédent, ↑, suivant ; ←, ↓, →) qui déborde sous la rangée
  let u = 0;
  for (const w of [1, 1.1, 1, 1.1, 5, 1, 1, 1]) {
    tch(u, w, zr, 1);
    u += w;
  }
  const wf = (15 - u) / 3;
  for (let k = 0; k < 3; k++) {
    tch(u + k * wf, wf, zr, 0.6);
    tch(u + k * wf, wf, zr + 0.64 * U, 0.6);
  }
  // les légendes, imprimées en blanc sur le dessus des touches (clavier français AZERTY ; Fn en bleu) : une
  // décalcomanie d'un seul tenant, détourée, posée 0,4 mm au-dessus des touches, dessinée d'après leurs positions
  {
    const D2 = (h, b) => [h, b]; // [en haut, en bas]
    const legendes = [
      'Esc', 'PrtSc', 'ScrLk', 'Pause', 'Insert', 'Home', 'PgUp',
      'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Delete', 'End', 'PgDn',
      '²', D2('1', '&'), D2('2', 'é'), D2('3', '"'), D2('4', "'"), D2('5', '('), D2('6', '-'), D2('7', 'è'), D2('8', '_'), D2('9', 'ç'), D2('0', 'à'), D2('°', ')'), D2('+', '='), '⟵',
      '⇥', 'A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', D2('¨', '^'), D2('£', '$'), D2('µ', '*'),
      '⇪', 'Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', D2('%', 'ù'), '↵',
      '⇧', 'W', 'X', 'C', 'V', 'B', 'N', D2('?', ','), D2('.', ';'), D2('/', ':'), D2('§', '!'), '⇧',
      'Fn', 'Ctrl', '⊞', 'Alt', '', 'Alt Gr', '▤', 'Ctrl',
      '«', '←', '↑', '↓', '»', '→',
    ];
    const [X0, X1] = [xk(0) - 0.002, xk(15) + 0.002];
    const [Z0, Z1] = [zClavier - 0.002, zr + 1.3 * U];
    const S = 8000; // pixels par mètre
    const mm = (v) => (v * S) / 1000; // une cote en millimètres, en pixels
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((X1 - X0) * S);
    canvas.height = Math.round((Z1 - Z0) * S);
    const g = canvas.getContext('2d');
    // les tailles sont celles du vrai clavier : lettres d'environ 3,3 mm de haut, chiffres doublés 2,5 mm, mots 2 mm
    const police = (corps) => `500 ${mm(corps)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const BLANC = '#ebeaf0';
    const BLEU = '#7aa3ec';
    const symbole = /^[←↑↓→«»⇥⇪⇧↵⟵⊞▤]$/;
    const ecrire = (texte, x, y, { corps, aligne = 'left', ligne = 'alphabetic' }) => {
      g.font = police(corps);
      g.textAlign = aligne;
      g.textBaseline = ligne;
      g.fillText(texte, x, y);
    };
    // les pictogrammes bleus des fonctions Fn, dessinés au trait (centre x, z en pixels ; cotes en mm)
    const pictos = {
      9: (x, z) => { // F3 : la batterie
        g.lineWidth = mm(0.32);
        g.strokeRect(x - mm(1.8), z - mm(0.85), mm(3.3), mm(1.7));
        g.fillRect(x + mm(1.5), z - mm(0.4), mm(0.45), mm(0.8));
        g.fillRect(x - mm(1.45), z - mm(0.5), mm(1.6), mm(1));
      },
      10: (x, z) => { // F4 : la veille (un croissant de lune)
        g.beginPath();
        g.arc(x, z, mm(1.35), 0, 2 * PI);
        g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        g.arc(x + mm(0.75), z - mm(0.45), mm(1.15), 0, 2 * PI);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      },
      11: (x, z) => { // F5 : le sans-fil (trois ondes et un point)
        g.lineWidth = mm(0.32);
        for (const r of [0.75, 1.45, 2.15]) {
          g.beginPath();
          g.arc(x, z + mm(1), mm(r), -PI * 0.75, -PI * 0.25);
          g.stroke();
        }
        g.beginPath();
        g.arc(x, z + mm(1), mm(0.3), 0, 2 * PI);
        g.fill();
      },
      13: (x, z) => { // F7 : l'écran externe (deux écrans)
        g.lineWidth = mm(0.3);
        g.strokeRect(x - mm(1.9), z - mm(1.1), mm(2.3), mm(1.6));
        g.strokeRect(x - mm(0.4), z - mm(0.4), mm(2.3), mm(1.6));
      },
      18: (x, z) => { // F12 : la mise en veille prolongée
        ecrire('z', x - mm(0.6), z + mm(1.1), { corps: 2.6, aligne: 'center' });
        ecrire('z', x + mm(0.7), z - mm(0.1), { corps: 1.9, aligne: 'center' });
      },
    };
    const soleil = (x, z, plus) => { // Origine / Fin : la luminosité de l'écran (+ / −)
      g.beginPath();
      g.arc(x, z, mm(0.75), 0, 2 * PI);
      g.fill();
      g.lineWidth = mm(0.28);
      for (let k = 0; k < 8; k++) {
        const a = (k * PI) / 4;
        g.beginPath();
        g.moveTo(x + Math.cos(a) * mm(1.15), z + Math.sin(a) * mm(1.15));
        g.lineTo(x + Math.cos(a) * mm(1.65), z + Math.sin(a) * mm(1.65));
        g.stroke();
      }
      ecrire(plus ? '+' : '−', x + mm(2.5), z, { corps: 2.6, aligne: 'center', ligne: 'middle' });
    };
    pictos[5] = (x, z) => soleil(x - mm(0.6), z, true);
    pictos[20] = (x, z) => soleil(x - mm(0.6), z, false);
    touches.forEach((t, i) => {
      const lg = legendes[i];
      if (!lg) return;
      const gx = (t.x - t.l / 2 - X0) * S; // le bord gauche du dessus de la touche
      const hz = (t.z - t.p / 2 - Z0) * S; // son bord haut (côté écran)
      const bz = (t.z + t.p / 2 - Z0) * S; // son bord bas
      const [cx, cz] = [(t.x - X0) * S, (t.z - Z0) * S];
      const large = t.l > 1.3 * U;
      g.fillStyle = g.strokeStyle = lg === 'Fn' ? BLEU : BLANC;
      if (Array.isArray(lg)) {
        // deux caractères à gauche : en haut avec Maj., en bas sans
        ecrire(lg[0], gx + mm(1.7), hz + mm(4.4), { corps: 3.5 });
        ecrire(lg[1], gx + mm(1.7), bz - mm(2), { corps: 3.5 });
      } else if (lg.length === 1 && /[A-Z²]/.test(lg)) {
        ecrire(lg, gx + mm(1.7), hz + mm(5.2), { corps: 4.6 });
      } else if (symbole.test(lg)) {
        if (large) ecrire(lg, gx + mm(2), cz, { corps: 4.6, ligne: 'middle' });
        else ecrire(lg, cx, cz, { corps: 4.2, aligne: 'center', ligne: 'middle' });
      } else if (pictos[i]) {
        // le nom de la touche à gauche, le pictogramme bleu à droite
        ecrire(lg, gx + mm(1.4), cz, { corps: lg.length > 2 ? 2.4 : 2.7, ligne: 'middle' });
        g.fillStyle = g.strokeStyle = BLEU;
        pictos[i](cx + t.l * S * 0.24, cz);
      } else {
        ecrire(lg, cx, cz, { corps: lg.length > 4 ? 2.3 : 2.7, aligne: 'center', ligne: 'middle' });
      }
    });
    // du texte détouré en transparence (pas d'alphaTest : il rongeait l'anticrénelage et ne laissait que des points de loin)
    const carte = new THREE.CanvasTexture(canvas);
    carte.colorSpace = THREE.SRGBColorSpace;
    carte.anisotropy = 16;
    const materiauLegendes = new THREE.MeshStandardMaterial({ map: carte, transparent: true, depthWrite: false, roughness: 0.55 });
    materiauLegendes.name = 'legendes-thinkpad';
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), materiauLegendes);
    plan.rotation.x = -PI / 2;
    plan.position.set((X0 + X1) / 2, yt + HT + 0.0004, (Z0 + Z1) / 2);
    plan.name = 'legendes-thinkpad';
    el.push(plan);
  }
  // le creux sombre sous les touches (on le voit entre elles)
  el.push(boite([15 * U + 0.004, 0.0003, zr + U - zClavier + 0.004], creux, [0, yd, (zClavier + zr + U) / 2], { r: 0.0015 }));
  el.push(boite([3 * wf * U + 0.004, 0.0003, 0.3 * U], creux, [xk(u + 1.5 * wf), yd, zr + 1.13 * U], { r: 0.0015 }));
  // le TrackPoint, entre G, H et B
  const xTP = xk(6.75);
  const zTP = debutRangee[3];
  el.push(cylindre(0.0068, HT + 0.0014, rouge, [xTP, yt, zTP], { segments: 14 }));
  el.push(sphere(0.0068, rouge, [xTP, yt + HT + 0.0014, zTP], { echelle: [1, 0.35, 1] }));

  // — le repose-mains —
  // les trois boutons du TrackPoint, dans leur creux : rayure rouge sur ceux des côtés, points sur celui du milieu
  const zBt = zr + U + 0.004;
  el.push(boite([0.076, 0.0003, 0.021], creux, [xTP, yd, zBt + 0.0095], { r: 0.003 }));
  let xb = xTP - (0.026 + 0.017 + 0.026 + 0.004) / 2;
  [0.026, 0.017, 0.026].forEach((w, k) => {
    const cx = xb + w / 2;
    el.push(boite([w, 0.0024, 0.015], touche, [cx, yd, zBt + 0.0025], { r: 0.0012 }));
    if (k !== 1) el.push(boite([w - 0.007, 0.0004, 0.0017], rouge, [cx, yd + 0.0024, zBt + 0.0025 + 0.0055], { r: 0.0006 }));
    else for (let d = 0; d < 6; d++) el.push(boite([0.0013, 0.0004, 0.0013], argent, [cx - 0.0045 + d * 0.0018, yd + 0.0024, zBt + 0.0045], { r: 0.0004 }));
    xb += w + 0.002;
  });
  // le lecteur d'empreintes et son témoin
  const xFP = 0.037;
  el.push(cylindre(0.0034, 0.0004, m.uni('#55536a'), [xFP, yd, zBt + 0.001], { segments: 12 }));
  el.push(boite([0.016, 0.0009, 0.0068], m.uni('#29272f'), [xFP, yd, zBt + 0.011], { r: 0.0015 }));
  el.push(boite([0.0105, 0.0004, 0.0016], m.uni('#9aa1ab'), [xFP, yd + 0.0009, zBt + 0.011], { r: 0.0005 }));
  // l'autocollant Intel Centrino, en bas à gauche
  el.push(boite([0.017, 0.0003, 0.021], m.uni('#eef1f4'), [-0.127, yd, D / 2 - 0.032], { r: 0.0015 }));
  el.push(boite([0.012, 0.0002, 0.006], m.uni('#3e74c4'), [-0.127, yd + 0.0003, D / 2 - 0.037], { r: 0.001 }));
  el.push(boite([0.012, 0.0002, 0.0035], m.uni('#d7a3ad'), [-0.127, yd + 0.0003, D / 2 - 0.027], { r: 0.0008 }));
  // le logo ThinkPad, en biais en bas à droite, avec le point rouge sur le « i »
  // les lettres argentées en italique (« ThinkPad », le « i » sans point), détourées ; le point rouge est un petit
  // carré posé au-dessus du « i » (lumineux sur le capot, comme sur le vrai X201)
  const [LW, LH] = [0.036, 0.0070];
  const lettres = (() => {
    const c = document.createElement('canvas');
    [c.width, c.height] = [512, 100];
    const g = c.getContext('2d');
    g.font = 'italic 700 76px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillStyle = '#e4e7ec';
    g.textBaseline = 'alphabetic';
    const y = 84;
    let x = 10;
    g.fillText('Th', x, y);
    x += g.measureText('Th').width;
    const wi = g.measureText('ı').width;
    g.fillText('ı', x, y);
    const point = [x + wi / 2 + 13, 22]; // (l'italique décale le haut du « i » vers la droite)
    x += wi;
    g.fillText('nkPad', x, y);
    const carte = new THREE.CanvasTexture(c);
    carte.colorSpace = THREE.SRGBColorSpace;
    carte.anisotropy = 8;
    const materiau = new THREE.MeshStandardMaterial({ map: carte, alphaTest: 0.4, roughness: 0.3, metalness: 0.5 });
    materiau.name = 'logo-thinkpad';
    return { materiau, point: [(point[0] / 512 - 0.5) * LW, (point[1] / 100 - 0.5) * LH] };
  })();
  const pointLumineux = mat('thinkpad-point-rouge', '#ff4a52', { emissive: '#ff2a36', emissiveIntensity: 1.4 });
  const logo = (y, { lumineux = false, retourne = false } = {}) => {
    const g = new THREE.Group();
    const dedans = new THREE.Group();
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), lettres.materiau);
    plan.rotation.x = -PI / 2;
    plan.position.y = 0.0006;
    dedans.add(plan);
    dedans.add(boite([0.0024, 0.0006, 0.0024], lumineux ? pointLumineux : rouge, [lettres.point[0], 0.0003, lettres.point[1]], { r: 0.0005 }));
    if (retourne) dedans.rotation.y = PI; // il se lit capot ouvert, depuis l'autre côté
    g.add(dedans);
    g.position.y = y;
    g.rotation.y = 0.85;
    return g;
  };
  const logoBase = logo(yd);
  logoBase.position.x = 0.104;
  logoBase.position.z = D / 2 - 0.046;
  el.push(logoBase);

  // — les flancs —
  const yc = PIEDS + HB / 2;
  const xg = -W / 2 - 0.0002;
  const xdr = W / 2 + 0.0002;
  for (let k = 0; k < 5; k++) el.push(boite([0.0006, 0.0013, 0.03], creux, [xg, yc - 0.0055 + k * 0.0026, -D / 2 + 0.07], { r: 0.0003 })); // grille du ventilateur
  el.push(boite([0.0006, 0.0048, 0.0125], creux, [xg, yc - 0.0024, -D / 2 + 0.11], { r: 0.0006 })); // USB
  for (const z of [0.05, 0.068]) el.push(boite([0.0006, 0.0048, 0.0125], creux, [xdr, yc - 0.0024, -D / 2 + z], { r: 0.0006 })); // USB
  // la fiche USB du câble du clavier, dans le premier port de droite : coque noire, languette métal
  const zU = -D / 2 + 0.05;
  el.push(boite([0.012, 0.0045, 0.012], m.metalClair, [xdr + 0.006, yc - 0.00225, zU], { r: 0.0006 }));
  el.push(boite([0.02, 0.008, 0.016], m.uni('#2a2832'), [xdr + 0.021, yc - 0.004, zU], { r: 0.002 }));
  el.push(cylindre(0.0045, 0.012, m.uni('#2a2832'), [xdr + 0.036, yc, zU], { rot: [0, 0, PI / 2], centre: true, dBas: 0.006, segments: 10 }));
  el.push(boite([0.0006, 0.011, 0.0145], creux, [xdr, yc - 0.0058, -D / 2 + 0.092], { r: 0.0008 })); // Ethernet
  el.push(cylindre(0.0036, 0.0008, creux, [xdr, yc, -D / 2 + 0.118], { rot: [0, 0, PI / 2], centre: true, segments: 10 })); // casque
  el.push(boite([0.0006, 0.0034, 0.034], creux, [xdr, yc - 0.0017, -D / 2 + 0.16], { r: 0.0005 })); // ExpressCard
  el.push(cylindre(0.0055, 0.0008, creux, [-0.118, yc, -D / 2 - 0.0002], { rot: [PI / 2, 0, 0], centre: true, segments: 12 })); // alimentation, au dos
  // la fiche VGA bleue branchée sur le flanc gauche : boîtier, deux vis, manchon
  const zV = -D / 2 + 0.032;
  const prise = m.uni('#6a86c6');
  el.push(boite([0.016, 0.0095, 0.02], prise, [-W / 2 - 0.008, yc - 0.00475, zV], { r: 0.0015 }));
  for (const s of [-1, 1]) el.push(cylindre(0.0038, 0.012, prise, [-W / 2 - 0.007, yc, zV + s * 0.0125], { rot: [0, 0, PI / 2], centre: true, segments: 10 }));
  el.push(cylindre(0.0058, 0.016, prise, [-W / 2 - 0.024, yc, zV], { rot: [0, 0, PI / 2], centre: true, dBas: 0.0072, segments: 12 }));

  // — les charnières, claires, et le capot —
  const yPivot = yd + HT + 0.0016;
  const zPivot = -D / 2 + 0.004;
  for (const s of [-1, 1]) el.push(cylindre(0.0095, 0.022, m.uni('#b9bec6'), [s * 0.124, yPivot, zPivot], { rot: [0, 0, PI / 2], centre: true, segments: 14 }));
  const capot = new THREE.Group();
  capot.name = 'pivot_ecran_thinkpad'; // fermé : 0 (posé sur le clavier) ; ouvert : −2,0 rad
  capot.position.set(0, yPivot, zPivot);
  capot.rotation.x = -2.0;
  const EPC = 0.0075;
  const PC = 0.205;
  capot.add(boite([W, EPC, PC], coque, [0, 0, PC / 2], { r: 0.003 }));
  // la face de l'écran (vers −y quand il est fermé) : le cadre, la dalle
  const zEcran = 0.024 + 0.163 / 2;
  capot.add(boite([0.266, 0.0004, 0.168], creux, [0, -0.0004, zEcran], { r: 0.0012 }));
  const dalle = new THREE.Mesh(new THREE.PlaneGeometry(0.261, 0.163), m.ecran);
  dalle.rotation.x = PI / 2;
  dalle.position.set(0, -0.0016, zEcran); // 1,2 mm devant le cadre noir : plus près, les deux scintillaient de loin
  dalle.name = ecran; // (le maillage sur lequel le programme colle le fond d'écran)
  capot.add(dalle);
  // en haut du cadre : les deux crochets et la ThinkLight
  for (const s of [-1, 1]) capot.add(boite([0.007, 0.0028, 0.0035], m.uni('#24222b'), [s * 0.066, -0.0028, PC - 0.009], { r: 0.0008 }));
  capot.add(boite([0.014, 0.0016, 0.004], m.uni('#55535f'), [0, -0.0016, PC - 0.007], { r: 0.0006 }));
  capot.add(boite([0.006, 0.0003, 0.0014], m.uni('#efe9da'), [0, -0.0019, PC - 0.0075], { r: 0.0004 }));
  // en bas du cadre : les témoins (un vert allumé), « lenovo », « X201i »
  for (let k = 0; k < 7; k++) capot.add(boite([0.0022, 0.0003, 0.0022], m.uni(k === 1 ? '#86d391' : '#8b8996'), [-0.032 + k * 0.0055, -0.0003, 0.012], { r: 0.0004 }));
  capot.add(boite([0.021, 0.0003, 0.0032], argent, [0.064, -0.0003, 0.012], { r: 0.0006 }));
  capot.add(boite([0.013, 0.0003, 0.003], argent, [0.116, -0.0003, 0.012], { r: 0.0006 }));
  // au dos du capot : le logo ThinkPad dans le coin, et « lenovo »
  const logoCapot = logo(EPC, { lumineux: true, retourne: true });
  logoCapot.position.x = 0.1;
  logoCapot.position.z = PC - 0.035;
  capot.add(logoCapot);
  capot.add(boite([0.024, 0.0003, 0.0036], m.uni('#5c5a69'), [-0.1, EPC, 0.025], { r: 0.0006 }));
  el.push(capot);

  return {
    groupe: groupe('objet_thinkpad', el), // tout le ThinkPad forme un objet à part : on peut cliquer dessus
    D,
    sortieVGA: new THREE.Vector3(-W / 2 - 0.032, yc, zV),
    dirVGA: new THREE.Vector3(-1, 0, 0),
    sortieUSB: new THREE.Vector3(W / 2 + 0.042, yc, -D / 2 + 0.05),
    dirUSB: new THREE.Vector3(1, 0, 0),
  };
}

// Surface de révolution à une seule face : elle regarde vers l'extérieur si le profil [rayon, hauteur] monte (du
// bas vers le haut), vers l'intérieur s'il descend. Contrairement à `tourne` (deux faces), pas de rayures d'ombre.
function revolution(profil, materiau, [x, y, z], segments = 40) {
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profil.map(([r, h]) => new THREE.Vector2(r, h)), segments), materiau);
  mesh.position.set(x, y, z);
  return ombres(mesh);
}

// Un prisme : un profil [z, y] (tracé dans le sens inverse des aiguilles d'une montre, vu depuis +x), étiré sur
// `longueur` le long de x, centré, aux arêtes adoucies (le biseau grossit le profil : le tracer en retrait).
function prisme(profil, longueur, materiau, biseau = 0.002) {
  const f = new THREE.Shape(profil.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(f, { depth: longueur - 2 * biseau, bevelEnabled: biseau > 0, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 2 });
  g.translate(0, 0, -(longueur - 2 * biseau) / 2);
  g.rotateY(-PI / 2); // le X du profil devient z, l'étirement devient x
  return ombres(new THREE.Mesh(g, materiau));
}

// ===========================================================================================
// --- Le tapis de souris (80 × 36,5 cm, taille estimée : tu ne me l'as pas donnée), avec ta pivoine noir et blanc ---
// Mousse noire de 4 mm, coins arrondis, bordure cousue ; l'image est collée par le programme sur le maillage
// « tapis-souris » (public/textures/tapis-souris.jpg), le haut de l'image du côté de l'écran (−z).
// Sert aussi au sous-main du bureau du studio : `image` = le nom du maillage de l'image, `objet` = celui du groupe
// (sa fiche au clic), `bord` = la couleur de la couture ; `auRas` : la mousse n'a pas de dessus, l'image EST la
// surface du tapis (à 4 mm) : rien ne peut scintiller avec elle, elle n'a pas besoin de polygonOffset, et ce qui est
// posé dessus ne risque pas d'être mordu par elle quand on la regarde de biais.
// ===========================================================================================
function tapisDeSouris(m, L, P, { image: nomImage = 'tapis-souris', objet = 'objet_tapis', bord = '#1b1a20', auRas = false } = {}) {
  const R = 0.011;
  const E = 0.004;
  const forme = rectArrondi(new THREE.Shape(), -L / 2, -P / 2, L / 2, P / 2, R);
  let mousse = new THREE.ExtrudeGeometry(forme, { depth: E, bevelEnabled: false, curveSegments: 6 });
  if (auRas) {
    // on ne garde que les flancs (le groupe 1 ; le groupe 0, ce sont le dessus et le dessous)
    const { start, count } = mousse.groups[1];
    const flancs = new THREE.BufferGeometry();
    for (const [nom, a] of Object.entries(mousse.attributes)) flancs.setAttribute(nom, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
    mousse = flancs;
  }
  mousse.rotateX(-PI / 2);
  const dessus = new THREE.ShapeGeometry(forme, 6);
  const uv = dessus.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + L / 2) / L, (uv.getY(i) + P / 2) / P);
  dessus.rotateX(-PI / 2);
  dessus.translate(0, auRas ? E : E + 0.0008, 0); // sinon 0,8 mm au-dessus de la mousse : plus près, l'image scintillait de loin
  const image = new THREE.Mesh(dessus, m.uni('#1d1b22'));
  image.name = nomImage;
  image.receiveShadow = true;
  const k = [1 - 0.0016 / L, 1 - 0.0016 / P];
  const pts = forme.getSpacedPoints(200).slice(0, -1).map((q) => new THREE.Vector3(q.x * k[0], E - 0.0001, -q.y * k[1]));
  const couture = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 260, 0.0013, 5, true);
  return groupe(objet, ombres(new THREE.Mesh(mousse, m.uni('#26242d'))), image, ombres(new THREE.Mesh(couture, m.uni(bord))));
}

// ===========================================================================================
// --- Le clavier MelGeek VIVA63 HE, coloris « Proto » (330 × 115 mm, 18,7 mm devant, pente de 7°) ---
// D'après la fiche et les photos MelGeek : boîtier transparent givré, touches noires au profil MCR, Échap et Entrée
// jaunes. Un 60 % avec flèches : 14, 14, 13 et 13 touches, puis Ctrl, Win, Alt, espace, Alt, Fn, ←, ↓, →. À
// droite, l'îlot noir : la molette crantée, deux petites touches, « VIVA63 », l'écran OLED tactile (« VIVA » en
// italique) et le bloc lumineux du coin. Dedans, vus à travers le boîtier : la plaque grise du fond, deux barrettes
// jaunes, la plaque des switchs et la bande RGB sur trois côtés. La prise USB-C est sur le flanc gauche, avec son
// câble branché. Origine : le centre du dessous ; on tape côté +z. Renvoie aussi le bout de la fiche USB-C.
// ===========================================================================================
function clavierViva(m) {
  const L = 0.33;
  const P = 0.115;
  const HAV = 0.0187; // hauteur à l'avant
  const A = (7 * PI) / 180;
  const HAR = HAV + P * Math.tan(A);
  const dessusA = (z) => HAV + (P / 2 - z) * Math.tan(A); // le dessus du boîtier à la profondeur z
  const transparent = new THREE.MeshStandardMaterial({ color: '#edf2f8', transparent: true, opacity: 0.4, roughness: 0.3, metalness: 0, depthWrite: false });
  transparent.name = 'boitier-transparent';
  const lueur = mat('lueur-rgb', '#d8e6ff', { emissive: '#cfe0ff', emissiveIntensity: 0.9 });
  const oled = mat('oled', '#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 });
  const noirTouche = m.uni('#2a2832');
  const jaune = m.uni('#f2c14e');
  const el = [];

  // le boîtier, en coin
  const b = 0.002;
  el.push(prisme([[P / 2 - b, b], [P / 2 - b, HAV - b], [-P / 2 + b, HAR - b], [-P / 2 + b, b]], L, transparent, b));
  // dedans : la plaque grise du fond, deux barrettes jaunes devant, la bande RGB (avant, gauche, droite)
  el.push(boite([L - 0.012, 0.003, P - 0.012], m.uni('#b4b8c2'), [0, 0.0025, 0], { r: 0.001 }));
  for (const x of [-0.125, -0.082]) el.push(boite([0.04, 0.0025, 0.004], jaune, [x, 0.0025, P / 2 - 0.008], { r: 0.0008 }));
  el.push(boite([L - 0.016, 0.003, 0.002], lueur, [0, 0.0075, P / 2 - 0.005], { r: 0 }));
  for (const s of [-1, 1]) el.push(boite([0.002, 0.003, P - 0.016], lueur, [s * (L / 2 - 0.005), 0.0085, 0], { r: 0 }));

  // le plan des touches, incliné comme le dessus : la plaque des switchs, puis les touches
  const U = 0.01905;
  const plan = new THREE.Group();
  plan.position.set(0, dessusA(0) + 0.0008, 0);
  plan.rotation.x = A;
  plan.add(boite([L - 0.014, 0.006, P - 0.014], m.uni('#2e2c36'), [0, -0.0078, 0], { r: 0.001 }));
  const x0 = -L / 2 + 0.0085;
  const zr = (r) => -P / 2 + 0.0098 + (r + 0.5) * U;
  const capuchons = new Map();
  const capuchon = (w, h) => {
    const cle = `${w}-${h}`;
    if (!capuchons.has(cle)) {
      const lg = w * U - 0.0012;
      const pr = U - 0.0012;
      const g = new THREE.BoxGeometry(lg, h, pr);
      g.translate(0, h / 2, 0);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) if (pos.getY(i) > h / 2) pos.setXYZ(i, (pos.getX(i) * (lg - 0.0046)) / lg, pos.getY(i), (pos.getZ(i) * (pr - 0.0042)) / pr);
      g.computeVertexNormals();
      capuchons.set(cle, g);
    }
    return capuchons.get(cle);
  };
  const hauteurs = [0.0105, 0.0095, 0.009, 0.0095, 0.0105]; // le profil MCR : rangées sculptées
  [
    [1, ...Array(12).fill(1), 2], // Échap (jaune), 1 … =, retour arrière
    [1.5, ...Array(12).fill(1), 1.5], // Tab … \
    [1.75, ...Array(11).fill(1), 2.25], // Verr. maj. … Entrée (jaune)
    [2.25, ...Array(10).fill(1), 1.75, 1], // Maj., Z … /, Maj., ↑
    [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1], // Ctrl, Win, Alt, espace, Alt, Fn, ←, ↓, →
  ].forEach((largeurs, r) => {
    let u = 0;
    largeurs.forEach((w, k) => {
      const estJaune = (r === 0 && k === 0) || (r === 2 && k === largeurs.length - 1);
      const t = ombres(new THREE.Mesh(capuchon(w, hauteurs[r]), estJaune ? jaune : noirTouche));
      t.position.set(x0 + (u + w / 2) * U, 0, zr(r));
      plan.add(t);
      u += w;
    });
  });
  // l'îlot de droite
  const xI = (x0 + 15 * U + L / 2 - 0.005) / 2;
  const lI = L / 2 - 0.005 - (x0 + 15 * U) - 0.002;
  plan.add(boite([lI, 0.0012, 5 * U], m.uni('#1d1b23'), [xI, -0.0006, zr(2)], { r: 0.0005 }));
  const zK = zr(0) + 0.002; // la molette crantée, son dessus et son repère
  plan.add(cylindre(0.021, 0.013, m.uni('#2a2832'), [xI, 0.0006, zK], { segments: 32 }));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * 2 * PI;
    plan.add(boite([0.0012, 0.011, 0.0012], m.uni('#3b3945'), [xI + 0.0105 * Math.cos(a), 0.0016, zK + 0.0105 * Math.sin(a)], { r: 0 }));
  }
  plan.add(cylindre(0.017, 0.0008, m.uni('#4a4856'), [xI, 0.0136, zK], { segments: 28 }));
  plan.add(boite([0.0012, 0.0004, 0.005], m.uni('#dedce6'), [xI, 0.0144, zK - 0.004], { r: 0 }));
  for (const s of [-1, 1]) plan.add(boite([0.0115, 0.006, 0.0075], noirTouche, [xI + s * 0.0068, 0, zr(1) + 0.002], { r: 0.001 })); // les deux petites touches
  plan.add(boite([0.012, 0.0003, 0.0018], m.uni('#9b99a8'), [xI, 0.0001, zr(2) - 0.004], { r: 0 })); // « VIVA63 »
  // l'écran OLED, avec « VIVA » en italique, écrit de bas en haut (le haut des lettres vers la gauche)
  const zS = zr(3) + 0.003;
  plan.add(boite([0.022, 0.0009, 0.03], m.uni('#0f0e13'), [xI, 0, zS], { r: 0.0003 }));
  const lettres = [
    [1, [[0, 1, 0.5, 0], [0.5, 0, 1, 1]]], // V
    [0.36, [[0.5, 0, 0.5, 1]]], // I
    [1, [[0, 1, 0.5, 0], [0.5, 0, 1, 1]]], // V
    [1, [[0, 0, 0.5, 1], [0.5, 1, 1, 0], [0.25, 0.45, 0.75, 0.45]]], // A
  ];
  let a0 = 0;
  const yT = 0.0011;
  const versEcran = (a, hb) => [xI + 0.0058 - hb * 0.0116, yT, zS + 0.0112 - (a + hb * 0.0012)]; // a : le long du texte, hb : de 0 (pied) à 1 (haut)
  for (const [w, traits] of lettres) {
    for (const [a1, b1, a2, b2] of traits) plan.add(barrePlate(versEcran(a0 + a1 * w * 0.0055, b1), versEcran(a0 + a2 * w * 0.0055, b2), [0.0011, 0.0003], oled, 0.0001));
    a0 += w * 0.0055 + 0.0012;
  }
  el.push(plan);
  // le bloc lumineux du coin avant droit, sous l'écran
  el.push(boite([0.026, 0.008, 0.01], lueur, [xI, 0.004, P / 2 - 0.009], { r: 0.001 }));
  // la prise USB-C du flanc gauche et la fiche du câble
  const zU = -0.02;
  const yU = 0.0085;
  el.push(boite([0.016, 0.0065, 0.011], m.uni('#2a2832'), [-L / 2 - 0.008, yU - 0.00325, zU], { r: 0.002 }));
  el.push(cylindre(0.0042, 0.012, m.uni('#2a2832'), [-L / 2 - 0.021, yU, zU], { rot: [0, 0, PI / 2], centre: true, dBas: 0.0056, segments: 10 }));
  return { groupe: groupe('objet_clavier', el), sortieUSB: new THREE.Vector3(-L / 2 - 0.027, yU, zU), dirUSB: new THREE.Vector3(-1, 0, 0) };
}

// ===========================================================================================
// --- La souris Logitech G PRO 2 LIGHTSPEED, noire (125 × 63,5 × 40 mm, 80 g) ---
// Symétrique et ambidextre : une coque en œuf, la bosse un peu en arrière, le dessous plat ; les deux grands
// boutons séparés par la gorge de la molette, la molette caoutchoutée et crantée, deux boutons latéraux côté
// pouce (gauche) et les caches lisses de l'autre côté (sans le logo G éclairé, retiré à ta demande). Sans fil
// (LIGHTSPEED) : pas de câble. Origine : le centre du dessous ; l'avant (les boutons) vers −z, vers l'écran.
// ===========================================================================================
function sourisGPro2(m) {
  const LS = 0.125;
  const WS = 0.0635;
  const HS = 0.04;
  const E = 0.004; // le dessous, à peine bombé
  const noir = m.uni('#2d2b37');
  const trait = m.uni('#18171d');
  // la surface : s de −1 (arrière) à 1 (avant), φ autour de l'axe (90° = le dessus, 0° = le flanc droit)
  const largeur = (s) => (WS / 2) * (1 - 0.1 * (s + 0.15) ** 2);
  const hauteur = (s) => HS * (1 - 0.38 * (s + 0.2) ** 2);
  const surface = (s, cx, cy) => {
    const r = Math.sqrt(Math.max(0, 1 - s * s));
    const R = Math.sqrt(r);
    const n = 2.6;
    const xs = Math.sign(cx) * Math.abs(cx) ** (2 / n);
    const ys = Math.sign(cy) * Math.abs(cy) ** (2 / n);
    const y = ys >= 0 ? ys * R * (hauteur(s) - E) : ys * R * E;
    return new THREE.Vector3(xs * R * largeur(s), y + E, -s * (LS / 2));
  };
  const enPoint = (s, phi) => surface(s, Math.cos(phi), Math.sin(phi));
  let geo = new THREE.SphereGeometry(1, 56, 36);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const r = Math.sqrt(x * x + y * y);
    const p = r > 1e-6 ? surface(z, x / r, y / r) : surface(z, 0, 1);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-6);
  // la coque est retournée (l'avant vers −z) : ses triangles regardaient vers l'intérieur et la souris semblait
  // invisible ; on les remet dans le bon sens
  const ind = geo.index.array;
  for (let i = 0; i < ind.length; i += 3) [ind[i + 1], ind[i + 2]] = [ind[i + 2], ind[i + 1]];
  geo.computeVertexNormals();
  const el = [ombres(new THREE.Mesh(geo, noir))];
  const sur = (s, phi, dh = 0.0003) => enPoint(s, phi).add(new THREE.Vector3(0, dh, 0));
  // la gorge de la molette et les bords des deux boutons, puis la ligne qui ferme les boutons à l'arrière
  const phiG = PI / 2 + 0.17;
  const phiD = PI / 2 - 0.17;
  for (const phi of [phiG, phiD]) el.push(tube(Array.from({ length: 9 }, (_, k) => sur(0.97 - k * 0.105, phi).toArray()), 0.0005, trait, 30));
  el.push(tube(Array.from({ length: 11 }, (_, k) => sur(0.1, 0.45 + (k / 10) * (PI - 0.9)).toArray()), 0.0005, trait, 30));
  // la molette : la fente, la roue caoutchoutée et ses crans
  const sM = 0.58;
  const haut = enPoint(sM, PI / 2);
  el.push(boite([0.0095, 0.004, 0.026], trait, [0, haut.y - 0.0035, haut.z], { r: 0.0015 }));
  const roue = new THREE.Group();
  roue.position.set(0, haut.y - 0.0062, haut.z);
  roue.add(cylindre(0.021, 0.0068, m.uni('#3a3846'), [0, 0, 0], { rot: [0, 0, PI / 2], centre: true, segments: 28 }));
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * 2 * PI;
    roue.add(boite([0.0066, 0.0009, 0.0012], m.uni('#24222b'), [0, 0.0103 * Math.cos(a) - 0.00045, 0.0103 * Math.sin(a)], { r: 0, rot: [a, 0, 0] }));
  }
  el.push(roue);
  // les deux boutons latéraux côté pouce (à gauche), les caches lisses à droite
  for (const [phi, rz, relief, couleur] of [[PI - 0.42, -0.42, 0.0013, '#3a3845'], [0.42, 0.42, 0.0004, '#302e3a']]) {
    for (const [s0, s1] of [[0.32, 0.12], [0.08, -0.14]]) {
      const c = enPoint((s0 + s1) / 2, phi);
      const dir = Math.sign(Math.cos(phi));
      el.push(boite([0.003, 0.0058, Math.abs(s0 - s1) * (LS / 2) - 0.002], m.uni(couleur), [c.x + dir * relief * 0.5, c.y - 0.0029, c.z], { r: 0.0012, rot: [0, 0, rz] }));
    }
  }
  return groupe('objet_souris', el);
}

// ===========================================================================================
// --- La lampe Artemide Tolomeo, version de table, posée sur le retour du bureau bas ---
// Tout en aluminium satiné : la base ronde légèrement bombée et son moyeu, le bras bas, l'articulation du coude
// que traverse le bras haut (avec sa queue et son embout à l'arrière), les deux ressorts d'équilibrage et leurs
// câbles d'acier tendus le long des bras, l'articulation de la tête, le diffuseur en cloche (réflecteur blanc
// dedans, douille), le petit bouton pour l'orienter, et le cordon qui file jusqu'à sa prise, au mur. Mesures : base Ø 23 cm
// (fiche produit) ; bras bas 48 cm et bras haut 77 cm (tirés des 129 cm de hauteur maximale annoncés) ;
// diffuseur Ø 16 × 11,5 cm (estimé, à l'œil : nettement plus petit que la base). Posée : le bras bas penche un peu en arrière, le bras haut monte de 16° et
// amène la tête au-dessus du ThinkPad et du clavier.
// Origine : le centre de la base ; la hauteur du retour (34 cm) est comprise dans le modèle ; le bras part vers +z.
// La position de l'ampoule (pour la lumière, dans chambre.js) se déduit de TOLOMEO.
// ===========================================================================================
export const TOLOMEO = { yBase: 0.34, pivot: 0.045, LA: 0.48, LB: 0.77, queue: 0.11, alpha: -0.2, beta: 0.28, suspente: 0.03, hDiff: 0.115, rDiff: 0.08 };
function tolomeo() {
  const m = creerMateriaux();
  const alu = m.uni('#d5dbe0');
  const aluFonce = m.uni('#b7bec6');
  const acier = m.uni('#9ea6af');
  const { yBase: Y, pivot, LA, LB, queue, alpha, beta, suspente, hDiff, rDiff } = TOLOMEO;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const el = [];
  // la base et son moyeu, l'articulation du pied et sa molette de serrage
  el.push(revolution([[0, 0], [0.105, 0], [0.113, 0.001], [0.115, 0.006], [0.113, 0.012], [0.1, 0.014], [0.03, 0.02], [0, 0.02]], alu, [0, Y, 0], 56));
  el.push(cylindre(0.034, 0.026, aluFonce, [0, Y + 0.018, 0], { segments: 20 }));
  el.push(cylindre(0.024, 0.032, alu, [0, Y + pivot, 0], { rot: [0, 0, PI / 2], centre: true, segments: 18 }));
  el.push(cylindre(0.016, 0.008, aluFonce, [0.02, Y + pivot, 0], { rot: [0, 0, PI / 2], centre: true, segments: 14 }));
  // les deux bras
  const dA = V(0, Math.cos(alpha), Math.sin(alpha));
  const dB = V(0, Math.sin(beta), Math.cos(beta));
  const nA = V(0, -Math.sin(alpha), Math.cos(alpha)); // perpendiculaire au bras bas, vers l'avant
  const nB = V(0, Math.cos(beta), -Math.sin(beta)); // perpendiculaire au bras haut, vers le haut
  const P0 = V(0, Y + pivot, 0);
  const P1 = P0.clone().addScaledVector(dA, LA); // le coude
  const P2 = P1.clone().addScaledVector(dB, LB); // la tête
  const T0 = P1.clone().addScaledVector(dB, -queue); // le bout de la queue
  el.push(barre(P0.toArray(), P1.toArray(), 0.0065, alu, 14));
  el.push(barre(T0.toArray(), P2.toArray(), 0.006, alu, 14));
  el.push(cylindre(0.03, 0.028, alu, P1.toArray(), { rot: [0, 0, PI / 2], centre: true, segments: 20 }));
  el.push(cylindre(0.012, 0.03, aluFonce, P1.toArray(), { rot: [0, 0, PI / 2], centre: true, segments: 12 }));
  el.push(barre(T0.toArray(), T0.clone().addScaledVector(dB, -0.012).toArray(), 0.0085, aluFonce, 14)); // l'embout de la queue
  // les ressorts d'équilibrage (une hélice d'acier) et leurs câbles
  const ressort = (a, b, axeN) => {
    const pts = [];
    const tours = 13;
    for (let i = 0; i <= tours * 12; i++) {
      const t = i / (tours * 12);
      const ang = t * tours * 2 * PI;
      pts.push(a.clone().lerp(b, t).add(V(0.0045 * Math.cos(ang), 0, 0)).addScaledVector(axeN, 0.0045 * Math.sin(ang)));
    }
    return ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), tours * 12, 0.0009, 5, false), acier));
  };
  const rA0 = P0.clone().addScaledVector(dA, 0.03).addScaledVector(nA, -0.017);
  const rA1 = P0.clone().addScaledVector(dA, 0.1).addScaledVector(nA, -0.017);
  el.push(ressort(rA0, rA1, nA), barre(rA1.toArray(), P1.clone().addScaledVector(nA, -0.012).toArray(), 0.0007, acier, 5));
  el.push(barre(rA0.toArray(), P0.clone().addScaledVector(nA, -0.01).toArray(), 0.0012, acier, 5));
  const rB0 = P1.clone().addScaledVector(dB, -0.028).addScaledVector(nB, -0.016);
  const rB1 = P1.clone().addScaledVector(dB, -0.092).addScaledVector(nB, -0.016);
  el.push(ressort(rB0, rB1, nB), barre(rB1.toArray(), T0.clone().addScaledVector(nB, -0.006).toArray(), 0.0012, acier, 5));
  el.push(barre(rB0.toArray(), P2.clone().addScaledVector(nB, -0.011).toArray(), 0.0007, acier, 5)); // le câble sous le bras haut
  // la tête : l'articulation, la suspente, le diffuseur en cloche (réflecteur blanc dedans), la douille, le bouton
  el.push(cylindre(0.02, 0.026, alu, P2.toArray(), { rot: [0, 0, PI / 2], centre: true, segments: 16 }));
  const yD = P2.y - suspente;
  el.push(barre(P2.toArray(), [P2.x, yD + 0.004, P2.z], 0.004, aluFonce, 8));
  // le profil, du haut vers le bord (en proportion de la cloche) : à l'extérieur on le parcourt du bord vers le haut
  // (faces vers l'extérieur), au-dedans du haut vers le bord (faces vers l'intérieur, le réflecteur blanc)
  const profil = [[0.14, 0], [0.33, -0.035], [0.54, -0.12], [0.72, -0.3], [0.87, -0.57], [0.96, -0.84], [1, -1]].map(([r, h]) => [r * rDiff, h * hDiff]);
  el.push(revolution([[rDiff - 0.002, -hDiff - 0.001], ...profil.slice().reverse()], alu, [P2.x, yD, P2.z], 48));
  el.push(revolution(profil.map(([r, h]) => [r * 0.965, h - 0.0015]), m.uni('#f6f3ee'), [P2.x, yD, P2.z], 48));
  el.push(sphere(0.024, alu, [P2.x, yD, P2.z], { echelle: [1, 0.45, 1] }));
  el.push(cylindre(0.026, 0.035, m.uni('#ebe8e2'), [P2.x, yD - 0.045, P2.z], { segments: 16 }));
  const bouton = V(P2.x, yD - 0.012, P2.z - 0.04);
  el.push(barre([P2.x, yD - 0.02, P2.z - 0.034], bouton.toArray(), 0.0028, aluFonce, 8), sphere(0.012, alu, bouton.toArray()));
  // le cordon : il sort de la base, file vers le mur et tombe derrière le retour
  // (il descend entre le retour et le mur jusqu'aux tatamis ; la suite, jusqu'à sa fiche sur la multiprise, est dans
  // branchements ; les coordonnées tiennent compte de la pose de la lampe et des tatamis)
  el.push(tube([[0.098, Y + 0.004, -0.035], [0.15, Y + 0.0025, -0.06], [0.198, Y + 0.0015, -0.072], [0.222, Y - 0.03, -0.076], [0.227, 0.2, -0.0785], [0.226, 0.05, -0.075], [0.2244, 0.0045, -0.0704]], 0.0025, m.uni('#3b3946'), 50));
  return groupe('tolomeo', el);
}

// ===========================================================================================
// --- Les photocards éparpillées dans le coin du bureau bas, tirées du Season's Greetings 2027 de NMIXX ---
// Trois photocards polaroid (54 × 86 mm : cadre blanc, photo 46 × 62 mm, marge plus épaisse en bas) et la
// photocard classique (55 × 85 mm aux coins arrondis, l'image sur toute la carte), posée sur le bois. Chaque image est un
// maillage nommé (« photocard-… ») : le programme y colle son image (public/textures/pc-*.jpg). Le haut des images
// est côté écran (−z). Coordonnées : celles du bureau ; `yTapis` = le dessus du tapis, `yBureau` = celui du bureau.
// ===========================================================================================
function photocards(m, yTapis, yBureau) {
  const EP = 0.0007; // l'épaisseur d'une carte
  const g = new THREE.Group();
  g.name = 'objet_photocards'; // un objet à part : on peut cliquer dessus
  const image = (nom, l, p, dz, y) => {
    const geo = new THREE.PlaneGeometry(l, p);
    geo.rotateX(-PI / 2);
    const mesh = new THREE.Mesh(geo, m.uni('#d8d2cc'));
    mesh.name = nom;
    mesh.position.set(0, y, dz);
    mesh.receiveShadow = true;
    return mesh;
  };
  // Les cartes et leurs images sont des maillages nommés : le programme leur donne une priorité d'affichage
  // (« carte-… » passe devant l'image du tapis, « photocard-… » devant la carte), sinon elles scintillent de loin.
  const carte = ({ type, nom, x, z, y, rot }) => {
    const c = new THREE.Group();
    c.position.set(x, y, z);
    c.rotation.y = rot;
    if (type === 'polaroid') {
      c.add(boite([0.054, EP, 0.086], m.uni('#f8f7f3'), [0, 0, 0], { r: 0, nom: `carte-${nom}` }));
      c.add(image(`photocard-${nom}`, 0.046, 0.062, -0.006, EP + 0.0003));
    } else {
      // la photocard : 55 × 85 mm aux coins arrondis (3,5 mm), l'image sur toute la carte
      const [L, P, R] = [0.055, 0.085, 0.0035];
      const forme = rectArrondi(new THREE.Shape(), -L / 2, -P / 2, L / 2, P / 2, R);
      const corps = new THREE.ExtrudeGeometry(forme, { depth: EP, bevelEnabled: false, curveSegments: 5 });
      corps.rotateX(-PI / 2);
      const mc = new THREE.Mesh(corps, m.uni('#efe9e4'));
      mc.name = `carte-${nom}`;
      mc.castShadow = true;
      mc.receiveShadow = true;
      const dessus = new THREE.ShapeGeometry(forme, 5);
      const uv = dessus.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + L / 2) / L, (uv.getY(i) + P / 2) / P);
      dessus.rotateX(-PI / 2);
      dessus.translate(0, EP + 0.0003, 0);
      const mi = new THREE.Mesh(dessus, m.uni('#d8d2cc'));
      mi.name = `photocard-${nom}`;
      mi.receiveShadow = true;
      c.add(mc, mi);
    }
    g.add(c);
  };
  // sur le tapis : 1,5 mm au-dessus de son image ; sur le bois : 1 mm au-dessus de ses veines
  yTapis += 0.0015;
  yBureau += 0.001;
  carte({ type: 'polaroid', nom: 'pola2', x: 0.505, z: -0.03, y: yTapis, rot: 0.55 });
  carte({ type: 'polaroid', nom: 'pola1', x: 0.47, z: -0.005, y: yTapis + 0.0012, rot: 0.22 });
  carte({ type: 'polaroid', nom: 'pola3', x: 0.44, z: -0.13, y: yBureau, rot: 0.12 }); // sur le bois, au-delà du tapis
  carte({ type: 'photocard', nom: 'carte', x: 0.53, z: -0.13, y: yBureau, rot: -0.25 }); // sur le bois, à côté
  return g;
}

// ===========================================================================================
// --- La structure en bois des bureaux bas (le bureau et son retour d'angle), dans le chêne clair du sommier et de
// la commode. Un plateau de lames collées (de fines rainures entre elles, chacune d'un ton un peu différent), ses
// veines et ses nœuds en géométrie ; quatre pieds fins à patins, une ceinture sous le plateau, des traverses
// basses sur les côtés et à l'arrière (les jambes passent devant). Le devant est côté +z.
//   L, P, T : longueur (x), profondeur (z), hauteur du dessus ; ep : épaisseur du plateau ; lames : leur nombre ;
//   noeuds : [x, z, angle, taille] ; graine : le tirage des veines (le même à chaque export)
// ===========================================================================================
const CHENE = {
  tons: ['#e5c393', '#dfbb89', '#e8c99b', '#dcb886', '#e3c08f'],
  veinesSombres: ['#cda372', '#d3ab7c'],
  veinesClaires: ['#f1dcb7'],
  noeud: ['#c99e6c', '#b48a5b'],
  pieds: '#d8b483',
  veinesPieds: ['#c49a69', '#e6c799'],
};
//   solAvant : de combien le sol est plus haut sous les pieds de devant (+z) : ils sont d'autant plus courts
function structureBois(m, { L, P, T, ep = 0.028, lames = 5, noeuds = [], graine = 11, solAvant = 0 }) {
  const parts = [];
  const sombres = CHENE.veinesSombres.map((c) => m.uni(c));
  const claires = CHENE.veinesClaires.map((c) => m.uni(c));
  const ll = P / lames; // largeur d'une lame
  for (let k = 0; k < lames; k++) {
    const z = -P / 2 + ll / 2 + k * ll;
    const face = { centre: [0, T, z], u: [1, 0, 0], v: [0, 0, -1], U: L / 2 - 0.01, V: ll / 2 - 0.006 };
    parts.push(boite([L, ep, ll], m.uni(CHENE.tons[(k + graine) % CHENE.tons.length]), [0, T - ep, z], { r: 0.0025 }));
    parts.push(...veines({ ...face, nb: 3, materiaux: sombres, graine: graine + k }));
    parts.push(...veines({ ...face, nb: 1, materiaux: claires, graine: graine + 20 + k }));
  }
  // le chant avant, et ses veines
  parts.push(...veines({ centre: [0, T - ep / 2, P / 2], u: [1, 0, 0], v: [0, 1, 0], U: L / 2 - 0.01, V: ep / 2 - 0.005, nb: 2, materiaux: sombres, graine: graine + 30 }));
  for (const [x, z, a, s] of noeuds) {
    const noeud = new THREE.CircleGeometry(0.013 * s, 18);
    noeud.scale(1.8, 1, 1);
    noeud.rotateZ(a);
    noeud.rotateX(-PI / 2);
    const coeurNoeud = noeud.clone().scale(0.45, 1, 0.45);
    noeud.translate(x, T + 0.0006, z);
    coeurNoeud.translate(x, T + 0.0009, z);
    parts.push(new THREE.Mesh(noeud, m.uni(CHENE.noeud[0])), new THREE.Mesh(coeurNoeud, m.uni(CHENE.noeud[1])));
  }
  const bois = m.uni(CHENE.pieds);
  const veinesPieds = CHENE.veinesPieds.map((c) => m.uni(c));
  const px = L / 2 - 0.06;
  const pz = P / 2 - 0.055;
  const hp = T - ep - 0.006; // hauteur d'un pied
  let g = graine + 40;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const sol = sz > 0 ? solAvant : 0;
      const h = hp - sol;
      parts.push(boite([0.042, h, 0.042], bois, [sx * px, 0.006 + sol, sz * pz], { r: 0.004 }));
      parts.push(cylindre(0.034, 0.006, m.uni('#d8d0c4'), [sx * px, sol, sz * pz], { segments: 10 })); // patin
      // des veines sur les quatre faces du pied, dans le sens du fil (vertical)
      const yMilieu = 0.006 + sol + h / 2;
      for (const [n, v] of [[[1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, -1]], [[0, 0, 1], [-1, 0, 0]], [[0, 0, -1], [1, 0, 0]]]) {
        const centre = [sx * px + n[0] * 0.021, yMilieu, sz * pz + n[2] * 0.021];
        parts.push(...veines({ centre, u: [0, 1, 0], v, U: h / 2 - 0.01, V: 0.017, nb: 2, materiaux: veinesPieds, graine: g++ }));
      }
    }
  }
  const hc = 0.055; // la ceinture
  const yc = T - ep - hc / 2;
  for (const sz of [-1, 1]) {
    parts.push(boite([2 * px - 0.04, hc, 0.018], bois, [0, T - ep - hc, sz * pz], { r: 0.003 }));
    parts.push(...veines({ centre: [0, yc, sz * (pz + 0.009)], u: [1, 0, 0], v: [0, sz, 0], U: px - 0.025, V: hc / 2 - 0.006, nb: 2, materiaux: veinesPieds, graine: g++ }));
  }
  for (const sx of [-1, 1]) {
    parts.push(boite([0.018, hc, 2 * pz - 0.04], bois, [sx * px, T - ep - hc, 0], { r: 0.003 }));
    parts.push(...veines({ centre: [sx * (px + 0.009), yc, 0], u: [0, 0, 1], v: [0, -sx, 0], U: pz - 0.025, V: hc / 2 - 0.006, nb: 2, materiaux: veinesPieds, graine: g++ }));
  }
  for (const sx of [-1, 1]) parts.push(boite([0.026, 0.03, 2 * pz - 0.04], bois, [sx * px, 0.085, 0], { r: 0.004 }));
  parts.push(boite([2 * px - 0.04, 0.03, 0.026], bois, [0, 0.085, -pz], { r: 0.004 }));
  return parts;
}

// ===========================================================================================
// --- Bureau bas, à la japonaise (120 × 60 cm, dessus à 44 cm du sol), d'après tes photos d'inspiration ---
// La structure en chêne clair (voir structureBois), et un écran 27 pouces sur un bras articulé : pince sur le bord
// arrière, mât, deux bras (le second avec son vérin), rotule VESA. Le dos (−z) va contre le mur, à 3 cm (la place
// de la pince) ; on s'assoit côté +z. L'écran affiche la capture du site, comme le MacBook (maillage « ecran-mac »).
// ===========================================================================================
function bureauBas() {
  const m = creerMateriaux();
  const noir = m.uni('#3d3b4c');
  const noirMat = m.uni('#2e2c3a');
  const [L, P, T] = [1.2, 0.6, 0.44]; // longueur (x), profondeur (z), hauteur du dessus
  const ep = 0.028; // épaisseur du plateau
  const parts = structureBois(m, { L, P, T, ep, lames: 5, noeuds: [[-0.31, -0.04, 0.2, 1], [0.42, 0.17, -0.15, 0.8]], graine: 11 });

  // --- le bras d'écran : le mât à droite, le bras tendu vers l'écran ---
  const xM = 0.12; // le centre de l'écran, décalé vers la droite (le ThinkPad est à sa gauche)
  const bx = 0.5; // le mât, à droite de l'écran quand on est assis
  const bz = -P / 2 + 0.045;
  const yCol = T + 0.2; // le collier qui porte le bras
  parts.push(
    boite([0.07, 0.012, 0.085], noir, [bx, T, bz + 0.0025], { r: 0.004 }), // semelle de la pince, sur le plateau
    boite([0.07, ep + 0.06, 0.014], noir, [bx, T - ep - 0.048, -P / 2 - 0.008], { r: 0.004 }), // dos de la pince, derrière le chant
    boite([0.07, 0.012, 0.075], noir, [bx, T - ep - 0.048, bz - 0.006], { r: 0.004 }), // mâchoire du dessous
    cylindre(0.012, 0.034, m.metalFonce, [bx, T - ep - 0.082, bz - 0.006], { segments: 8 }), // vis de serrage
    cylindre(0.042, 0.012, noirMat, [bx, T - ep - 0.094, bz - 0.006], { segments: 16 }), // molette
    cylindre(0.034, 0.36, noir, [bx, T + 0.012, bz], { segments: 18 }), // mât
    cylindre(0.037, 0.01, noirMat, [bx, T + 0.372, bz], { segments: 18 }), // bouchon
    cylindre(0.052, 0.05, noirMat, [bx, yCol, bz], { segments: 18 }), // collier
  );
  const coude = [0.27, yCol + 0.025, -0.255];
  const tete = [xM, T + 0.3, -0.172];
  parts.push(
    barrePlate([bx, yCol + 0.025, bz], coude, [0.045, 0.03], noir), // premier bras, à plat
    cylindre(0.05, 0.05, noirMat, [coude[0], coude[1] - 0.025, coude[2]], { segments: 16 }), // le coude
    barrePlate(coude, tete, [0.042, 0.034], noir), // second bras, qui monte vers l'écran
    barrePlate([coude[0] - 0.012, coude[1] - 0.03, coude[2] + 0.008], [tete[0] + 0.025, tete[1] - 0.045, tete[2] - 0.01], [0.016, 0.016], m.metalFonce, 0.006), // son vérin
    cylindre(0.04, 0.05, noirMat, [tete[0], tete[1] - 0.025, tete[2]], { segments: 16 }), // rotule
  );

  // --- l'écran 27 pouces : bords fins, menton un peu plus haut, coque arrière bombée, plaque VESA ---
  const [EW, EH, EE] = [0.615, 0.366, 0.012];
  const yE = T + 0.3; // centre de l'écran
  const zE = -0.13;
  const zCoque = zE - EE / 2 - 0.014; // le milieu de la coque arrière
  parts.push(
    boite([EW, EH, EE], m.uni('#2b2a36'), [xM, yE - EH / 2, zE], { r: 0.004 }),
    boite([0.44, 0.26, 0.028], m.uni('#3d3b4c'), [xM, yE - 0.14, zCoque], { r: 0.012 }), // coque arrière
    boite([0.1, 0.1, 0.01], noirMat, [xM, yE - 0.05, zE - 0.036], { r: 0.003 }), // plaque VESA
    boite([0.03, 0.008, 0.004], m.uni('#8e8ba0'), [xM, yE - EH / 2 + 0.004, zE + EE / 2], { r: 0.001 }), // le logo du menton
  );
  // la dalle : le programme y colle le fond d'écran (maillage repéré par son nom)
  const dalle = new THREE.Mesh(new THREE.PlaneGeometry(EW - 0.014, EH - 0.03), m.ecran);
  dalle.name = 'ecran-moniteur';
  dalle.position.set(xM, yE + 0.006, zE + EE / 2 + 0.0015);
  dalle.receiveShadow = true;
  parts.push(dalle);

  // --- le ThinkPad X201i, à gauche de l'écran, ouvert sur son support incliné (comme sur ta 2e photo) ---
  // Le support : deux rails sous la base, deux pieds à l'arrière, une butée à l'avant ; la base penche de 15°
  // vers toi. Le tout est tourné un peu vers le siège.
  const alu = m.metal;
  const support = new THREE.Group();
  support.position.set(-0.36, T, 0.02);
  support.rotation.y = 0.15;
  const theta = 0.26;
  const { groupe: tp, D: DT, sortieVGA, dirVGA, sortieUSB: usbTP, dirUSB: dirUsbTP } = thinkpad(m);
  const zButee = 0.118;
  const incl = new THREE.Group(); // la base inclinée : son bord avant, dessous, repose contre la butée à 1,6 cm du plateau
  incl.rotation.x = theta;
  incl.position.set(0, 0.016 + Math.sin(theta) * (DT / 2), zButee - Math.cos(theta) * (DT / 2));
  incl.add(tp);
  for (const s of [-1, 1]) incl.add(boite([0.014, 0.004, DT - 0.03], alu, [s * 0.105, -0.004, -0.005], { r: 0.0015 })); // les rails
  incl.updateMatrix();
  const versSupport = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(incl.matrix);
  support.add(incl);
  for (const s of [-1, 1]) {
    const arriere = versSupport(s * 0.105, -0.004, -DT / 2 + 0.022);
    const avant = versSupport(s * 0.105, -0.004, DT / 2 - 0.025);
    support.add(
      boite([0.014, arriere.y, 0.012], alu, [arriere.x, 0, arriere.z], { r: 0.002 }), // pied arrière
      boite([0.014, avant.y, 0.01], alu, [avant.x, 0, avant.z], { r: 0.002 }), // pied avant
      boite([0.014, 0.004, zButee - arriere.z + 0.008], alu, [s * 0.105, 0, (arriere.z + zButee) / 2 + 0.004], { r: 0.0015 }), // longeron au sol
    );
    if (s === 1) support.add(boite([0.224, 0.004, 0.012], alu, [0, 0, arriere.z], { r: 0.0015 })); // traverse arrière
  }
  support.add(
    boite([0.24, 0.024, 0.008], alu, [0, 0, zButee + 0.004], { r: 0.003 }), // la butée avant
    boite([0.236, 0.003, 0.008], noirMat, [0, 0.024, zButee + 0.004], { r: 0.0012 }), // son caoutchouc
  );
  parts.push(support);

  // --- le câble VGA : de la prise bleue du ThinkPad (flanc gauche), derrière lui, jusque sous l'écran ---
  support.updateMatrixWorld(true);
  const depart = sortieVGA.clone().applyMatrix4(tp.matrixWorld);
  const sortie = dirVGA.clone().transformDirection(tp.matrixWorld);
  const arriere = new THREE.Vector3(0, 0, -1).transformDirection(tp.matrixWorld).setY(0).normalize(); // vers le dos du ThinkPad
  const xP = xM - 0.12; // la prise de l'écran, sous la coque arrière
  const yP = yE - 0.14;
  const prise = m.uni('#6a86c6');
  parts.push(
    boite([0.02, 0.016, 0.0095], prise, [xP, yP - 0.016, zCoque], { r: 0.0015 }), // la fiche, branchée par-dessous
    cylindre(0.0072, 0.016, prise, [xP, yP - 0.032, zCoque], { dBas: 0.0058, segments: 12 }), // le manchon
  );
  for (const s of [-1, 1]) parts.push(cylindre(0.0038, 0.012, prise, [xP + s * 0.0125, yP - 0.014, zCoque], { segments: 10 })); // les vis
  const trajet = [
    depart,
    depart.clone().addScaledVector(sortie, 0.01),
    depart.clone().addScaledVector(sortie, 0.018).addScaledVector(arriere, 0.02).setY(T + 0.018),
    depart.clone().addScaledVector(sortie, 0.02).addScaledVector(arriere, 0.065).setY(T + 0.004),
    new THREE.Vector3(-0.38, T + 0.0035, -0.21),
    new THREE.Vector3(-0.15, T + 0.0035, -0.215),
    new THREE.Vector3(xP - 0.02, T + 0.012, zCoque - 0.04),
    new THREE.Vector3(xP, T + 0.08, zCoque - 0.01),
    new THREE.Vector3(xP, yP - 0.032, zCoque),
  ];
  parts.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trajet), 110, 0.0028, 7), m.uni('#2c2a35'))));

  // --- les périphériques, sur le tapis de souris : le clavier devant l'écran, la souris à sa droite ---
  const [LT, PT] = [0.8, 0.365];
  const tapis = tapisDeSouris(m, LT, PT);
  const xT = 0.59 - LT / 2; // le bord droit du tapis à 1 cm du bout du bureau, le gauche juste à droite du ThinkPad
  const zT = P / 2 - 0.01 - PT / 2; // le bord avant à 1 cm du bord du bureau
  tapis.position.set(xT, T, zT);
  parts.push(tapis);
  const ySurTapis = T + 0.0048; // le dessus imprimé du tapis
  const { groupe: clavier, sortieUSB, dirUSB } = clavierViva(m);
  clavier.position.set(0.1, ySurTapis, 0.135);
  parts.push(clavier);
  const souris = sourisGPro2(m);
  souris.position.set(0.384, ySurTapis, 0.137); // sur la grande feuille blanche du tapis : la souris noire s'y détache
  souris.rotation.y = 0.06;
  parts.push(souris);
  parts.push(photocards(m, ySurTapis, T)); // dans le coin en haut à droite du tapis, une sur le bureau
  // le câble du clavier : de sa prise USB-C (flanc gauche) au port USB du flanc droit du ThinkPad
  const finClavier = sortieUSB.clone().add(clavier.position);
  const finTP = usbTP.clone().applyMatrix4(tp.matrixWorld);
  const versTP = dirUsbTP.clone().transformDirection(tp.matrixWorld);
  const surBureau = (x, z, r = 0.0022) => new THREE.Vector3(x, (x > xT - LT / 2 && z > zT - PT / 2 ? ySurTapis : T) + r, z);
  const trajetUSB = [
    finTP,
    finTP.clone().addScaledVector(versTP, 0.015).add(new THREE.Vector3(0, -0.006, 0)),
    surBureau(finTP.x + 0.03, finTP.z + 0.02),
    surBureau((finTP.x + finClavier.x) / 2, Math.max(finTP.z, finClavier.z) + 0.04),
    surBureau(finClavier.x - 0.03, finClavier.z + 0.01),
    finClavier.clone().addScaledVector(dirUSB, 0.012),
    finClavier,
  ];
  // la courbe passe par ces points mais peut plonger entre eux : on la relève partout au-dessus du tapis et du bureau
  const posee = new THREE.CatmullRomCurve3(trajetUSB).getSpacedPoints(90).map((q) => {
    q.y = Math.max(q.y, surBureau(q.x, q.z, 0.0022 + 0.0004).y);
    return q;
  });
  parts.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(posee), 120, 0.0022, 6), m.uni('#2c2a35'))));

  return groupe('bureau-bas', parts);
}

// ===========================================================================================
// --- Le retour d'angle du bureau bas : une plaque plus basse (dessus à 34 cm, 10 cm sous le bureau), à angle droit
// avec lui, entre son bout et le coffre de la TV. Elle part du mur et avance 10 cm plus loin que le bureau dans la
// pièce (70 × 39 cm). Même chêne, même construction (trois lames). Le devant (+z) regarde le siège.
// ===========================================================================================
function bureauRetour() {
  const m = creerMateriaux();
  return groupe('bureau-retour', structureBois(m, { L: 0.7, P: 0.39, T: 0.34, ep: 0.026, lames: 3, noeuds: [[0.17, 0.04, 0.5, 0.8]], graine: 13 }));
}

// ===========================================================================================
// --- Siège au sol (zaisu), d'après tes photos : coque noire à plat, poignée percée à l'arrière, coussin noir,
// dossier inclinable en maille grise (bas plein avec le logo), charnières sur les côtés, accoudoirs en boucle ---
// Face vers +z (on regarde le bureau), le dossier incliné de 14° vers l'arrière.
// ===========================================================================================
function chaiseSol() {
  const m = creerMateriaux();
  const plastique = m.uni('#363443');
  const coussin = mat('coussin', '#4a4858', { roughness: 0.95 });
  const maille = mat('maille', '#a6a3b4', { roughness: 0.95 });
  const parts = [];

  // la coque : un plateau aux angles ronds (le devant vers +z), prolongé derrière par la poignée percée
  const extruder = (forme, epaisseur, y) => {
    const g = new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(-PI / 2); // la forme se couche : son y devient −z, l'épaisseur monte
    g.translate(0, y + 0.006, 0);
    return ombres(new THREE.Mesh(g, plastique));
  };
  parts.push(extruder(rectArrondi(new THREE.Shape(), -0.255, -0.29, 0.255, 0.24, 0.07), 0.024, 0));
  const queue = rectArrondi(new THREE.Shape(), -0.15, 0.16, 0.15, 0.41, 0.07);
  queue.holes.push(rectArrondi(new THREE.Path(), -0.08, 0.32, 0.08, 0.365, 0.022));
  parts.push(extruder(queue, 0.016, 0.004));

  // le coussin, et un passepoil le long du devant
  parts.push(tissu([0.47, 0.085, 0.5], coussin, [0, 0.03, 0.04], { r: 0.036, froissement: 0.003, graine: 2 }));

  // les charnières du dossier, de chaque côté
  const pivot = [0, 0.09, -0.19];
  for (const s of [-1, 1]) {
    parts.push(cylindre(0.085, 0.03, plastique, [s * 0.252, pivot[1], pivot[2]], { rot: [0, 0, PI / 2], centre: true, segments: 18 }));
    parts.push(cylindre(0.04, 0.034, m.metalFonce, [s * 0.252, pivot[1], pivot[2]], { rot: [0, 0, PI / 2], centre: true, segments: 12 }));
  }

  // --- le dossier, construit droit puis incliné autour des charnières ---
  const dossier = new THREE.Group();
  const bombe = (x) => 0.07 * (x / 0.25) ** 2; // les côtés s'avancent un peu, il enveloppe le dos
  const cles = [[-0.205, 0.02], [-0.225, 0.32], [-0.245, 0.58], [-0.2, 0.635], [0, 0.65], [0.2, 0.635], [0.245, 0.58], [0.225, 0.32], [0.205, 0.02], [0, 0.006]];
  const cadre = new THREE.CatmullRomCurve3(cles.map(([x, y]) => new THREE.Vector3(x, y, bombe(x))), true, 'centripetal');
  dossier.add(ombres(new THREE.Mesh(new THREE.TubeGeometry(cadre, 90, 0.017, 8, true), plastique)));
  // la toile tendue dans le cadre : une grille qui suit sa courbure, ligne par ligne d'un bord à l'autre. Elle a
  // deux faces (une vers l'avant, une vers le dos, 1,2 mm derrière) : on la voit de devant comme de derrière.
  const bords = cadre.getSpacedPoints(500);
  const largeurA = (y) => {
    let [x0, x1] = [Infinity, -Infinity];
    for (const p of bords) if (Math.abs(p.y - y) < 0.006) [x0, x1] = [Math.min(x0, p.x), Math.max(x1, p.x)];
    return [x0, x1];
  };
  const toile = (y0, y1, materiau, decalage) => {
    const [nu, nv] = [14, 10];
    const pos = [];
    const idx = [];
    for (let j = 0; j <= nv; j++) {
      const y = y0 + ((y1 - y0) * j) / nv;
      const [x0, x1] = largeurA(y);
      for (let i = 0; i <= nu; i++) {
        const x = x0 + ((x1 - x0) * i) / nu;
        pos.push(x, y, bombe(x) + decalage);
      }
    }
    const n = pos.length / 3;
    for (let k = 0; k < n; k++) pos.push(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2] - 0.0012); // la face du dos
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i;
        idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1); // devant
        const b = a + n;
        idx.push(b, b + nu + 1, b + 1, b + 1, b + nu + 1, b + nu + 2); // dos : sens inverse
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return ombres(new THREE.Mesh(g, materiau));
  };
  dossier.add(toile(0.15, 0.638, maille, -0.003)); // la maille
  dossier.add(toile(0.016, 0.16, plastique, -0.006)); // le bas, plein
  // des lignes à peine plus foncées dans la maille, qui suivent sa courbe (le tissage), sur ses deux faces
  for (let k = 1; k < 9; k++) {
    const y = 0.15 + k * 0.054;
    const [x0, x1] = largeurA(y);
    for (const dz of [0.0005, -0.0067]) {
      const pts = Array.from({ length: 9 }, (_, i) => {
        const x = x0 + 0.012 + ((x1 - x0 - 0.024) * i) / 8;
        return [x, y, bombe(x) + dz];
      });
      dossier.add(tube(pts, 0.0016, m.uni('#9592a4'), 16));
    }
  }
  dossier.add(boite([0.07, 0.02, 0.004], m.uni('#d9d6e2'), [0, 0.07, bombe(0) - 0.012], { r: 0.001 })); // le logo, au dos
  dossier.position.set(...pivot);
  dossier.rotation.x = -0.25;
  parts.push(dossier);

  // les accoudoirs : une boucle qui part de la charnière, porte une manchette et redescend sur la coque
  for (const s of [-1, 1]) {
    const x = s * 0.272;
    parts.push(tube([[s * 0.255, 0.12, -0.18], [x, 0.26, -0.13], [x, 0.3, -0.04], [x, 0.29, 0.1], [x, 0.2, 0.17], [s * 0.262, 0.04, 0.18]], 0.014, plastique, 30));
    parts.push(boite([0.05, 0.024, 0.2], m.uni('#2c2a37'), [x, 0.295, 0.02], { r: 0.01, rot: [0.04, 0, 0] }));
  }

  return groupe('chaise-sol', parts);
}

// ===========================================================================================
// --- Une grande tasse de matcha latte (Ø 9,5 × 11 cm), posée sur le retour, devant la Tolomeo ---
// Céramique vert matcha à lèvre arrondie, anse en D, le latte vert pâle aux trois quarts et une paille en papier
// blanche à rayure verte en spirale, penchée contre le bord.
// Origine : le centre du dessous ; posée sur la serviette, elle-même sur le retour : sa hauteur (34,25 cm) est comprise
// dans le modèle, comme pour la lampe.
// ===========================================================================================
function tasse() {
  const m = creerMateriaux();
  const Y = 0.3425; // le dessus de la serviette
  const matcha = mat('ceramique-matcha', '#c2d9a6', { roughness: 0.7 });
  const latte = mat('matcha-latte', '#d4e3b9', { roughness: 0.6 });
  const R = 0.0475;
  const H = 0.11;
  const ep = 0.0045; // épaisseur de la paroi
  const el = [];
  // la tasse, d'un seul profil : le dessous, la paroi qui monte, la lèvre arrondie, l'intérieur qui redescend
  el.push(revolution([[0, 0], [R - 0.006, 0], [R - 0.002, 0.003], [R, 0.012], [R, H - 0.004], [R - 0.0008, H - 0.001], [R - ep / 2, H], [R - ep + 0.0008, H - 0.001], [R - ep, H - 0.004], [R - ep, 0.014], [R - ep - 0.006, 0.009], [0, 0.008]], matcha, [0, Y, 0], 48));
  // l'anse en D, sur le côté +x
  const anse = [[R - 0.002, 0.086], [R + 0.018, 0.088], [R + 0.03, 0.075], [R + 0.031, 0.045], [R + 0.02, 0.031], [R - 0.002, 0.03]].map(([x, y]) => [x, Y + y, 0]);
  el.push(tube(anse, 0.0055, matcha, 30));
  // le latte, aux trois quarts
  const surface = new THREE.CircleGeometry(R - ep - 0.0003, 40);
  surface.rotateX(-PI / 2);
  surface.translate(0, Y + 0.084, 0);
  el.push(ombres(new THREE.Mesh(surface, latte)));
  // la paille, du fond jusqu'à 7 cm au-dessus du bord, appuyée de l'autre côté (côté −x)
  const pied = V3(0.016, Y + 0.012, 0.01);
  const appui = V3(-(R - ep - 0.006), Y + H, 0.014);
  const dirP = appui.clone().sub(pied).normalize();
  const tete = pied.clone().addScaledVector(dirP, 0.2);
  const rP = 0.0035;
  el.push(barre(pied.toArray(), tete.toArray(), rP, m.uni('#f5f2ea'), 16));
  const trou = new THREE.CircleGeometry(rP - 0.0007, 14);
  trou.lookAt(dirP);
  trou.translate(...tete.clone().addScaledVector(dirP, 0.0002).toArray());
  el.push(new THREE.Mesh(trou, m.uni('#7f8a73')));
  // sa rayure en spirale
  const e1 = new THREE.Vector3(0, 1, 0).cross(dirP).normalize();
  const e2 = dirP.clone().cross(e1);
  const spirale = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const a = t * 26 * PI;
    spirale.push(pied.clone().addScaledVector(dirP, t * 0.2).addScaledVector(e1, (rP + 0.0002) * Math.cos(a)).addScaledVector(e2, (rP + 0.0002) * Math.sin(a)).toArray());
  }
  el.push(tube(spirale, 0.0007, m.uni('#8fb27a'), 320));
  return groupe('tasse', el);
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ===========================================================================================
// --- La serviette (« hand towel », 20 × 20 cm) du Season's Greetings 2027 de TWICE « Spotless », sous la tasse ---
// Un carré d'éponge aux coins arrondis, à peine froissé (à plat sous la tasse), son imprimé tiré de ta planche
// (public/textures/serviette-twice.jpg, collé par le programme sur le maillage « imprime-serviette ») : neuf cases
// vert pomme et rose avec les petites mascottes. Le biais rose tout autour, la boucle rose cousue dans un coin (elle
// retombe sur la serviette) et la petite étiquette rose sur un bord. Envers blanc.
// Origine : le centre de la serviette, sur le retour (34 cm, compris dans le modèle) ; tournée par `rotation`.
// ===========================================================================================
function serviette() {
  const m = creerMateriaux();
  const C = 0.2;
  const R = 0.022; // l'arrondi des coins
  const Y0 = 0.3404; // le dessous (juste au-dessus des veines du retour)
  const EP = 0.0021; // l'épaisseur : le dessus est à 0,3425, là où se pose la tasse
  const TASSE = [-0.005, 0.0]; // le pied de la tasse, dans ce repère : à plat dessous
  const rose = m.uni('#f39cc4');
  // un point du bord du carré arrondi (projection d'un point sur le contour)
  const dansCarre = (x, z) => {
    const h = C / 2 - R;
    const qx = Math.abs(x) - h;
    const qz = Math.abs(z) - h;
    if (qx > 0 && qz > 0) {
      const d = Math.hypot(qx, qz);
      if (d > R) return [Math.sign(x) * (h + (qx / d) * R), Math.sign(z) * (h + (qz / d) * R)];
    }
    return [Math.max(-C / 2, Math.min(C / 2, x)), Math.max(-C / 2, Math.min(C / 2, z))];
  };
  const froisse = (x, z) => {
    const loin = Math.min(1, Math.max(0, (Math.hypot(x - TASSE[0], z - TASSE[1]) - 0.055) / 0.03));
    return loin * 0.0011 * (Math.sin(x * 61 + 1.3) * Math.sin(z * 47 + 0.4) + 0.6 * Math.sin((x + z) * 83));
  };
  const n = 36;
  const dessus = new THREE.PlaneGeometry(C, C, n, n);
  dessus.rotateX(-PI / 2);
  const pos = dessus.attributes.position;
  const uv = dessus.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const [x, z] = dansCarre(pos.getX(i), pos.getZ(i));
    pos.setXYZ(i, x, Y0 + EP + froisse(x, z), z);
    uv.setXY(i, (x + C / 2) / C, 1 - (z + C / 2) / C); // le haut de l'image vers −z
  }
  dessus.computeVertexNormals();
  const imprime = new THREE.Mesh(dessus, m.uni('#f2c9dc'));
  imprime.name = 'imprime-serviette'; // pas « serviette » : c'est le nom du modèle (le chargeur renommerait le doublon)
  imprime.castShadow = true;
  imprime.receiveShadow = true;
  // l'envers et la tranche d'éponge
  const forme = rectArrondi(new THREE.Shape(), -C / 2, -C / 2, C / 2, C / 2, R);
  const corps = new THREE.ExtrudeGeometry(forme, { depth: EP - 0.0003, bevelEnabled: false, curveSegments: 8 });
  corps.rotateX(-PI / 2);
  corps.translate(0, Y0, 0);
  const el = [imprime, ombres(new THREE.Mesh(corps, m.uni('#f6f2f4')))];
  // le biais rose tout autour, posé sur le bord
  const contour = forme.getSpacedPoints(160).slice(0, -1).map((q) => new THREE.Vector3(q.x * 0.995, Y0 + EP * 0.6 + froisse(q.x, -q.y), -q.y * 0.995));
  el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(contour, true), 220, 0.0017, 6, true), rose)));
  // la boucle, cousue dans le coin (−x, −z), retombée sur la serviette
  const c0 = [-C / 2 + 0.008, Y0 + EP + 0.0008, -C / 2 + 0.008];
  el.push(tube([c0, [c0[0] + 0.02, c0[1] + 0.003, c0[2] + 0.008], [c0[0] + 0.045, c0[1] + 0.0028, c0[2] + 0.03], [c0[0] + 0.035, c0[1] + 0.0022, c0[2] + 0.045], [c0[0] + 0.012, c0[1] + 0.0016, c0[2] + 0.024], [c0[0] + 0.002, c0[1] + 0.0006, c0[2] + 0.004]], 0.0018, rose, 40));
  // l'étiquette rose sur le bord +x, et son petit logo
  el.push(boite([0.012, 0.0008, 0.022], rose, [C / 2 + 0.004, Y0 + 0.0005, 0.035], { r: 0 }));
  el.push(boite([0.006, 0.0002, 0.008], m.uni('#fde7f1'), [C / 2 + 0.005, Y0 + 0.0013, 0.035], { r: 0 }));
  return groupe('serviette', el);
}

// ===========================================================================================
// --- Les prises : une prise murale française (plaque blanche, puits rond) avec sa fiche branchée ---
// Origine : le centre de la plaque, sur le mur ; elle regarde vers +z. Le câble sort du dos de la fiche, en bas.
// `double` : une plaque de deux prises côte à côte (puits en x = ±PAS_PRISE), une fiche dans chacune.
// ===========================================================================================
const PAS_PRISE = 0.036;
function prise(m, { double = false } = {}) {
  const fiche = m.uni('#3b3946');
  const el = [boite([double ? 0.152 : 0.08, 0.08, 0.009], m.uni('#f6f4f0'), [0, -0.04, 0.0045], { r: 0.006 })]; // la plaque
  for (const x of double ? [-PAS_PRISE, PAS_PRISE] : [0]) {
    el.push(
      cylindre(0.046, 0.002, m.uni('#e8e5df'), [x, 0, 0.009], { rot: [PI / 2, 0, 0], centre: true, segments: 28 }), // le puits
      cylindre(0.037, 0.022, fiche, [x, 0, 0.021], { rot: [PI / 2, 0, 0], centre: true, segments: 24 }), // la fiche
      cylindre(0.031, 0.006, fiche, [x, 0, 0.034], { rot: [PI / 2, 0, 0], centre: true, segments: 24 }),
      ...[0, 1, 2, 3, 4, 5].map((k) => boite([0.0025, 0.016, 0.018], fiche, [x + 0.0175 * Math.cos((k * PI) / 3), 0.0175 * Math.sin((k * PI) / 3) - 0.008, 0.021], { r: 0, rot: [0, 0, (k * PI) / 3 + PI / 2] })), // les nervures de prise en main
      cylindre(0.011, 0.012, fiche, [x, -0.012, 0.036], { segments: 12 }), // le manchon du câble
    );
  }
  return el;
}

// ===========================================================================================
// --- Les branchements de la chambre de rêve : des prises murales à 12 cm du sol (assez bas pour rester dans
// la bordure quand les murs s’abaissent) et les câbles qui y mènent : le lampadaire (mur est), le ventilateur (le
// mur ouest, sur la multiprise derrière lui), la Tolomeo (sur la même multiprise) ; dans le studio, la prise double
// du coin NAS (le mini-rack et le Macintosh Plus) et le câble série qui relie le Mac au Raspberry Pi du rack.
// Tout est en coordonnées de la pièce (le meuble est posé en [0, 0]).
// ===========================================================================================
function branchements() {
  const m = creerMateriaux();
  const el = [];
  const poser = ([x, y, z], rotY, options) => {
    const g = new THREE.Group();
    g.add(...prise(m, options));
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    el.push(g);
  };
  poser([3.6, 0.12, 0.51], -PI / 2); // mur est, entre le lampadaire et la commode
  poser([0, 0.12, 2.23], PI / 2); // mur ouest, derrière le ventilateur (la multiprise)
  const cable = (pts, r = 0.004) => el.push(tube(pts, r, m.noirMat, 60));
  // le lampadaire : son câble arrive au pied du mur est (en 3,6 ; 0,5), il remonte dans la fiche
  cable([[3.578, 0.02, 0.49], [3.586, 0.02, 0.5], [3.584, 0.035, 0.507], [3.575, 0.07, 0.51], [3.566, 0.098, 0.51], [3.564, 0.106, 0.51]]); // (posé sur les tatamis)
  // la multiprise blanche, posée au pied du mur ouest derrière le ventilateur, bien en vue : quatre prises sur le
  // dessus, l'interrupteur lumineux au bout ; son câble remonte dans la prise murale à côté. La Tolomeo et le
  // ventilateur y sont branchés, leurs câbles sortent vers la pièce.
  const [xM, z0, z1, yT] = [0.036, 1.835, 2.135, 0];
  const yH = yT + 0.038;
  const fiche = m.uni('#3b3946');
  el.push(boite([0.055, 0.038, z1 - z0], m.uni('#f6f4f0'), [xM, yT, (z0 + z1) / 2], { r: 0.008 }));
  el.push(boite([0.026, 0.007, 0.018], mat('voyant-multiprise', '#f6a160', { emissive: '#f08a4b', emissiveIntensity: 0.8 }), [xM, yH - 0.002, z1 - 0.02], { r: 0.003 }));
  for (const [z, branche] of [[1.875, true], [1.94, false], [2.005, false], [2.07, true]]) {
    el.push(cylindre(0.041, 0.0015, m.uni('#e8e5df'), [xM, yH - 0.0012, z], { segments: 24 })); // le puits
    if (branche) {
      // la fiche, debout dans la prise, son câble qui part vers la pièce (+x)
      el.push(cylindre(0.037, 0.026, fiche, [xM, yH, z], { segments: 24 }));
      el.push(cylindre(0.031, 0.005, fiche, [xM, yH + 0.026, z], { segments: 24 }));
      el.push(cylindre(0.011, 0.014, fiche, [xM + 0.025, yH + 0.017, z], { rot: [0, 0, PI / 2], centre: true, segments: 12 }));
    } else {
      for (const dz of [-0.0095, 0.0095]) el.push(cylindre(0.0048, 0.0004, m.uni('#5c5a66'), [xM, yH + 0.0003, z + dz], { segments: 10 }));
      el.push(cylindre(0.0048, 0.004, m.uni('#c9ccd0'), [xM - 0.0125, yH + 0.0003, z], { segments: 10 })); // la broche de terre
    }
  }
  // son câble, du bout de la multiprise à la prise murale juste à côté
  cable([[xM, yT + 0.02, z1 + 0.001], [xM, 0.03, z1 + 0.035], [0.037, 0.07, 2.21], [0.036, 0.106, 2.23]], 0.0035);
  // la Tolomeo : son cordon arrive au pied du mur derrière le retour, longe le mur sur les tatamis, descend sur le
  // parquet et rejoint sa fiche par l'avant
  el.push(tube([[0.025, 0.0165, 1.52], [0.026, 0.0168, 1.6], [0.03, 0.0168, 1.7], [0.04, 0.0168, 1.745], [0.055, 0.004, 1.775], [0.075, 0.003, 1.82], [0.082, 0.004, 1.86], [0.078, 0.025, 1.875], [0.061, yH + 0.017, 1.875]], 0.0025, m.uni('#3b3946'), 60));
  // le ventilateur : son câble passe par-dessus son pied (dans son modèle), retombe au sol et rejoint sa fiche par l'avant
  cable([[0.074, 0.006, 2.0716], [0.069, 0.03, 2.071], [0.061, yH + 0.017, 2.07]]);

  // la TV : son cordon descend derrière le coffre en osier (dans son modèle) jusqu'au sol, en (0,106 ; 3,132) ; une
  // prise au mur ouest juste derrière, sous l'entrait de la charpente
  poser([0, 0.12, 3.13], PI / 2);
  cable([[0.106, 0.004, 3.132], [0.08, 0.004, 3.131], [0.052, 0.01, 3.13], [0.04, 0.05, 3.13], [0.037, 0.09, 3.13], [0.036, 0.108, 3.13]], 0.0032);

  // — le coin NAS du studio : une prise double au mur ouest, sous l'entrait de la charpente, là où était le
  // monstera. Le mini-rack (le cordon de sa multiprise sort de son dos, en bas) et le Macintosh Plus (sa fiche
  // secteur au dos) y sont branchés ; leurs câbles courent au sol, derrière et à côté du rack, bien en vue. Le Mac
  // est relié au Raspberry Pi du rack par un câble série couleur platine : il lui sert de terminal. Les points
  // d'attache suivent la pose des deux meubles (agencementReve, src/chambre.js).
  const ZP = -3.0; // le centre de la prise double, sur le mur ouest
  poser([0, 0.12, ZP], PI / 2, { double: true });
  // (tournée vers la pièce, la fiche de gauche est au sud, celle de droite au nord ; leurs manchons en x = 3,6 cm)
  const [zSud, zNord] = [ZP + PAS_PRISE, ZP - PAS_PRISE];
  const repere = (nom) => {
    const { pos: [px, pz], rotation: a = 0 } = agencementReve.nouveaux.find((n) => n.nom === nom);
    const g = new THREE.Group();
    g.position.set(px, 0, pz);
    g.rotation.y = a;
    el.push(g);
    return { g, p: (x, y, z) => V3(x, y, z).applyAxisAngle(V3(0, 1, 0), a).add(V3(px, 0, pz)) };
  };
  // un câble posé : la courbe passe par ses points, relevée partout au-dessus du sol (sinon elle y plonge entre deux)
  const poserCable = (pts, r, materiau) => {
    const posee = new THREE.CatmullRomCurve3(pts).getSpacedPoints(160).map((q) => {
      q.y = Math.max(q.y, r + 0.0006);
      return q;
    });
    el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(posee), 260, r, 6), materiau)));
  };
  const rack = repere('mini-rack NAS');
  const mac = repere('Macintosh Plus');
  // le rack : le cordon sort de sa multiprise (en bas, au dos), descend derrière lui et file vers la prise du sud
  rack.g.add(cylindre(0.012, 0.016, fiche, [-0.07, 0.046, -0.13], { rot: [PI / 2, 0, 0], centre: true, segments: 12 }));
  poserCable([rack.p(-0.07, 0.046, -0.135), rack.p(-0.07, 0.042, -0.155), rack.p(-0.073, 0.02, -0.175), rack.p(-0.08, 0, -0.195), V3(0.4, 0, -3.07), V3(0.16, 0, -2.99), V3(0.075, 0, zSud - 0.002), V3(0.046, 0.02, zSud), V3(0.037, 0.07, zSud), V3(0.036, 0.108, zSud)], 0.0035, m.noirMat);
  // le Mac : la fiche secteur enfoncée dans sa prise, au dos ; le cordon descend, passe derrière le rack et rejoint
  // la prise du nord
  const [xS, yS] = MAC_DOS.secteur;
  const zD = MAC_DOS.z;
  mac.g.add(boite([0.03, 0.021, 0.03], fiche, [xS, yS - 0.0105, zD - 0.015], { r: 0.003 }));
  mac.g.add(cylindre(0.012, 0.018, fiche, [xS, yS, zD - 0.038], { rot: [PI / 2, 0, 0], centre: true, segments: 12 }));
  poserCable([mac.p(xS, yS, zD - 0.045), mac.p(xS, yS - 0.006, zD - 0.07), mac.p(xS - 0.005, 0.04, zD - 0.092), mac.p(xS - 0.01, 0, zD - 0.105), mac.p(-0.05, 0, zD - 0.112), V3(0.8, 0, -3.27), V3(0.45, 0, -3.26), V3(0.16, 0, -3.13), V3(0.075, 0, zNord - 0.002), V3(0.046, 0.02, zNord), V3(0.037, 0.07, zNord), V3(0.036, 0.108, zNord)], 0.0032, m.noirMat);
  // le câble série : sa fiche mini-DIN 8 dans la prise modem du Mac ; à l'autre bout, une fiche USB (l'adaptateur
  // série est dedans) enfoncée dans le flanc droit du Raspberry Pi. Il descend le long du rack, dans l'espace entre
  // lui et le Mac, et passe au sol derrière le Mac.
  const platine = mat('cable-platine', '#cfc8b6', { roughness: 0.55 });
  const [xMo, yMo] = MAC_DOS.modem;
  mac.g.add(cylindre(0.011, 0.016, platine, [xMo, yMo, zD - 0.008], { rot: [PI / 2, 0, 0], centre: true, segments: 14 }));
  mac.g.add(cylindre(0.0065, 0.012, platine, [xMo, yMo, zD - 0.022], { rot: [PI / 2, 0, 0], centre: true, segments: 10 }));
  const yPi = 0.3557; // le milieu du boîtier du Raspberry Pi (voir rackNas)
  rack.g.add(boite([0.026, 0.009, 0.016], platine, [0.129, yPi - 0.0045, 0.03], { r: 0.002 }));
  poserCable([rack.p(0.141, yPi, 0.03), rack.p(0.151, yPi - 0.012, 0.028), rack.p(0.155, 0.26, 0.015), rack.p(0.155, 0.12, -0.02), rack.p(0.153, 0.03, -0.05), rack.p(0.15, 0, -0.085), mac.p(-0.1, 0, zD - 0.035), mac.p(-0.03, 0, zD - 0.04), mac.p(xMo - 0.015, 0, zD - 0.04), mac.p(xMo, 0.02, zD - 0.032), mac.p(xMo, yMo, zD - 0.028)], 0.0024, platine);
  return groupe('branchements', el);
}

// Le dos du Macintosh Plus (voir macPlus, repère du Mac) : le centre de la prise modem et de la prise secteur, et la
// face arrière où elles affleurent
const MAC_DOS = { modem: [0.0749, 0.0439], secteur: [0.0648, 0.0975], z: -0.1384 };

// Un coussin d'assise : un pavé épais aux arêtes arrondies (les côtés restent assez droits, comme un vrai coussin
// garni de plumes), un peu gonflé sur le dessus, froissé (posé par son dessous).
function coussinAssise([l, h, p], materiau, [x, yBas, z], graine) {
  const c = tissu([l, h, p], materiau, [0, 0, 0], { r: h * 0.3, froissement: 0.018, graine, divisions: [30, 6, 22] });
  const pos = c.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [vx, vy, vz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const gonfle = (1 - Math.min(1, Math.abs(vx) / (l / 2)) ** 4) * (1 - Math.min(1, Math.abs(vz) / (p / 2)) ** 4);
    const creux = vy > 0 ? 0.012 * Math.sin(vx * 8.5 + graine) * Math.sin(vz * 7.3 + 2 * graine) + 0.006 * Math.sin(vx * 23 + vz * 17 + graine) : 0;
    pos.setY(i, vy + ((vy > 0 ? 0.02 : 0.003) * (vy / (h / 2)) + creux) * gonfle);
  }
  c.geometry.computeVertexNormals();
  c.position.set(x, yBas + h / 2, z);
  return c;
}

// Un coussin capitonné (les dossiers en cuir noir) : un coussin carré, épais et plat au milieu, qui s'arrondit
// vers sa couture tout autour (un passepoil la souligne) ; les coins pincés, les bords à peine creusés entre eux ;
// un bouton au centre de chaque face, qui creuse un capiton d'où partent quelques plis. Construit couché : l en
// largeur (x), h en épaisseur (y), p en hauteur (z), centré sur l'origine.
function coussinCapitonne([l, h, p], materiau, bouton, graine) {
  const geo = new THREE.BoxGeometry(l, h, p, 30, 6, 26);
  const pos = geo.attributes.position;
  const lisse = (a, b, t) => {
    const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const tire = (n) => 1 - 0.035 * (1 - n * n); // les bords se creusent un peu entre les coins
  for (let i = 0; i < pos.count; i++) {
    const [vx, vy, vz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const nx = Math.min(1, Math.abs(vx) / (l / 2));
    const nz = Math.min(1, Math.abs(vz) / (p / 2));
    // l'épaisseur : pleine au milieu, elle tombe sur les 25 % du bord jusqu'à la couture ; les coins plus pincés
    const d = (nx ** 6 + nz ** 6) ** (1 / 6);
    let t = Math.sqrt(Math.max(0, 1 - 0.8 * lisse(0.55, 1.02, d))) * (1 - 0.22 * nx * nx * nz * nz);
    t *= 1 + 0.16 * (1 - (nx * nx + nz * nz) / 2); // bombé, moelleux
    const r = Math.hypot(vx, vz);
    const capiton = 0.5 * Math.exp(-((r / 0.06) ** 2));
    const plis = 0.007 * Math.sin(4 * Math.atan2(vz, vx) + graine) * Math.exp(-r / 0.12) * Math.min(1, r / 0.03);
    const ride = 0.0012 * Math.sin(vx * 31 + graine) * Math.sin(vz * 27 + 2 * graine);
    // le haut (z > 0) s'affaisse un peu au milieu, sous son propre poids
    const affaisse = vz > 0 ? 0.016 * (1 - nx * nx) * nz ** 3 : 0;
    pos.setXYZ(i, vx * tire(nz), vy * t * (1 - capiton) + Math.sign(vy) * (plis + ride), vz * tire(nx) - affaisse);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(ombres(new THREE.Mesh(geo, materiau)));
  // le passepoil : un cordon de cuir sur la couture, tout autour
  const tour = [];
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * 2 * PI;
    const [c, sn] = [Math.cos(a), Math.sin(a)];
    // un rectangle aux coins arrondis, parcouru par son angle
    const ex = Math.sign(c) * Math.abs(c) ** 0.18;
    const ez = Math.sign(sn) * Math.abs(sn) ** 0.18;
    const x = (ex * l) / 2;
    const z = (ez * p) / 2;
    const affaisse = z > 0 ? 0.016 * (1 - ex * ex) * Math.abs(ez) ** 3 : 0;
    tour.push(new THREE.Vector3(x * tire(Math.abs(ez)), 0, z * tire(Math.abs(ex)) - affaisse));
  }
  g.add(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tour, true), 128, 0.0055, 6, true), materiau)));
  for (const s of [-1, 1]) g.add(sphere(0.024, bouton, [0, s * (h / 2) * 0.66, 0], { echelle: [1, 0.45, 1] }));
  return g;
}

// ===========================================================================================
// --- Le coin salon du studio, d'après ta photo d'inspiration : un seul meuble en chêne, profond de 66 cm ---
// À gauche, le meuble à vinyles (92 × 75 cm, sur quatre fins pieds de métal) : une haute case en bas, pleine de
// vinyles et de magazines debout (tranches surtout blanches, grises et noires, quelques couleurs), une case plus
// basse au-dessus (une pile de magazines à plat, une petite boîte blanche, un boîtier noir au fond) ; son dessus
// est libre (les objets copiés de la photo ont été retirés, en attendant de savoir ce qu'on y pose). À droite, le banc-canapé (177 cm) : son plateau épais part du flanc du meuble, qui lui sert
// d'accoudoir gauche, et finit contre une haute joue à la hauteur du meuble ; il a ses propres pieds. Dessus :
// deux gros coussins d'assise blancs, gonflés et froissés, qui débordent un peu devant ; deux coussins de dossier
// noirs capitonnés, penchés contre le mur (sans oreillers aux bouts, retirés à ta demande).
// Origine : au pied du mur, à la jonction du meuble et du banc ; le meuble vers −x, le banc vers +x, le mur en
// z = 0, la pièce vers +z. Le bois reçoit ses veines (veinerBois).
// ===========================================================================================
function coinSalon() {
  const m = creerMateriaux();
  const el = [];
  const alea = hasard(21);
  const blanc = m.uni('#f4f2ee');
  const blancOmbre = m.uni('#ebe8e3');
  const noirCoussin = mat('cuir-noir', '#2c2a31', { roughness: 0.62 }); // un cuir noir souple, à peine satiné
  const P = 0.66; // la profondeur commune
  const tige = (x, z, h, dx) => el.push(barre([x, h, z], [x + dx, 0.004, z], 0.0055, m.metalFonce, 8), cylindre(0.016, 0.004, m.uni('#9aa1a9'), [x + dx, 0, z], { segments: 10 }));

  // ---------- le meuble à vinyles ----------
  const [LM, HM, PIED] = [0.92, 0.75, 0.12];
  const xM = -LM / 2;
  const e = 0.025;
  const ySol = PIED; // le dessous du caisson
  const yTab = 0.475; // la tablette
  el.push(boite([LM, e, P], m.chene, [xM, HM - e, P / 2], { r: 0.003 })); // dessus
  el.push(boite([LM, e, P], m.chene, [xM, ySol, P / 2], { r: 0.003 })); // dessous
  for (const sx of [-1, 1]) el.push(boite([e, HM - ySol - 2 * e, P], m.chene, [xM + sx * (LM / 2 - e / 2), ySol + e, P / 2], { r: 0.002 })); // flancs
  el.push(boite([LM - 2 * e, 0.02, P - 0.012], m.chene, [xM, yTab, P / 2 - 0.006], { r: 0.002 })); // tablette
  el.push(boite([LM - 2 * e, HM - ySol - 2 * e, 0.01], m.cheneFonce, [xM, ySol + e, 0.005], { r: 0.001 })); // le fond
  for (const [x, dx] of [[xM - LM / 2 + 0.05, -0.012], [xM + LM / 2 - 0.05, 0.004]]) for (const z of [0.07, P - 0.07]) tige(x, z, ySol, dx);
  // la case du bas : vinyles et magazines debout, serrés, contre l'avant
  const tranches = ['#f3f0ea', '#e8e4dd', '#f8f6f1', '#d9d4cc', '#c9c3ba', '#2f2d36', '#45434e', '#b9b4ad', '#efe9e0', '#a8a39d'];
  const accents = ['#d98b86', '#e3c56f', '#93ad8c', '#8fa2c4', '#c98e6a'];
  const yCase = ySol + e;
  const hCase = yTab - yCase;
  let x = xM - LM / 2 + e + 0.004;
  while (x < xM + LM / 2 - e - 0.008) {
    const ep = 0.0035 + alea() * 0.009;
    const h = hCase - 0.01 - alea() * 0.035;
    const pr = 0.24 + alea() * 0.07;
    const coul = alea() < 0.1 ? accents[Math.floor(alea() * accents.length)] : tranches[Math.floor(alea() * tranches.length)];
    el.push(boite([ep, h, pr], m.uni(coul), [x + ep / 2, yCase, P - 0.02 - pr / 2], { r: 0 }));
    x += ep + 0.0006;
  }
  // la case du haut : la pile de magazines à plat (à gauche), la petite boîte blanche, le boîtier noir au fond
  const yH = yTab + 0.02;
  for (let k = 0; k < 11; k++) {
    const coul = tranches[Math.floor(alea() * 5)];
    el.push(boite([0.3, 0.0085, 0.23], m.uni(coul), [xM - 0.22 + (alea() - 0.5) * 0.012, yH + k * 0.0088, P - 0.15 + (alea() - 0.5) * 0.01], { r: 0, rot: [0, (alea() - 0.5) * 0.05, 0] }));
  }
  el.push(boite([0.045, 0.022, 0.03], m.blanc, [xM + 0.08, yH, P - 0.08], { r: 0.004 }));
  el.push(boite([0.13, 0.035, 0.09], m.uni('#24222b'), [xM + 0.16, yH, 0.12], { r: 0.006 }));

  // ---------- le banc-canapé ----------
  const LC = 1.77;
  const HB = 0.22; // le dessous du plateau
  const EP = 0.045; // son épaisseur
  const yP = HB + EP; // le dessus du plateau
  const EJ = 0.03; // la joue de droite
  el.push(boite([LC - EJ, EP, P], m.chene, [(LC - EJ) / 2, HB, P / 2], { r: 0.004 })); // le plateau, qui part du flanc du meuble
  el.push(boite([EJ, HM - HB, P], m.chene, [LC - EJ / 2, HB, P / 2], { r: 0.004 })); // la joue, à la hauteur du meuble
  // un bandeau sous l'avant du plateau (en retrait d'un centimètre) : le banc a l'air d'un vrai meuble posé, pas
  // d'une planche qui flotte sur des tiges ; les pieds de devant sont derrière lui
  el.push(boite([LC - EJ - 0.012, 0.065, 0.022], m.chene, [(LC - EJ) / 2 + 0.003, HB - 0.065, P - 0.022], { r: 0.003 }));
  for (const [x, dx] of [[0.9, 0], [LC - 0.07, 0.008]]) for (const z of [0.07, P - 0.07]) tige(x, z, HB, dx);
  // les deux coussins de dossier noirs, penchés contre le mur
  for (const [k, cx] of [[0, 0.53], [1, 1.21]]) {
    const g = new THREE.Group();
    g.add(coussinCapitonne([0.66, 0.26, 0.54], noirCoussin, m.uni('#1d1b24'), 41 + k));
    g.position.set(cx + (k ? 0.01 : -0.01), yP + 0.27, 0.16);
    g.rotation.set(-(PI / 2 + 0.24), k ? -0.04 : 0.05, k ? 0.02 : -0.03);
    el.push(g);
  }
  // les deux coussins d'assise, gonflés, qui débordent un peu devant (celui de gauche passe un peu sur l'autre)
  el.push(coussinAssise([0.86, 0.2, 0.5], blanc, [0.45, yP, P - 0.23], 31));
  el.push(coussinAssise([0.86, 0.19, 0.5], blancOmbre, [1.29, yP, P - 0.235], 32));
  return groupe('coin-salon', veinerBois(groupe('', el)));
}

// ===========================================================================================
// --- Les deux coffrets (« out box », 20 × 27 × 5 cm) des Season's Greetings 2027 : NMIXX « Mixx on the Road » et
// TWICE « Spotless », debout sur la planche du haut de l'étagère murale, face à la pièce ---
// Leurs faces et leurs tranches sont tirées de tes planches (public/textures/sg-*.jpg, collées par le programme sur
// les maillages nommés « sg-… ») ; comme sur les photos, la tranche est à gauche de la face. Les autres côtés sont
// de la couleur du carton. Origine : le centre de l'étagère, contre le mur ouest (x = −0,09 : le mur) ; la pièce
// est vers +x. Le dessus de la planche du haut est à 1,616 m.
// ===========================================================================================
function seasonGreetings() {
  const m = creerMateriaux();
  const [L, H, E] = [0.2, 0.27, 0.05]; // largeur (z), hauteur, épaisseur (x)
  const Y = 1.617;
  const el = [];
  const coffret = ({ nom, z, rot, carton, tranche }) => {
    const g = new THREE.Group();
    g.position.set(-0.031, Y, z); // le dos à 3 mm de la butée de la planche
    g.rotation.y = rot;
    g.add(boite([E, H, L], m.uni(carton), [0, 0, 0], { r: 0.0025 }));
    g.add(boite([E - 0.004, H - 0.004, 0.0006], m.uni(tranche), [0, 0.002, L / 2 - 0.0002], { r: 0 })); // la couleur de la tranche
    const face = new THREE.PlaneGeometry(L - 0.003, H - 0.003);
    face.rotateY(PI / 2); // regarde la pièce (+x)
    const mf = new THREE.Mesh(face, m.uni(carton));
    mf.name = `sg-${nom}-face`;
    mf.position.set(E / 2 + 0.0004, H / 2, 0);
    const dos = new THREE.PlaneGeometry(E - 0.003, H - 0.003); // la tranche, côté +z (à gauche quand on regarde la face)
    const mt = new THREE.Mesh(dos, m.uni(tranche));
    mt.name = `sg-${nom}-tranche`;
    mt.position.set(0, H / 2, L / 2 + 0.0004);
    mf.receiveShadow = mt.receiveShadow = true;
    g.add(mf, mt);
    el.push(g);
  };
  coffret({ nom: 'nmixx', z: -0.13, rot: 0.07, carton: '#eeedf1', tranche: '#f5c8d7' });
  coffret({ nom: 'twice', z: 0.11, rot: -0.05, carton: '#efeeed', tranche: '#f6c4d6' });
  return groupe('season-greetings', el);
}

// ===========================================================================================
// --- Le drapeau du coin hi-fi : un drapeau rouge 75 × 50 cm à la calligraphie dorée « 为人民服务 », punaisé au mur
// ouest par ses quatre coins, au-dessus des posters du meuble hi-fi. Le tissu n'est pas tendu : entre les punaises
// il se creuse un peu (le haut tombe, les côtés rentrent), il gonfle légèrement au milieu et des plis partent en
// éventail des deux punaises du haut. L'imprimé est un maillage nommé (« imprime-drapeau ») : le programme y colle
// l'image (public/textures/drapeau-servir-le-peuple.jpg).
// Origine : le pied du mur ouest, au milieu du drapeau ; la pièce vers +x, l'image se lit de +z (gauche) vers −z.
// ===========================================================================================
function drapeau() {
  const m = creerMateriaux();
  const [W, H] = [0.75, 0.5];
  const Y = 1.82; // la hauteur du milieu du drapeau
  const marge = 0.016; // les punaises, à 1,6 cm des bords
  const geo = new THREE.PlaneGeometry(W, H, 96, 64);
  const p = geo.attributes.position;
  const coins = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([a, b]) => [a * (W / 2 - marge), b * (H / 2 - marge)]);
  const borne = (t) => Math.min(1, Math.max(0, t));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    // u, v : 0 → 1 entre les punaises (les coins au-delà restent raides)
    const u = borne((x + W / 2 - marge) / (W - 2 * marge));
    const v = borne((y + H / 2 - marge) / (H - 2 * marge));
    const su = Math.sin(PI * u);
    const sv = Math.sin(PI * v);
    // le tissu tombe entre les punaises (le bord du haut se creuse en arc, plus que celui du bas) et les côtés
    // rentrent un peu
    const dy = -su * (0.008 + 0.014 * v * v);
    const dx = 0.007 * sv * Math.cos(PI * u);
    // il s'écarte du mur : un peu partout, plus au milieu, avec des plis en éventail sous les punaises du haut
    let dz = 0.003 + 0.014 * su * Math.pow(sv, 0.8);
    for (const [cx, cy] of coins.slice(0, 2)) {
      const ex = x - cx;
      const ey = y - cy;
      const d = Math.hypot(ex, ey);
      const angle = Math.atan2(-ey, Math.abs(ex)); // 0 = vers le milieu, π/2 = vers le bas
      dz += 0.008 * Math.exp(-d / 0.2) * (1 - Math.exp(-d / 0.025)) * Math.pow(Math.max(0, Math.cos(angle * 5 - 0.4)), 1.5);
    }
    // quelques grandes ondes verticales dans le bas, là où le tissu pend, et une ondulation douce partout
    dz += 0.005 * Math.sin(u * PI * 3 + 0.7) * Math.pow(1 - v, 1.3) * su;
    dz += 0.0015 * Math.sin(u * PI * 7 + v * 2.6) * su * sv;
    dz = Math.max(dz, 0.0018); // jamais dans le mur
    p.setXYZ(i, x + dx, y + dy, dz);
  }
  geo.computeVertexNormals();
  geo.rotateY(PI / 2); // regarde la pièce (+x) ; le bord gauche de l'image (u = 0) va vers +z
  const tissu = new THREE.Mesh(geo, m.uni('#d8261a'));
  tissu.name = 'imprime-drapeau';
  tissu.position.y = Y;
  tissu.castShadow = tissu.receiveShadow = true;
  // les punaises dorées : une tête plate et un petit dôme (étroit côté pièce), plantées dans le tissu à chaque coin
  const laiton = m.uni('#c9a24c');
  const punaises = coins.map(([cx, cy]) => {
    const g = new THREE.Group();
    g.position.set(0.003, Y + cy, -cx);
    g.add(cylindre(0.011, 0.0016, laiton, [0.0008, 0, 0], { rot: [0, 0, -PI / 2], centre: true, segments: 20 }));
    g.add(cylindre(0.0065, 0.004, laiton, [0.0036, 0, 0], { rot: [0, 0, -PI / 2], centre: true, segments: 16, dBas: 0.008 }));
    return g;
  });
  return groupe('drapeau', [tissu, ...punaises]);
}

// ===========================================================================================
// --- Le lecteur CD Moondrop DiscDream 2 Ultra (≈ 145 × 145 × 26 mm, estimé d'après les photos) ---
// Un carré d'aluminium brossé argenté. Dessus : un cadre plein et des fentes parallèles (de l'avant vers l'arrière)
// à travers lesquelles on voit le disque ; « MOONDROP DISCDREAM 2 ULTRA » gravé le long du bord gauche. Tranche
// avant : le petit écran noir et sept boutons carrés. Flanc droit : les sorties 4,4 mm et 3,5 mm, la prise
// multifonction et l'USB-C. Origine : le centre du dessous ; l'avant vers +z.
// ===========================================================================================
function discDream(m) {
  const [W, H] = [0.145, 0.026];
  const alu = mat('alu-moondrop', '#e4e7eb', { roughness: 0.42, metalness: 0.12 }); // l'aluminium poli, clair et satiné
  const aluFonce = m.uni('#b9bec5');
  const noir = m.uni('#16151a'); // l'intérieur, presque noir : les fentes ressortent comme sur les photos
  const el = [];
  const yH = H; // le dessus
  const yFond = yH - 0.0105; // le fond de la cuve, sous les fentes
  el.push(boite([W, yFond - 0.0015, W], alu, [0, 0.0015, 0], { r: 0.003 })); // le corps, jusqu'au fond de la cuve
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el.push(cylindre(0.012, 0.0015, m.noirMat, [sx * 0.055, 0, sz * 0.055], { segments: 10 })); // les pieds
  // dessous des fentes : le fond sombre et le disque
  el.push(boite([W - 0.026, 0.001, W - 0.026], noir, [0, yH - 0.0105, 0], { r: 0 }));
  el.push(cylindre(0.12, 0.0012, m.uni('#2a2931'), [0, yH - 0.0095, 0.004], { segments: 40 })); // le CD, sombre à travers les fentes (comme sur la photo)
  el.push(cylindre(0.04, 0.0014, m.uni('#3c3a44'), [0, yH - 0.0095, 0.004], { segments: 24 }));
  el.push(cylindre(0.015, 0.003, aluFonce, [0, yH - 0.0095, 0.004], { segments: 16 }));
  // le dessus : le cadre plein, puis les barres entre les fentes
  const bord = 0.013;
  const yB = yH - 0.0045;
  // (le cadre fait aussi les parois de la cuve : du fond jusqu'au dessus ; on voit le noir et le CD par les fentes)
  for (const s of [-1, 1]) {
    el.push(boite([W, yH - yFond, bord], alu, [0, yFond, s * (W / 2 - bord / 2)], { r: 0.0015 }));
    el.push(boite([bord, yH - yFond, W - 2 * bord], alu, [s * (W / 2 - bord / 2), yFond, 0], { r: 0.0015 }));
  }
  const n = 17;
  const zone = W - 2 * bord;
  const pas = zone / n;
  for (let k = 0; k < n - 1; k++) el.push(boite([pas * 0.5, 0.0045, zone], alu, [-zone / 2 + pas * (k + 1), yB, 0], { r: 0.0008 })); // des barres moitié moins larges que le pas : des fentes larges
  // la gravure du bord gauche : « MOONDROP DISCDREAM 2 ULTRA » et, dessous, « Portable CD Player » (elle se lit de
  // l'arrière vers l'avant, depuis la gauche du lecteur, comme sur la photo)
  const gravure = decalque(0.1, 0.0105, (g, w, h) => {
    g.fillStyle = '#6f747c';
    g.textBaseline = 'middle';
    g.font = `500 ${h * 0.4}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.fillText('MOONDROP  DISCDREAM 2 ULTRA', 0, h * 0.3);
    g.font = `400 ${h * 0.24}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.fillText('Portable CD Player · Dual-DAC / Balanced Output', 0, h * 0.74);
  }, { nom: 'imprime-moondrop', px: 26000 });
  gravure.rotation.z = -PI / 2;
  gravure.position.set(-W / 2 + 0.0068, yH + 0.0002, 0.006);
  el.push(gravure);
  // la tranche avant : l'écran et les sept boutons
  const zF = W / 2;
  el.push(boite([0.028, 0.011, 0.001], m.uni('#18171c'), [-W / 2 + 0.024, 0.0075, zF], { r: 0.0005 }));
  el.push(boite([0.016, 0.004, 0.0004], m.uni('#5f7f86'), [-W / 2 + 0.022, 0.011, zF + 0.0006], { r: 0 })); // l'affichage, éteint
  for (let k = 0; k < 7; k++) el.push(boite([0.0105, 0.009, 0.0014], aluFonce, [-W / 2 + 0.048 + k * 0.0135, 0.0085, zF], { r: 0.0012 }));
  // le flanc droit : les prises
  const xD = W / 2 + 0.0002;
  for (const [z, d] of [[0.03, 0.0062], [0.012, 0.0048], [-0.004, 0.0048]]) {
    el.push(cylindre(d + 0.003, 0.0008, aluFonce, [xD, 0.013, z], { rot: [0, 0, PI / 2], centre: true, segments: 14 }));
    el.push(cylindre(d, 0.0012, m.uni('#121116'), [xD + 0.0002, 0.013, z], { rot: [0, 0, PI / 2], centre: true, segments: 14 }));
  }
  el.push(boite([0.0008, 0.0032, 0.009], m.uni('#121116'), [xD, 0.0115, -0.025], { r: 0.0012 })); // USB-C
  return groupe('objet_lecteur', el);
}

// ===========================================================================================
// --- Une enceinte Edifier R1280DB, finition bois (146 × 234 × 196 mm) ---
// Caisson en MDF plaqué bois (veiné), arêtes adoucies. Façade : le woofer de 4 pouces (cerclage noir à quatre
// vis, suspension, membrane, cache-noyau), au-dessus le tweeter à dôme de soie sur sa platine ronde à quatre vis
// (avec sa barre de phase) et l'évent bass-reflex évasé à côté, le logo EDIFIER en bas, quatre vis aux coins.
// L'active a, sur son flanc droit, le panneau noir en creux avec les molettes des aigus, des graves et du
// volume, et le voyant vert. Origine : le centre du dessous ; la façade vers +z.
// ===========================================================================================
function enceinteEdifier(m, active) {
  const [W, H, D] = [0.146, 0.234, 0.196];
  const bois = mat('acajouEdifier', '#93633f');
  const noir = m.uni('#232228');
  const noirMat = m.uni('#2e2d35');
  const vis = m.uni('#6b6a72');
  const el = [];
  el.push(boite([W, H, D], bois, [0, 0, 0], { r: 0.005 }));
  el.push(boite([W - 0.02, 0.006, D - 0.02], m.uni('#5e4029'), [0, -0.003, 0], { r: 0.002 })); // le socle en retrait
  const zF = D / 2;
  const disque = (d, ep, materiau, [x, y], z = zF) => cylindre(d, ep, materiau, [x, y, z + ep / 2], { rot: [PI / 2, 0, 0], centre: true, segments: 32 });
  // le woofer
  const [xW, yW] = [0, 0.085];
  el.push(disque(0.128, 0.004, noir, [xW, yW]));
  el.push(tore(0.1, 0.0065, noirMat, [xW, yW, zF + 0.0045], [0, 0, 0]));
  el.push(revolution([[0.045, 0.004], [0.032, -0.004], [0.02, -0.012], [0.013, -0.014]].map(([r, h]) => [r, h]).reverse(), m.uni('#3a3842'), [xW, yW, zF + 0.0035], 32).rotateX(PI / 2));
  el.push(sphere(0.03, m.uni('#2c2b32'), [xW, yW, zF - 0.008], { echelle: [1, 1, 0.55] }));
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + (k * PI) / 2;
    el.push(disque(0.006, 0.002, vis, [xW + 0.057 * Math.cos(a), yW + 0.057 * Math.sin(a)], zF + 0.004));
  }
  // le tweeter, sa platine et sa barre de phase
  const [xT, yT] = [-0.03, 0.188];
  el.push(disque(0.07, 0.004, noir, [xT, yT]));
  el.push(disque(0.03, 0.003, noirMat, [xT, yT], zF + 0.004));
  el.push(sphere(0.022, m.uni('#3b3a43'), [xT, yT, zF + 0.007], { echelle: [1, 1, 0.5] }));
  el.push(boite([0.0025, 0.03, 0.003], m.uni('#55545d'), [xT, yT - 0.015, zF + 0.009], { r: 0.0008 }));
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + (k * PI) / 2;
    el.push(disque(0.005, 0.002, vis, [xT + 0.027 * Math.cos(a), yT + 0.027 * Math.sin(a)], zF + 0.004));
  }
  // l'évent bass-reflex, évasé
  el.push(disque(0.044, 0.003, noir, [0.038, 0.19]));
  el.push(disque(0.034, 0.0035, m.uni('#0d0c10'), [0.038, 0.19], zF + 0.0002));
  // le logo et les vis des coins
  el.push(boite([0.032, 0.005, 0.0008], m.uni('#c9ccd1'), [0, 0.016, zF], { r: 0.0005 }));
  for (const sx of [-1, 1]) for (const y of [0.012, H - 0.012]) el.push(disque(0.006, 0.0015, vis, [sx * (W / 2 - 0.012), y]));
  if (active) {
    // le panneau de commande en creux, sur le flanc droit, près de l'avant
    const xP = W / 2 + 0.0005;
    const zP = D / 2 - 0.05;
    el.push(boite([0.002, 0.13, 0.058], noir, [xP - 0.0005, 0.085, zP], { r: 0.003 }));
    for (const [y, d] of [[0.19, 0.021], [0.155, 0.021], [0.118, 0.024]]) {
      el.push(cylindre(d, 0.011, m.uni('#2b2a31'), [xP + 0.0055, y, zP], { rot: [0, 0, PI / 2], centre: true, segments: 20 }));
      el.push(cylindre(d * 0.75, 0.0012, m.uni('#3d3c45'), [xP + 0.0115, y, zP], { rot: [0, 0, PI / 2], centre: true, segments: 18 }));
      el.push(boite([0.0008, 0.006, 0.0012], m.uni('#cfd0d4'), [xP + 0.012, y + d * 0.25, zP], { r: 0 })); // le repère
    }
    el.push(sphere(0.003, mat('voyant-vert', '#7fe08a', { emissive: '#5fd16d', emissiveIntensity: 1.2 }), [xP + 0.001, 0.1, zP]));
  }
  return veinerBois(groupe(active ? 'enceinte-active' : 'enceinte-passive', el));
}

// ===========================================================================================
// --- Le meuble hi-fi : un bureau bas de rangement en chêne (80 × 38 cm, dessus à 50 cm), dans le style du bureau bas
// (lames, veines, pieds fins, ceinture), avec une tablette basse où sont présentés cinq vinyles, pochettes face à la pièce. Dessus : les deux
// enceintes Edifier R1280DB aux bouts, l'active à droite (son panneau de commande vers l'extérieur), le lecteur
// DiscDream 2 Ultra au milieu, relié à l'enceinte active ; le câble des enceintes passe derrière.
// Origine : le centre du meuble au sol ; l'avant vers +z, le mur derrière (−z).
// ===========================================================================================
function meubleHifi() {
  const m = creerMateriaux();
  const [L, P, T] = [0.8, 0.38, 0.5];
  const parts = structureBois(m, { L, P, T, ep: 0.028, lames: 3, noeuds: [[0.22, -0.05, 0.4, 0.9]], graine: 17 });
  const alea = hasard(9);
  // la tablette basse, entre les pieds, posée sur les traverses (assez bas pour qu'une pochette de 31,5 cm tienne
  // debout dessous le plateau), et les vinyles présentés face à la pièce, en éventail, appuyés vers l'arrière :
  // chacun un peu devant et à droite du précédent, celui de devant entier. Leurs pochettes sont des maillages nommés
  // (« vinyle-… ») : le programme y colle l'image (public/textures/vinyle-*.jpg).
  const px = L / 2 - 0.06;
  const yTab = 0.07;
  parts.push(boite([2 * px - 0.045, 0.018, P - 0.07], m.uni(CHENE.tons[2]), [0, yTab, 0], { r: 0.002 }));
  const pochettes = ['yeonjun', 'machine', 'sphere', 'cortis', 'chuu']; // du fond vers l'avant
  const C = 0.315;
  pochettes.forEach((nom, k) => {
    const g = new THREE.Group();
    g.position.set(-0.16 + k * 0.08, yTab + 0.018, -0.118 + k * 0.012);
    g.rotation.x = -0.1; // appuyée vers l'arrière
    g.rotation.y = (k % 2 ? 1 : -1) * 0.02;
    g.add(boite([C, C, 0.004], m.uni(nom === 'yeonjun' ? '#f1f0ee' : '#1f1e24'), [0, 0, 0], { r: 0.001 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(C - 0.002, C - 0.002), m.uni('#d8d2cc'));
    face.name = `vinyle-${nom}`;
    face.position.set(0, C / 2, 0.0024);
    face.receiveShadow = true;
    g.add(face);
    parts.push(g);
  });
  // devant les vinyles, à plat sur la tablette : deux albums en jewel case (142 × 125 × 10 mm), un peu de travers
  // comme posés à la main. Hearts2Hearts « Lemon Tang » (plateau transparent, tranches jaunes) et LNGSHOT
  // « Training Day » (plateau noir, tranches grises). Leur face est un maillage nommé (« jewel-… ») : le programme y
  // colle la photo du boîtier (public/textures/jewel-*.jpg), plastique transparent et charnière compris.
  const jewel = ({ nom, x, z, rot, plateau, tranche }) => {
    const [JL, JH, JP] = [0.142, 0.0104, 0.125];
    const g = new THREE.Group();
    g.position.set(x, yTab + 0.018 + 0.001, z);
    g.rotation.y = rot;
    g.add(boite([JL, JH - 0.0012, JP], m.uni(plateau), [0, 0, 0], { r: 0.0015 }));
    // le couvercle de plastique clair et les deux tranches de la jaquette, vues à travers les bouts du boîtier
    g.add(boite([JL, 0.0012, JP], m.uni('#e8edf0'), [0, JH - 0.0012, 0], { r: 0 }));
    for (const s of [-1, 1]) g.add(boite([0.0008, JH - 0.003, JP - 0.006], m.uni(tranche), [s * (JL / 2 - 0.0035), 0.0012, 0], { r: 0 }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(JL - 0.0006, JP - 0.0006), m.uni('#e6e6e6'));
    face.name = `jewel-${nom}`;
    face.rotation.x = -PI / 2;
    face.position.y = JH + 0.0004;
    face.receiveShadow = true;
    g.add(face);
    parts.push(g);
  };
  jewel({ nom: 'h2h', x: -0.098, z: 0.058, rot: 0.06, plateau: '#f3f1e4', tranche: '#f2df2e' });
  jewel({ nom: 'lngshot', x: 0.088, z: 0.064, rot: -0.09, plateau: '#2a292e', tranche: '#5d5c62' });
  // dessus : les enceintes et le lecteur
  const yD = T + 0.001; // au-dessus des veines du plateau
  const gauche = enceinteEdifier(m, false);
  gauche.position.set(-L / 2 + 0.085, yD, -0.03);
  gauche.rotation.y = 0.12;
  const droite = enceinteEdifier(m, true);
  droite.position.set(L / 2 - 0.085, yD, -0.03);
  droite.rotation.y = -0.12;
  const lecteur = discDream(m);
  lecteur.position.set(0, yD, 0.03);
  lecteur.rotation.y = -0.1;
  parts.push(gauche, droite, lecteur);
  // les câbles : du lecteur (flanc droit) au dos de l'enceinte active, et d'une enceinte à l'autre par derrière.
  // Leurs bouts sont pris au dos des enceintes (à 6 cm du bas), et chaque point de la courbe est relevé au-dessus du
  // plateau : sinon la courbe plonge entre ses points et traverse le meuble.
  gauche.updateMatrix();
  droite.updateMatrix();
  const dos = (enceinte, dx) => new THREE.Vector3(dx, 0.06, -0.098 - 0.002).applyMatrix4(enceinte.matrix);
  const derriere = (v, d) => v.clone().add(new THREE.Vector3(0, -0.055, -d));
  const poser = (pts, r, materiau) => {
    const courbe = new THREE.CatmullRomCurve3(pts.map((p) => (Array.isArray(p) ? new THREE.Vector3(...p) : p)));
    const posee = courbe.getSpacedPoints(80).map((q) => {
      q.y = Math.max(q.y, yD + r + 0.0006);
      return q;
    });
    parts.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(posee), 140, r, 6), materiau)));
  };
  const dosD = dos(droite, -0.03);
  poser([[0.0755, yD + 0.013, 0.04], [0.09, yD + 0.006, 0.03], [0.12, yD + 0.003, -0.06], [0.2, yD + 0.003, -0.15], derriere(dosD, 0.01), dosD], 0.0024, m.uni('#2a2830'));
  const dosG = dos(gauche, 0.03);
  const dosD2 = dos(droite, 0.03);
  poser([dosG, derriere(dosG, 0.012), [-0.15, yD, -0.168], [0.15, yD, -0.168], derriere(dosD2, 0.012), dosD2], 0.0018, m.uni('#7b4a3a'));
  return groupe('meuble-hifi', parts);
}

// ===========================================================================================
// --- Ta Nintendo 3DS (la première, 2011), blanche « Ice White », ouverte sur Pokémon Lune ---
// 134 × 74 mm, 21 mm fermée (la moitié basse 12 mm, le capot 9), d'après la photo officielle de la console ouverte.
// En bas : l'écran tactile (3,02 pouces) dans son cadre argenté, SELECT, HOME et START imprimés dessous ; à gauche
// le Circle Pad dans son anneau et la croix ; à droite A B X Y et POWER ; devant, la prise casque et les deux
// témoins (le bleu allumé) ; derrière, la charnière argentée entre deux épaulements blancs, les gâchettes L et R, la
// fente des cartes, le stylet. Le capot : coque blanche, face intérieure noire brillante (comme sur la Ice White),
// l'écran 3D (3,53 pouces), la caméra intérieure au-dessus, les deux haut-parleurs (quatre trous en losange), le
// curseur 3D sur le bord droit avec son coin de réglage, deux butées en caoutchouc ; au dos, les deux caméras.
// Le capot tourne autour de la charnière (« pivot_ecran_3ds », fermé : 0 ; ouvert : −2,2 rad, à 125°) : le
// programme l'ouvre ou le ferme au clic. Les écrans (« ecran-3ds-haut », « ecran-3ds-bas »), le cadre imprimé
// (« imprime-3ds-cadre ») et les marquages (« marquage-3ds-… ») reçoivent leurs images du programme
// (textures.ecrans3ds). Les surfaces plates superposées sont écartées d'au moins 0,8 mm (sinon elles scintillent de
// loin). Origine : le centre du dessous ; le joueur vers +z, la charnière vers −z.
// ===========================================================================================
const OUVERTURE_3DS = -2.2;
function nintendo3ds(m) {
  const [W, D, HB, HL] = [0.134, 0.074, 0.012, 0.009];
  const blanc = mat('3ds-blanc', '#f4f5f6', { roughness: 0.26 });
  const blancGris = mat('3ds-blanc-gris', '#e2e5e9', { roughness: 0.32 });
  const argent = mat('3ds-argent', '#cfd3d8', { roughness: 0.28, metalness: 0.45 });
  const gris = mat('3ds-gris', '#b8bcc2', { roughness: 0.42 });
  const noir = mat('3ds-noir', '#0c0d10', { roughness: 0.1 });
  const trou = mat('3ds-trou', '#16171b', { roughness: 0.85 });
  const el = [];
  // une plaque aux bords adoucis : un rectangle arrondi (w × d, vu de dessus) extrudé sur la hauteur h, posé en y
  const plaque = (w, d, r, h, materiau, y, b = Math.min(0.0016, h / 3)) => {
    const g = new THREE.ExtrudeGeometry(rectArrondi(new THREE.Shape(), -w / 2 + b, -d / 2 + b, w / 2 - b, d / 2 - b, Math.max(0.0005, r - b)), { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10 });
    g.rotateX(-PI / 2);
    g.translate(0, y + b, 0);
    return ombres(new THREE.Mesh(g, materiau));
  };
  // un plan imprimé (décalque) tourné vers +y, ou vers −y si `dessous`
  const decalque = (nom, w, d, [x, y, z], { dessous = false } = {}) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m.uni('#ffffff'));
    p.rotation.x = dessous ? PI / 2 : -PI / 2;
    p.position.set(x, y, z);
    p.name = nom;
    return p;
  };
  // une position sur le dessus de la moitié basse, mesurée sur la photo : u (mm, depuis le milieu), v (mm, depuis le dos)
  const surBas = (u, v) => [u / 1000, -D / 2 + v / 1000];

  // — la moitié basse —
  el.push(plaque(W, D, 0.009, HB, blanc, 0));
  // le cadre argenté de l'écran tactile : ses flancs, et son dessus imprimé (le cadre, la vitre noire, SELECT, HOME,
  // START, le micro) ; sans dessus plein, rien ne scintille avec l'image
  const [LC, PC, EC] = [0.0725, 0.0605, 0.001];
  const zC = -D / 2 + 0.0115 + PC / 2;
  {
    const g = new THREE.ExtrudeGeometry(rectArrondi(new THREE.Shape(), -LC / 2, -PC / 2, LC / 2, PC / 2, 0.0035), { depth: EC, bevelEnabled: false, curveSegments: 8 });
    const { start, count } = g.groups[1]; // (le groupe 1 : les flancs)
    const flancs = new THREE.BufferGeometry();
    for (const [nom, a] of Object.entries(g.attributes)) flancs.setAttribute(nom, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
    flancs.rotateX(-PI / 2);
    flancs.translate(0, HB, zC);
    el.push(new THREE.Mesh(flancs, argent));
    el.push(decalque('imprime-3ds-cadre', LC, PC, [0, HB + EC, zC]));
  }
  // l'écran tactile, 0,8 mm au-dessus du cadre (centré à 37,8 mm du dos)
  const [, zEB] = surBas(0, 37.8);
  el.push(decalque('ecran-3ds-bas', 0.06144, 0.04608, [0, HB + EC + 0.0008, zEB]));
  // le Circle Pad : son puits sombre, l'anneau argenté, le champignon gris légèrement creusé
  {
    const [x, z] = surBas(-46.8, 27.7);
    el.push(cylindre(0.0172, 0.0013, trou, [x, HB - 0.0005, z], { segments: 32 }));
    el.push(tore(0.0186, 0.0012, argent, [x, HB + 0.0004, z], [PI / 2, 0, 0]));
    el.push(cylindre(0.0042, 0.0016, gris, [x, HB, z], { segments: 16 })); // la tige
    el.push(cylindre(0.0136, 0.0016, gris, [x, HB + 0.0014, z], { segments: 32, dBas: 0.0128 }));
    el.push(cylindre(0.0108, 0.0004, mat('3ds-gris-clair', '#c6cace', { roughness: 0.5 }), [x, HB + 0.0029, z], { segments: 32 })); // le creux du dessus
  }
  // la croix : son puits en croix, les deux branches, une petite strie au bout de chacune
  {
    const [x, z] = surBas(-49.7, 50);
    for (const [l, p] of [[0.0172, 0.0062], [0.0062, 0.0172]]) {
      el.push(boite([l + 0.0012, 0.0013, p + 0.0012], trou, [x, HB - 0.0005, z], { r: 0.0008 }));
      el.push(boite([l, 0.0022, p], blancGris, [x, HB, z], { r: 0.0009 }));
    }
    for (const [dx, dz, rot] of [[0.006, 0, 0], [-0.006, 0, 0], [0, 0.006, PI / 2], [0, -0.006, PI / 2]]) el.push(boite([0.0006, 0.0003, 0.0028], gris, [x + dx, HB + 0.0022, z + dz], { r: 0, rot: [0, rot, 0] }));
  }
  // A B X Y : quatre boutons ronds au bord biseauté, dans leurs puits, leur lettre imprimée dessus
  {
    const [x0, z0] = surBas(47.5, 29);
    for (const [lettre, dx, dz] of [['x', 0, -0.0071], ['y', -0.0073, 0], ['a', 0.0073, 0], ['b', 0, 0.0071]]) {
      const [x, z] = [x0 + dx, z0 + dz];
      el.push(cylindre(0.0078, 0.0013, trou, [x, HB - 0.0005, z], { segments: 20 }));
      el.push(cylindre(0.0069, 0.0016, blancGris, [x, HB, z], { segments: 24 }));
      el.push(cylindre(0.0061, 0.0004, blanc, [x, HB + 0.0016, z], { segments: 24, dBas: 0.0069 }));
      el.push(decalque(`marquage-3ds-${lettre}`, 0.0042, 0.0042, [x, HB + 0.0023, z]));
    }
  }
  // POWER : le bouton carré dans son liseré argenté, son pictogramme, son nom à droite
  {
    const [x, z] = surBas(41.6, 62.5);
    el.push(boite([0.0066, 0.0011, 0.0066], argent, [x, HB - 0.0003, z], { r: 0.0012 }));
    el.push(boite([0.0052, 0.0012, 0.0052], blanc, [x, HB, z], { r: 0.0011 }));
    el.push(decalque('marquage-3ds-power', 0.004, 0.004, [x, HB + 0.0015, z]));
    el.push(decalque('marquage-3ds-power-nom', 0.0112, 0.0024, [x + 0.0098, HB + 0.0008, z]));
  }
  // les épaulements blancs de la charnière, de chaque côté de la partie argentée du capot
  const [yP, zP] = [HB + 0.0045, -D / 2 + 0.0055];
  for (const s of [-1, 1]) {
    el.push(cylindre(0.0116, 0.0136, blanc, [s * 0.0566, yP, zP], { rot: [0, 0, PI / 2], centre: true, segments: 22 }));
    el.push(boite([0.0136, 0.0042, 0.0116], blanc, [s * 0.0566, HB - 0.0006, zP], { r: 0.001 }));
  }
  // le témoin de notification, au bout droit de la charnière
  el.push(boite([0.0016, 0.0012, 0.0005], gris, [0.0634, yP + 0.0015, zP + 0.0058], { r: 0 }));
  // devant : la prise casque au milieu, les deux témoins à droite (l'alimentation, bleue, allumée), deux fentes
  const zF = D / 2;
  el.push(cylindre(0.0052, 0.0006, argent, [0, HB / 2, zF + 0.0001], { rot: [PI / 2, 0, 0], centre: true, segments: 18 }));
  el.push(cylindre(0.0034, 0.0008, trou, [0, HB / 2, zF + 0.0004], { rot: [PI / 2, 0, 0], centre: true, segments: 16 }));
  el.push(boite([0.0022, 0.0013, 0.0005], mat('3ds-temoin-bleu', '#4ea4ff', { emissive: '#4ea4ff', emissiveIntensity: 1.4 }), [0.0423, HB - 0.0036, zF + 0.0001], { r: 0 }));
  el.push(boite([0.0022, 0.0013, 0.0005], gris, [0.0553, HB - 0.0036, zF + 0.0001], { r: 0 }));
  for (const s of [-1, 1]) el.push(boite([0.0032, 0.0011, 0.0005], trou, [s * 0.0605, HB - 0.0036, zF + 0.0001], { r: 0 }));
  // sur le flanc gauche, le curseur du volume et le cache de la carte SD ; sur le droit, l'interrupteur sans fil
  el.push(boite([0.0006, 0.0022, 0.012], trou, [-W / 2 - 0.0001, HB / 2 - 0.0011, 0.008], { r: 0 }));
  el.push(boite([0.0012, 0.0018, 0.0035], gris, [-W / 2 - 0.0004, HB / 2 - 0.0009, 0.004], { r: 0.0004 }));
  el.push(boite([0.0005, 0.006, 0.024], blancGris, [-W / 2 - 0.0001, 0.0025, -0.012], { r: 0 }));
  el.push(boite([0.0006, 0.0022, 0.009], trou, [W / 2 + 0.0001, HB / 2 - 0.0011, 0.0], { r: 0 }));
  el.push(boite([0.0012, 0.0018, 0.003], gris, [W / 2 + 0.0004, HB / 2 - 0.0009, -0.002], { r: 0.0004 }));
  // derrière : les gâchettes L et R dans les coins, la fente des cartes, la prise de charge, le bout du stylet
  for (const s of [-1, 1]) el.push(boite([0.021, 0.0042, 0.003], blancGris, [s * 0.052, HB - 0.0062, -D / 2 - 0.0009], { r: 0.0012 }));
  el.push(boite([0.036, 0.0024, 0.0005], trou, [-0.012, HB / 2 - 0.0026, -D / 2 - 0.0001], { r: 0 }));
  el.push(boite([0.0075, 0.0026, 0.0005], trou, [0.018, HB / 2 - 0.0026, -D / 2 - 0.0001], { r: 0.0005 }));
  el.push(cylindre(0.0038, 0.0012, gris, [0.034, HB / 2, -D / 2 - 0.0005], { rot: [PI / 2, 0, 0], centre: true, segments: 12 }));
  // dessous : quatre patins
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el.push(cylindre(0.004, 0.0005, blancGris, [sx * 0.05, -0.0004, sz * 0.026], { segments: 10 }));

  // — le capot, autour de la charnière —
  const capot = new THREE.Group();
  capot.name = 'pivot_ecran_3ds';
  capot.position.set(0, yP, zP);
  capot.rotation.x = OUVERTURE_3DS;
  // la partie argentée de la charnière, qui tient le capot
  capot.add(cylindre(0.0112, 0.0972, argent, [0, 0, 0], { rot: [0, 0, PI / 2], centre: true, segments: 24 }));
  // la coque : de 4 mm devant l'axe jusqu'au bout (fermé, elle recouvre exactement la moitié basse)
  const [z0L, z1L] = [0.004, D - 0.0055];
  const LP = z1L - z0L;
  const zL = (z0L + z1L) / 2;
  const coque = plaque(W, LP, 0.009, HL, blanc, -HL / 2);
  coque.position.z = zL;
  capot.add(coque);
  // la face intérieure (vers −y quand il est fermé) : un panneau noir brillant, en relief de 1 mm, un liseré blanc autour
  const face = plaque(W - 0.003, LP - 0.0028, 0.0075, 0.0013, noir, -HL / 2 - 0.001, 0.0004);
  face.position.z = zL;
  capot.add(face);
  const yFace = -HL / 2 - 0.001; // la surface du panneau noir
  // l'écran 3D, 0,8 mm devant le panneau, centré à 33 mm de l'axe (le haut de l'image vers le bout du capot)
  capot.add(decalque('ecran-3ds-haut', 0.0768, 0.04608, [0, yFace - 0.0008, 0.033], { dessous: true }));
  // la caméra intérieure, au-dessus de l'écran
  capot.add(cylindre(0.0046, 0.0008, gris, [0, yFace - 0.0008, 0.0625], { segments: 18 }));
  capot.add(cylindre(0.003, 0.0008, mat('3ds-objectif', '#1d2433', { roughness: 0.05, metalness: 0.3 }), [0, yFace - 0.0012, 0.0625], { segments: 16 }));
  // les haut-parleurs : quatre trous en losange de chaque côté de l'écran
  for (const s of [-1, 1]) for (const [du, dv] of [[0, 0.0017], [0, -0.0017], [0.0016, 0], [-0.0016, 0]]) {
    capot.add(cylindre(0.0011, 0.0008, mat('3ds-grille', '#2b2d33', { roughness: 0.9 }), [s * 0.0533 + du, yFace - 0.0006, 0.0377 + dv], { segments: 8 }));
  }
  // le curseur 3D sur le bord droit : sa glissière, son bouton (sur OFF, côté charnière), le coin de réglage
  capot.add(boite([0.0013, 0.001, 0.0135], trou, [W / 2 - 0.0024, yFace - 0.0007, 0.0245], { r: 0 }));
  capot.add(boite([0.0024, 0.0016, 0.0032], argent, [W / 2 - 0.0012, yFace - 0.0012, 0.0198], { r: 0.0005 }));
  {
    const coin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.0013, 0), new THREE.Vector2(0, 0.0125)]);
    const g = new THREE.ShapeGeometry(coin);
    g.rotateX(PI / 2); // à plat, tourné vers −y
    const p = new THREE.Mesh(g, mat('3ds-reglage', '#c9ccd1', { roughness: 0.4, side: THREE.DoubleSide }));
    p.position.set(W / 2 - 0.0052, yFace - 0.0007, 0.0185);
    capot.add(p);
  }
  // deux butées en caoutchouc aux coins du bout
  for (const s of [-1, 1]) capot.add(boite([0.0016, 0.0008, 0.0045], trou, [s * (W / 2 - 0.0042), yFace - 0.0006, z1L - 0.0075], { r: 0.0003 }));
  // au dos (vers +y fermé) : les deux caméras extérieures, vers le bout du capot
  for (const s of [-1, 1]) {
    capot.add(cylindre(0.0062, 0.0006, argent, [s * 0.0175, HL / 2, z1L - 0.011], { segments: 20 }));
    capot.add(cylindre(0.0042, 0.0009, mat('3ds-objectif', '#1d2433', { roughness: 0.05, metalness: 0.3 }), [s * 0.0175, HL / 2, z1L - 0.011], { segments: 18 }));
  }
  el.push(capot);
  return groupe('objet_3ds', el);
}

// ===========================================================================================
// --- Le bureau du studio (chambre de rêve) : le bureau en bouleau et son plateau de verre, avec ---
//  - à gauche, le MacBook Air ouvert sur un support en aluminium incliné, comme le ThinkPad du bureau bas ;
//  - un cahier ouvert (lignes, quelques lignes d'écriture, un stylo posé dessus) ;
//  - dans le coin à droite, la lampe champignon qui s'allume (son matériau « champignon-verre » est réglé par le
//    programme, avec la lumière « lampe champignon » de chambre.js), et devant elle trois livres empilés.
// Repère du bureau : le dessus du verre est à 0,756 m ; l'avant (où l'on s'assoit) vers +z.
// ===========================================================================================

// Le support incliné d'un portable (deux rails, pieds arrière, butée avant) : `incl` reçoit le portable (origine au
// centre de son dessous, clavier vers +z). D = la profondeur du portable.
function supportIncline(m, D, theta = 0.26) {
  const alu = m.metal;
  const support = new THREE.Group();
  const zButee = D / 2 + 0.0015;
  const incl = new THREE.Group();
  incl.rotation.x = theta;
  incl.position.set(0, 0.016 + Math.sin(theta) * (D / 2), zButee - Math.cos(theta) * (D / 2));
  for (const s of [-1, 1]) incl.add(boite([0.014, 0.004, D - 0.03], alu, [s * 0.105, -0.004, -0.005], { r: 0.0015 }));
  incl.updateMatrix();
  const versSupport = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(incl.matrix);
  support.add(incl);
  for (const s of [-1, 1]) {
    const arriere = versSupport(s * 0.105, -0.004, -D / 2 + 0.022);
    const avant = versSupport(s * 0.105, -0.004, D / 2 - 0.025);
    support.add(
      boite([0.014, arriere.y, 0.012], alu, [arriere.x, 0, arriere.z], { r: 0.002 }),
      boite([0.014, avant.y, 0.01], alu, [avant.x, 0, avant.z], { r: 0.002 }),
      boite([0.014, 0.004, zButee - arriere.z + 0.008], alu, [s * 0.105, 0, (arriere.z + zButee) / 2 + 0.004], { r: 0.0015 }),
    );
    if (s === 1) support.add(boite([0.224, 0.004, 0.012], alu, [0, 0, arriere.z], { r: 0.0015 }));
  }
  support.add(boite([0.24, 0.024, 0.008], alu, [0, 0, zButee + 0.004], { r: 0.003 }), boite([0.236, 0.003, 0.008], m.noirMat, [0, 0.024, zButee + 0.004], { r: 0.0012 }));
  return { support, incl };
}

// L'iPad Pro 11 pouces (249,7 × 177,5 × 5,3 mm), argent, sans coque, posé à plat écran en l'air (éteint),
// et son Apple Pencil Pro blanc aimanté sur la grande tranche du haut. Origine : le centre du dessous.
function ipadPro(m) {
  const [W, D, E, R] = [0.2497, 0.1775, 0.0053, 0.017];
  const el = [];
  const plaque = (w, d, r, ep, mat, y) => {
    const g = new THREE.ExtrudeGeometry(rectArrondi(new THREE.Shape(), -w / 2, -d / 2, w / 2, d / 2, r), { depth: ep, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-PI / 2);
    g.translate(0, y, 0);
    return ombres(new THREE.Mesh(g, mat));
  };
  el.push(plaque(W, D, R, E - 0.0003, m.metalClair, 0)); // le châssis en aluminium argenté, comme le Mac
  el.push(plaque(W - 0.0045, D - 0.0045, R - 0.002, 0.0006, m.uni('#121117'), E - 0.0006)); // la vitre noire (un liseré d'aluminium autour)
  el.push(plaque(W - 0.013, D - 0.013, R - 0.006, 0.0002, mat('ecran-ipad', '#1b1b24', { roughness: 0.18 }), E - 0.0001)); // la dalle, éteinte
  el.push(cylindre(0.0028, 0.0002, m.uni('#24232b'), [0, E - 0.0001, -D / 2 + 0.0032], { segments: 10 })); // la caméra avant (sur le long côté)
  el.push(boite([0.018, 0.0018, 0.0012], m.metal, [W / 2 - 0.03, 0.0025, -D / 2 - 0.0004], { r: 0.0005 })); // le bouton du haut
  for (const z of [-0.06, -0.04]) el.push(boite([0.0012, 0.0018, 0.014], m.metal, [W / 2 + 0.0004, 0.0025, z], { r: 0.0005 })); // le volume
  // l'Apple Pencil Pro : un crayon blanc à méplat, sa pointe
  const L = 0.166;
  const crayon = new THREE.Group();
  crayon.add(cylindre(0.0089, L - 0.02, m.uni('#f6f6f4'), [0, 0, 0], { rot: [0, 0, PI / 2], centre: true, segments: 18 }));
  crayon.add(cylindre(0.0089, 0.02, m.uni('#f6f6f4'), [L / 2, 0, 0], { rot: [0, 0, PI / 2], centre: true, dBas: 0.002, segments: 18 }));
  crayon.add(cylindre(0.0021, 0.004, m.uni('#e4e5e8'), [L / 2 + 0.011, 0, 0], { rot: [0, 0, PI / 2], centre: true, segments: 8 }));
  crayon.position.set(-0.01, 0.00445, -D / 2 - 0.0046);
  el.push(crayon);
  return groupe('objet_ipad', el);
}

// Un cahier ouvert (A5, couverture lilas) : deux pages qui se bombent vers la reliure, des lignes bleu pâle et
// une marge rose, quelques lignes d'écriture à gauche, un stylo noir posé sur la page de droite. La reliure est
// le long de z ; on lit depuis +z. Origine : le centre du dessous.
function cahier(m) {
  const [WP, DP] = [0.146, 0.205]; // une page
  const el = [];
  el.push(boite([2 * WP + 0.006, 0.0015, DP + 0.006], m.uni('#cdbfe6'), [0, 0, 0], { r: 0.001 })); // la couverture
  const hPage = (u) => 0.0035 + 0.0045 * Math.max(0, 1 - u / 0.05) ** 2; // u : la distance à la reliure
  const papier = m.uni('#fbf9f4');
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(WP, DP, 18, 1);
    g.rotateX(-PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + WP / 2; // de la reliure (0) au bord (WP)
      pos.setXYZ(i, s * (u + 0.001), hPage(u), pos.getZ(i));
    }
    g.computeVertexNormals();
    const page = ombres(new THREE.Mesh(g, papier));
    page.material.side = THREE.DoubleSide;
    el.push(page);
    // le bloc des feuilles en dessous (la tranche)
    el.push(boite([WP - 0.002, 0.0028, DP - 0.002], m.uni('#f1ede4'), [s * (WP / 2 + 0.001), 0.0012, 0], { r: 0 }));
    // les lignes (le long de x) et la marge
    const ligne = (z, couleur, r = 0.00025) => el.push(tube([0.004, 0.03, 0.07, 0.11, WP - 0.004].map((u) => [s * (u + 0.001), hPage(u) + 0.0003, z]), r, m.uni(couleur), 12));
    for (let k = 0; k < 22; k++) ligne(-DP / 2 + 0.02 + k * 0.008, '#c4d6ea');
    const xm = s > 0 ? 0.025 : WP - 0.025;
    el.push(boite([0.0006, 0.0002, DP - 0.004], m.uni('#efb3c3'), [s * (xm + 0.001), hPage(xm) + 0.0003, 0], { r: 0 }));
  }
  // quelques lignes d'écriture sur la page de gauche
  const alea = hasard(17);
  const encre = m.uni('#3c4a6b');
  for (let k = 0; k < 9; k++) {
    const z = -DP / 2 + 0.02 + (k + 1) * 0.008 - 0.0015;
    const u0 = 0.02;
    const u1 = 0.02 + (0.06 + alea() * 0.06) * (k === 8 ? 0.5 : 1);
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const u = WP - (u0 + (u1 - u0) * t); // de la marge vers la reliure
      pts.push([-(u + 0.001), hPage(u) + 0.0004, z - 0.0012 * Math.abs(Math.sin(t * 60 + k))]);
    }
    el.push(tube(pts, 0.00028, encre, 48));
  }
  // le stylo, en travers de la page de droite
  const stylo = new THREE.Group();
  stylo.add(cylindre(0.0095, 0.12, m.uni('#2d2c35'), [0, 0, 0], { rot: [0, 0, PI / 2], centre: true, segments: 14 }));
  stylo.add(cylindre(0.0095, 0.014, m.uni('#2d2c35'), [0.067, 0, 0], { rot: [0, 0, PI / 2], centre: true, dBas: 0.002, segments: 14 }));
  stylo.add(boite([0.04, 0.0016, 0.003], m.metalClair, [-0.035, 0.005, 0], { r: 0.0006 })); // l'agrafe
  stylo.position.set(0.075, hPage(0.075) + 0.005, 0.01);
  stylo.rotation.y = 0.6;
  el.push(stylo);
  return groupe('objet_cahier', el);
}

// Trois livres empilés, dos tourné vers la pièce (+z) : couvertures, bloc de pages crème, une bande sur le dos.
function piledeLivres(m) {
  const livres = [
    { t: [0.235, 0.032, 0.17], c: '#ede7db', bande: '#d4524d', rot: 0.04 },
    { t: [0.225, 0.024, 0.162], c: '#c9ccd3', bande: '#f7f6f2', rot: -0.06 },
    { t: [0.205, 0.02, 0.15], c: '#a8c3a2', bande: '#f1ede2', rot: 0.03 },
  ];
  const el = [];
  let y = 0;
  for (const { t: [L, H, P], c, bande, rot } of livres) {
    const g = new THREE.Group();
    const cou = m.uni(c);
    g.add(boite([L, 0.002, P], cou, [0, 0, 0], { r: 0.0008 }), boite([L, 0.002, P], cou, [0, H - 0.002, 0], { r: 0.0008 }));
    g.add(boite([L, H, 0.003], cou, [0, 0, P / 2 - 0.0015], { r: 0.001 })); // le dos
    g.add(boite([L - 0.006, H - 0.004, P - 0.006], m.uni('#f4efe3'), [0, 0.002, -0.0015], { r: 0 })); // les pages
    g.add(boite([L * 0.55, H * 0.4, 0.0006], m.uni(bande), [-L * 0.12, H * 0.3, P / 2 + 0.0003], { r: 0 })); // la bande du dos
    g.position.y = y;
    g.rotation.y = rot;
    el.push(g);
    y += H;
  }
  return { groupe: groupe('objet_livres', el), haut: y };
}

// La lampe champignon (30 cm), d'après ta photo : un pied cylindrique en pierre beige mat, aux arêtes adoucies, et
// un globe de verre opalin bombé comme un coussin, deux fois plus large que le pied, avec un léger creux sur le
// dessus. Le verre est d'un matériau à part, « champignon-verre », que le programme allume (une lueur orangée).
// Origine : le dessous du pied, au centre.
function lampeChampignon(m) {
  const el = [];
  const HP = 0.155; // la hauteur du pied
  el.push(revolution([[0, 0], [0.054, 0], [0.0575, 0.004], [0.0575, HP - 0.004], [0.0545, HP], [0, HP]], mat('pierre-beige', '#d8cbb8', { roughness: 0.95 }), [0, 0, 0], 40));
  // le globe : son profil, du dessous (posé sur le pied) au creux du dessus, en passant par le grand bord arrondi
  const profil = [[0, 0], [0.05, 0], [0.085, 0.008], [0.105, 0.025], [0.117, 0.05], [0.121, 0.075], [0.117, 0.1], [0.105, 0.122], [0.085, 0.136], [0.055, 0.143], [0.025, 0.141], [0.008, 0.137], [0, 0.137]];
  el.push(revolution(profil, mat('champignon-verre', '#f7f3ec', { roughness: 0.5 }), [0, HP - 0.002, 0], 56));
  return groupe('objet_champignon', el);
}

function bureauStudio() {
  const m = creerMateriaux();
  const T = 0.756;
  const parts = [veinerBois(bureauNu())];
  // le sous-main : un grand tapis de bureau (106 × 49,5 cm : pas plus grand, l'image n'a que 736 points de large)
  // imprimé de ton plan bleu « Get task done more better » (public/textures/sous-main-plan.jpg, recadré par le haut
  // pour garder la graduation du bas), sous tout ce qui est posé sur le bureau ; bordure cousue bleu nuit
  const [LS, PS] = [1.06, 0.495];
  const sousMain = tapisDeSouris(m, LS, PS, { image: 'sous-main-plan', objet: 'objet_sous_main', bord: '#0b2a4f', auRas: true });
  sousMain.position.y = T; // posé sur le verre
  parts.push(sousMain);
  // ce qui est posé dessus : sur l'image, qui est la surface du tapis (4 mm), avec un demi-millimètre de marge
  const TS = T + 0.004 + 0.0005;
  // le MacBook sur son support, à gauche, tourné un peu vers le milieu
  const { support, incl } = supportIncline(m, 0.215);
  incl.add(macbook(m, 0, 0, 0)[0]);
  support.position.set(-0.39, TS, -0.03);
  support.rotation.y = 0.12;
  parts.push(support);
  // le cahier ouvert, au milieu (l'iPad est sur la console du lit)
  const c = cahier(m);
  c.position.set(0.06, TS, 0.12);
  c.rotation.y = 0.08;
  parts.push(c);
  // dans le coin à droite du sous-main : la lampe champignon au fond, la pile de livres devant elle (tout entières
  // dessus, à 2 cm de son bord)
  const { groupe: livres } = piledeLivres(m);
  livres.position.set(0.39, TS, 0.13);
  livres.rotation.y = -0.08;
  parts.push(livres);
  const lampe = lampeChampignon(m);
  lampe.position.set(0.45, TS, -0.14);
  parts.push(lampe);
  // son cordon : du dos du pied au bord arrière du sous-main, il descend sur le verre, puis tombe derrière le bureau
  parts.push(tube([[0.45, TS + 0.012, -0.197], [0.452, TS + 0.0025, -0.222], [0.455, TS + 0.0025, -0.24], [0.457, T + 0.0028, -0.262], [0.46, T + 0.0028, -0.29], [0.462, T - 0.02, -0.303], [0.465, 0.4, -0.304], [0.47, 0.01, -0.304]], 0.0022, m.uni('#f4f2ee'), 40));
  return groupe('bureau', parts);
}

// ===========================================================================================
// --- Les tatamis (des « oki-tatami » à poser, 1,2 cm d'épaisseur), côte à côte du mur ouest au mur est ---
// Chacun : la natte de jonc vert paille et son tressage (de fines lignes le long du grand côté), le liseré sombre
// (heri) sur les deux grands côtés, les petits côtés nus. Le liseré déborde d'un millimètre de la natte (sur la
// tranche et aux bouts) : sinon leurs faces sont dans le même plan et scintillent.
// Origine : le centre du champ de tatamis, au sol ; les grands côtés le long de z.
//   nb : le nombre de tatamis ; L : la largeur du champ (x) ; P : la longueur d'un tatami (z)
// ===========================================================================================
function tatami({ nb = 4, L = 3.575, P = 1.58 } = {}) {
  const m = creerMateriaux();
  const W = L / nb; // la largeur d'un tatami
  const E = 0.012;
  const natte = mat('jonc', '#c3c393', { roughness: 1 });
  const fibre = m.uni('#adb07e');
  const fibreClaire = m.uni('#d2d1a4');
  const heri = m.uni('#3a3c35');
  const el = [];
  for (let i = 0; i < nb; i++) {
    const cx = -L / 2 + W / 2 + i * W;
    el.push(boite([W - 0.006, E, P - 0.002], natte, [cx, 0, 0], { r: 0.002 }));
    // le tressage : une ligne toutes les 9 mm, une sur trois plus claire
    for (let k = 0; k * 0.009 < W - 0.08; k++) {
      const x = cx - W / 2 + 0.04 + k * 0.009;
      el.push(boite([0.0018, 0.0003, P - 0.01], k % 3 ? fibre : fibreClaire, [x, E, 0], { r: 0 }));
    }
    // le liseré des grands côtés, un peu en relief, qui recouvre la tranche de la natte
    for (const c of [-1, 1]) el.push(boite([0.03, E + 0.0012, P], heri, [cx + c * (W / 2 - 0.0165), 0, 0], { r: 0.002 }));
  }
  return groupe('tatami', el);
}

// ===========================================================================================
// --- La console du lit : un bureau bas (208 × 31 cm, dessus à 34 cm comme le retour) le long du lit ---
// Même chêne et même construction que les bureaux bas (structureBois), trois lames, et une paire de pieds de plus
// au milieu (il est long). Son devant dépasse sur les tatamis : les pieds de devant y sont posés, 1,2 cm plus
// courts que ceux de derrière (sur le parquet). Origine : le centre au sol ; le devant vers +z.
// ===========================================================================================
function consoleLit() {
  const m = creerMateriaux();
  const [L, P, T, ep] = [2.08, 0.31, 0.34, 0.026];
  const TATAMI = 0.012;
  const parts = structureBois(m, { L, P, T, ep, lames: 3, noeuds: [[-0.6, 0.04, 0.3, 0.8], [0.45, -0.05, -0.2, 0.7]], graine: 23, solAvant: TATAMI });
  const pz = P / 2 - 0.055;
  for (const sz of [-1, 1]) {
    const sol = sz > 0 ? TATAMI : 0;
    parts.push(boite([0.042, T - ep - 0.006 - sol, 0.042], m.uni(CHENE.pieds), [0, 0.006 + sol, sz * pz], { r: 0.004 }), cylindre(0.034, 0.006, m.uni('#d8d0c4'), [0, sol, sz * pz], { segments: 10 }));
  }
  // l'iPad, posé au bout côté oreillers (la tête du lit est vers −x ici : la console est tournée d'un demi-tour)
  const ipad = ipadPro(m);
  ipad.position.set(-0.77, T + 0.001, 0.01);
  ipad.rotation.y = 0.08;
  parts.push(ipad);
  // ta 3DS, ouverte, juste à côté de l'iPad (vers le pied du lit), tournée vers la pièce
  const n3ds = nintendo3ds(m);
  n3ds.position.set(-0.53, T + 0.001, 0.01);
  n3ds.rotation.y = -0.12;
  parts.push(n3ds);
  return groupe('console-lit', parts);
}

// ===========================================================================================
// --- Le sac à dos Arc'teryx Mantis 26, noir (47,5 × 27,5 cm, d'après les fiches des revendeurs), adossé ---
// Le corps : un pavé souple aux angles très arrondis, qui s'affine vers le haut et se bombe en bas de la face avant
// (une coupe en super-ellipse, le haut en dôme). Devant : la grande poche bordée de deux zips qui descendent le long
// des côtés et s'incurvent vers le bas, leurs tirettes en haut, la couture du rabat du haut, et l'archæoptéryx brodé
// en fil doré (un décalque tracé d'après ta photo : public/textures/logo-arcteryx.png, maillage « logo-arcteryx »).
// Dessus, la poignée. Sur les côtés, les poches en maille. Au dos : le panneau rembourré en maille, les deux
// bretelles en S avec leur sangle de poitrine et leurs sangles de réglage qui pendent, le petit logo brodé en haut.
// Posé : il penche de 9° en arrière, son dos appuyé sur le cadre du lit, au pied. Origine : au sol, sous l'arête
// arrière du bas (le pivot) ; la face avant vers +z.
// ===========================================================================================
function sacMantis() {
  const m = creerMateriaux();
  const nylon = mat('nylon-noir', '#3b3a45', { roughness: 0.78 }); // le noir du sac, adouci comme les autres noirs du site
  const nylonSombre = m.uni('#22212a');
  const maille = mat('maille-sac', '#45444f', { roughness: 0.95 });
  const sangle = m.uni('#2a2932');
  const H = 0.475;
  const W = (v) => 0.1375 - 0.016 * v; // la demi-largeur
  const Df = (v) => 0.062 + 0.042 * Math.sin(PI * Math.min(1, v * 1.12)); // la face avant, bombée en bas
  const Db = () => 0.062; // le dos, plat
  const n = 3.2; // la super-ellipse de la coupe
  const reduc = (v) => (v > 0.8 ? Math.sqrt(1 - 0.55 * ((v - 0.8) / 0.2) ** 2) : v < 0.05 ? Math.sqrt(1 - 0.2 * ((0.05 - v) / 0.05) ** 2) : 1);
  const HC = H - 0.05; // le haut des côtés ; le dôme monte au-dessus
  // un point du sac : a, b dans [−1, 1] autour de la coupe (b > 0 : devant), v de 0 (bas) à 1 (haut des côtés)
  const point = (a, b, v, rCap = 1, y = null) => {
    const mm = Math.max(Math.abs(a), Math.abs(b));
    const k = mm > 0 ? mm / (Math.abs(a) ** n + Math.abs(b) ** n) ** (1 / n) : 0;
    const s = reduc(v) * rCap;
    return new THREE.Vector3(a * k * W(v) * s, y ?? v * HC, b * k * (b > 0 ? Df(v) : Db(v)) * s);
  };
  // le corps : une boîte subdivisée, posée sur la super-ellipse ; ses faces du haut et du bas deviennent le dôme et le fond
  const geo = new THREE.BoxGeometry(1, 1, 1, 26, 34, 18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [a, yy, b] = [pos.getX(i) * 2, pos.getY(i) + 0.5, pos.getZ(i) * 2];
    const mm = Math.max(Math.abs(a), Math.abs(b));
    let p;
    if (yy > 0.999) p = point(a, b, 1, 1, HC + 0.05 * (1 - mm * mm)); // le dôme
    else if (yy < 0.001) p = point(a, b, 0, 1, 0.006 * (1 - mm * mm)); // le fond, à peine bombé
    else p = point(a / Math.max(mm, 1e-6), b / Math.max(mm, 1e-6), yy);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const sac = new THREE.Group();
  sac.add(ombres(new THREE.Mesh(geo, nylon)));
  // un point juste devant la face avant (pour y poser les zips, les coutures, le logo)
  const devant = (a, v, ecart = 0.0025) => {
    const p0 = point(a, 1, v);
    const p1 = point(a + 0.01, 1, v);
    const p2 = point(a, 1, v + 0.01);
    const nrm = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0)).normalize();
    if (nrm.z < 0) nrm.negate();
    return { p: p0.clone().addScaledVector(nrm, ecart), n: nrm };
  };
  const suivre = (cles, rayon, materiau, ecart = 0.0025) => {
    const courbe = new THREE.CatmullRomCurve3(cles.map(([a, v]) => devant(a, v).p));
    const pts = courbe.getSpacedPoints(60).map((q) => {
      // chaque point est reposé sur la face, à l'écart voulu
      const a = Math.max(-0.99, Math.min(0.99, q.x / (W(q.y / HC) * reduc(q.y / HC) * 0.97)));
      return devant(a, Math.max(0.01, Math.min(0.99, q.y / HC)), ecart).p;
    });
    return ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, rayon, 6), materiau));
  };
  // les deux zips de la poche avant : le long des côtés, puis en courbe vers le bas du milieu ; leur ruban, leurs dents
  for (const s of [-1, 1]) {
    const cles = [[0.7, 0.86], [0.86, 0.72], [0.88, 0.5], [0.84, 0.32], [0.66, 0.2], [0.42, 0.13], [0.22, 0.11]].map(([a, v]) => [s * a, v]);
    sac.add(suivre(cles, 0.0055, nylonSombre, 0.0015));
    sac.add(suivre(cles, 0.0022, m.uni('#121116'), 0.005));
    // la tirette : le curseur et son cordon à embout
    const t = devant(s * 0.7, 0.86, 0.006);
    sac.add(boite([0.012, 0.018, 0.006], m.uni('#18171c'), [t.p.x, t.p.y - 0.012, t.p.z], { r: 0.002 }));
    sac.add(tube([[t.p.x, t.p.y - 0.012, t.p.z + 0.002], [t.p.x + s * 0.008, t.p.y - 0.03, t.p.z + 0.006], [t.p.x + s * 0.006, t.p.y - 0.045, t.p.z + 0.004]], 0.0018, m.uni('#18171c'), 10));
    sac.add(cylindre(0.007, 0.012, m.uni('#18171c'), [t.p.x + s * 0.006, t.p.y - 0.058, t.p.z + 0.004], { segments: 8 }));
  }
  // la couture du rabat du haut
  sac.add(suivre([-0.85, -0.5, 0, 0.5, 0.85].map((a) => [a, 0.9 - 0.02 * (1 - a * a)]), 0.0012, nylonSombre, 0.001));
  // le logo brodé, un peu au-dessus du milieu de la poche
  {
    const { p, n: nrm } = devant(0, 0.77, 0.0012);
    const [lw, lh] = [0.066, 0.066 * (530 / 828)];
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), m.uni('#2c2b33'));
    plan.name = 'logo-arcteryx';
    plan.position.copy(p);
    plan.lookAt(p.clone().add(nrm));
    sac.add(plan);
  }
  // la poignée, sur le dessus, un peu vers le dos : une sangle plate en boucle basse, cousue au dôme par deux pattes
  // (la hauteur du dôme en (x, z) se calcule comme le corps : la super-ellipse réduite du haut)
  const surDome = (x, z) => {
    const sv = reduc(1);
    const mm = (Math.abs(x / (W(1) * sv)) ** n + Math.abs(z / ((z > 0 ? Df(1) : Db()) * sv)) ** n) ** (1 / n);
    return HC + 0.05 * (1 - Math.min(1, mm) ** 2);
  };
  const zP = -0.012;
  const [yG, yD] = [surDome(-0.032, zP), surDome(0.032, zP)];
  const yMilieu = surDome(0, zP);
  sac.add(tube([[-0.032, yG + 0.002, zP], [-0.026, yMilieu + 0.014, zP], [0, yMilieu + 0.02, zP], [0.026, yMilieu + 0.014, zP], [0.032, yD + 0.002, zP]], 0.0045, sangle, 30));
  for (const [x, y] of [[-0.034, yG], [0.034, yD]]) sac.add(boite([0.018, 0.005, 0.024], sangle, [x, y - 0.003, zP], { r: 0.002, rot: [0, 0, x > 0 ? -0.35 : 0.35] }));
  // les poches latérales en maille
  for (const s of [-1, 1]) {
    const pl = point(s, 0, 0.2);
    sac.add(tissu([0.018, 0.13, 0.11], maille, [pl.x - s * 0.002, 0.03, -0.005], { r: 0.008, froissement: 0.003, graine: 3 + s }));
  }
  // le dos : le panneau rembourré en maille, les bretelles, la sangle de poitrine, le petit logo
  const zDos = -Db() - 0.006;
  sac.add(boite([0.2, 0.3, 0.014], maille, [0, 0.05, zDos], { r: 0.006 })); // (il s'arrête sous le dôme du haut)
  for (const s of [-1, 1]) {
    const pts = [[s * 0.045, H - 0.085], [s * 0.06, H - 0.15], [s * 0.08, H - 0.24], [s * 0.097, 0.16], [s * 0.11, 0.06]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      sac.add(barrePlate([x0, y0, zDos - 0.02], [x1, y1, zDos - 0.02], [0.016, 0.052], nylon, 0.007));
    }
    sac.add(barrePlate([s * 0.115, 0.06, zDos - 0.018], [s * 0.125, 0.02, zDos - 0.012], [0.006, 0.025], sangle, 0.002)); // l'attache basse
    sac.add(tube([[s * 0.128, 0.025, zDos - 0.01], [s * 0.15, 0.015, zDos + 0.02], [s * 0.16, 0.004, zDos + 0.06]], 0.003, sangle, 12)); // la sangle qui pend
    sac.add(boite([0.022, 0.012, 0.006], m.uni('#18171c'), [s * 0.085, H - 0.23, zDos - 0.034], { r: 0.002 })); // la boucle de poitrine
  }
  sac.add(boite([0.15, 0.016, 0.004], sangle, [0, H - 0.226, zDos - 0.032], { r: 0.001 })); // la sangle de poitrine
  {
    const plan = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04 * (530 / 828)), m.uni('#3a3942'));
    plan.name = 'logo-arcteryx';
    plan.position.set(0, H - 0.075, zDos - 0.0075);
    plan.rotation.y = PI;
    sac.add(plan);
  }
  // posé : le dos (bretelles comprises) au-dessus du pivot, penché de 9° en arrière
  const dos = zDos - 0.03;
  sac.position.z = -dos;
  const penche = new THREE.Group();
  penche.rotation.x = -0.16;
  penche.add(sac);
  return groupe('objet_sac', penche);
}

// ===========================================================================================
// --- Le Macintosh Plus (1986), posé par terre à gauche du bureau du studio, d'après ta photo ---
// 24,6 × 34,5 × 27,6 cm, en plastique beige platine. Devant : le cadre de l'écran aux arêtes adoucies, l'écran au
// fond d'un entonnoir incliné, la vitre cathodique bombée (éteinte : il est par terre, débranché) ; la fente de la
// disquette avec son élargissement et le trou d'éjection ; la pomme arc-en-ciel et « Macintosh Plus » ; le menton
// en retrait avec les icônes de luminosité et du clavier, et la prise du clavier. Derrière : la poignée creusée
// sous le haut, les ouïes d'aération (il n'a pas de ventilateur : l'air passe par le dessus et le dos), les prises
// (souris, lecteur externe, SCSI, imprimante, modem, son), l'interrupteur et la prise secteur. Sur le flanc
// gauche, le petit bouton « reset / interrupt ». La coque s'affine un peu vers l'arrière.
// Les marquages sont des décalques (maillages « macplus-marque » et « macplus-icones », images
// public/textures/macplus-*.png collées par le programme). Origine : le centre du dessous ; l'avant vers +z.
// ===========================================================================================
function macPlus() {
  const [W, H, D] = [0.246, 0.345, 0.276];
  const zF = D / 2; // la face avant du cadre
  const EB = 0.028; // la profondeur du cadre
  const yC = 0.052; // le haut du menton (le bas du cadre)
  const beige = mat('macplus-beige', '#ddd6c4', { roughness: 0.55 });
  const beigeFonce = mat('macplus-beige-fonce', '#cbc3af', { roughness: 0.6 });
  const biseau = mat('macplus-biseau', '#d3ccb9', { roughness: 0.6, side: THREE.DoubleSide });
  const noir = mat('macplus-noir', '#2a2824', { roughness: 0.7 });
  const grille = mat('macplus-ouies', '#6a645a', { roughness: 0.8 });
  const metal = mat('macplus-metal', '#b4b6b9', { roughness: 0.35, metalness: 0.6 });
  const el = [];

  // — la coque arrière, qui s'affine vers le dos (x −4 %, y −2,5 %) —
  const zB0 = zF - EB + 0.004; // l'avant de la coque, caché dans le cadre
  const affine = (z) => {
    const t = Math.min(1, Math.max(0, (zB0 - z) / (zB0 + D / 2)));
    return [1 - 0.04 * t, 1 - 0.025 * t];
  };
  // d'un seul tenant : son profil de côté (avec l'encoche de la poignée sous le haut du dos) extrudé sur la
  // largeur, les arêtes arrondies
  const wC = (W - 0.006) / 2;
  {
    const bc = 0.004;
    const [zA0, zA1] = [-D / 2 + bc, zB0 - bc];
    const [yA0, yA1] = [0.004 + bc, H - 0.003 - bc];
    const yP0 = H - 0.076 + bc; // le bas de l'encoche
    const yP1 = H - 0.035 - bc; // le haut de l'encoche (le dessous du rebord)
    const profil = new THREE.Shape([[zA1, yA0], [zA1, yA1], [zA0, yA1], [zA0, yP1], [zA0 + 0.03, yP1], [zA0 + 0.03, yP0], [zA0, yP0], [zA0, yA0]].map(([u, v]) => new THREE.Vector2(u, v)));
    const g = new THREE.ExtrudeGeometry(profil, { depth: 2 * wC - 2 * bc, bevelEnabled: true, bevelThickness: bc, bevelSize: bc, bevelSegments: 3, curveSegments: 4 });
    g.rotateY(-PI / 2); // le profil passe dans le plan (z, y), l'épaisseur le long de x
    g.computeBoundingBox();
    g.translate(-(g.boundingBox.min.x + g.boundingBox.max.x) / 2, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [kx, ky] = affine(p.getZ(i));
      p.setXY(i, p.getX(i) * kx, p.getY(i) * ky);
    }
    g.computeVertexNormals();
    el.push(ombres(new THREE.Mesh(g, beige)));
  }
  // un point de la coque à sa surface arrière ou sur le dessus, déformé comme elle
  const surCoque = (x, y, z) => {
    const [kx, ky] = affine(z);
    return [x * kx, y * ky, z];
  };

  // — le cadre de l'écran : une plaque aux arêtes adoucies, percée de l'ouverture de l'écran —
  const bs = 0.002; // le biseau du bord
  const forme = new THREE.Shape();
  {
    const [x0, x1, y0, y1, rb, rh] = [-W / 2 + bs, W / 2 - bs, yC + bs, H - bs, 0.004, 0.012];
    forme.moveTo(x0 + rb, y0);
    forme.lineTo(x1 - rb, y0);
    forme.quadraticCurveTo(x1, y0, x1, y0 + rb);
    forme.lineTo(x1, y1 - rh);
    forme.quadraticCurveTo(x1, y1, x1 - rh, y1);
    forme.lineTo(x0 + rh, y1);
    forme.quadraticCurveTo(x0, y1, x0, y1 - rh);
    forme.lineTo(x0, y0 + rb);
    forme.quadraticCurveTo(x0, y0, x0 + rb, y0);
  }
  const [oW, oH, oR, oY] = [0.212, 0.163, 0.014, 0.232]; // l'ouverture sur la face avant
  forme.holes.push(rectArrondi(new THREE.Path(), -oW / 2 - bs, oY - oH / 2 - bs, oW / 2 + bs, oY + oH / 2 + bs, oR + bs));
  const prof = EB - 2 * bs;
  const cadre = new THREE.ExtrudeGeometry(forme, { depth: prof, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 3, curveSegments: 12 });
  cadre.translate(0, 0, zF - prof - bs);
  el.push(ombres(new THREE.Mesh(cadre, beige)));

  // — l'entonnoir de l'écran : de l'ouverture (sur la face) à la vitre, 2,3 cm plus loin —
  const contour = (w, h, r, n = 8) => {
    const pts = [];
    const coins = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 0.5], [-w / 2 + r, -h / 2 + r, 1], [w / 2 - r, -h / 2 + r, 1.5]];
    for (const [cx, cy, a0] of coins) for (let k = 0; k <= n; k++) {
      const a = (a0 + (k / n) * 0.5) * PI;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  const [gW, gH, gR] = [0.19, 0.148, 0.02]; // la vitre
  const zV = zF - 0.024;
  {
    const a = contour(oW, oH, oR);
    const b = contour(gW, gH, gR);
    const pos = [];
    const n = a.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const [p0, p1, q0, q1] = [[...a[i], zF - 0.0008], [...a[j], zF - 0.0008], [...b[i], zV], [...b[j], zV]].map(([x, y, z]) => [x, y + oY, z]);
      pos.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    el.push(ombres(new THREE.Mesh(g, biseau)));
  }
  // la vitre : bombée de 5 mm, un peu plus grande que son ouverture (les coins sont cachés par l'entonnoir)
  {
    const g = new THREE.PlaneGeometry(gW + 0.006, gH + 0.006, 28, 22);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [x, y] = [p.getX(i) / (gW / 2), p.getY(i) / (gH / 2)];
      p.setZ(i, 0.005 * Math.max(0, 1 - x * x) * Math.max(0, 1 - y * y));
    }
    g.computeVertexNormals();
    const vitre = new THREE.Mesh(g, mat('verre-crt', '#4c4e48', { roughness: 0.1, metalness: 0.2 }));
    vitre.name = 'ecran-macplus';
    vitre.position.set(0, oY, zV - 0.0004);
    el.push(vitre);
  }

  // — la fente de la disquette, à droite sous l'écran : son lèvre en creux, la fente, l'élargissement, l'éjection —
  const yF = 0.11;
  el.push(boite([0.099, 0.011, 0.0014], beigeFonce, [0.047, yF - 0.0055, zF - 0.0004], { r: 0 }));
  el.push(boite([0.028, 0.014, 0.0016], biseau, [0.083, yF - 0.0072, zF - 0.0003], { r: 0 }));
  el.push(boite([0.094, 0.0042, 0.0018], noir, [0.047, yF - 0.0021, zF - 0.0002], { r: 0 }));
  el.push(boite([0.022, 0.0075, 0.0018], noir, [0.084, yF - 0.0045, zF - 0.0001], { r: 0 }));
  el.push(cylindre(0.0019, 0.0012, noir, [0.103, yF - 0.008, zF + 0.0001], { rot: [PI / 2, 0, 0], centre: true, segments: 10 }));
  // la marque : la pomme arc-en-ciel et « Macintosh Plus » (un décalque, posé à 0,4 mm de la face)
  const marque = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.024), mat('macplus-decalque', '#ddd6c4'));
  marque.name = 'macplus-marque';
  marque.position.set(-0.061, 0.106, zF + 0.0004);
  el.push(marque);

  // — le menton, en retrait de 1,2 cm sous le cadre : les icônes, la prise du clavier —
  const zM = zF - 0.012;
  el.push(boite([W - 0.01, yC - 0.004, 0.02], beige, [0, 0.004, zM - 0.01], { r: 0.003 }));
  const icones = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.052), mat('macplus-decalque', '#ddd6c4'));
  icones.name = 'macplus-icones';
  icones.position.set(0, 0.026, zM + 0.0004);
  el.push(icones);
  el.push(boite([0.017, 0.021, 0.0012], beigeFonce, [0.092, 0.0185, zM - 0.0002], { r: 0.0008 }));
  el.push(boite([0.0125, 0.0165, 0.0016], noir, [0.092, 0.0207, zM - 0.0002], { r: 0.0006 }));
  el.push(boite([0.006, 0.0025, 0.0018], beigeFonce, [0.092, 0.0337, zM - 0.0003], { r: 0 })); // l'encoche du clip
  for (let k = 0; k < 4; k++) el.push(boite([0.0008, 0.003, 0.0019], metal, [0.0882 + k * 0.0025, 0.0315, zM - 0.0004], { r: 0 })); // les contacts

  // — les patins —
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el.push(cylindre(0.018, 0.004, noir, [sx * 0.09, 0, sz * 0.1], { segments: 14 }));

  // — derrière (z = −D/2) : les ouïes sous la poignée, les prises, l'interrupteur et la prise secteur —
  const zA = -D / 2 - 0.0004;
  for (const cx of [-0.052, 0.052]) {
    for (let k = 0; k < 11; k++) {
      const [x, y] = surCoque(cx, H - 0.098 - k * 0.0095, -D / 2);
      el.push(boite([0.078, 0.0026, 0.0012], grille, [x, y, zA], { r: 0 }));
    }
  }
  const prise = (x, y, l, h, rond = false) => {
    const [px, py] = surCoque(x, y, -D / 2);
    if (rond) {
      el.push(cylindre(h + 0.004, 0.0014, metal, [px, py, zA + 0.0002], { rot: [PI / 2, 0, 0], centre: true, segments: 18 }));
      el.push(cylindre(h, 0.0016, noir, [px, py, zA - 0.0002], { rot: [PI / 2, 0, 0], centre: true, segments: 18 }));
    } else {
      el.push(boite([l + 0.006, h + 0.005, 0.0014], metal, [px, py - (h + 0.005) / 2, zA + 0.0002], { r: 0.0012 }));
      el.push(boite([l, h, 0.0018], noir, [px, py - h / 2, zA - 0.0002], { r: 0.0015 }));
    }
  };
  // (vu de dos, de gauche à droite : son, modem, imprimante, SCSI, lecteur externe, souris ; le centre de la prise
  // modem et celui de la prise secteur sont repris dans MAC_DOS, pour brancher les câbles)
  prise(0.098, 0.045, 0, 0.0055, true);
  prise(0.078, 0.045, 0, 0.0105, true);
  prise(0.055, 0.045, 0, 0.0105, true);
  prise(0.012, 0.049, 0.05, 0.0085);
  prise(-0.045, 0.049, 0.038, 0.0085);
  prise(-0.085, 0.049, 0.019, 0.0085);
  // l'interrupteur à bascule et la prise secteur, en bas à gauche vu de dos (côté droit du Mac)
  {
    const [px, py] = surCoque(0.08, 0.1, -D / 2);
    el.push(boite([0.016, 0.022, 0.0016], noir, [px + 0.02, py - 0.011, zA], { r: 0.001 }));
    el.push(boite([0.011, 0.016, 0.004], mat('macplus-bascule', '#3a3732', { roughness: 0.5 }), [px + 0.02, py - 0.008, zA - 0.002], { r: 0.001, rot: [0.12, 0, 0] }));
    el.push(boite([0.03, 0.022, 0.0016], noir, [px - 0.012, py - 0.011, zA], { r: 0.0015 })); // la prise secteur
    for (const dx of [-0.007, 0, 0.007]) el.push(boite([0.0018, 0.006, 0.0018], metal, [px - 0.012 + dx, py - 0.003 + (dx ? 0 : -0.004), zA - 0.0003], { r: 0 }));
  }
  // — sur le dessus, devant la poignée : les fentes d'aération —
  for (let k = 0; k < 12; k++) {
    const z = -D / 2 + 0.045 + k * 0.0075;
    const [x, y] = surCoque(0, H - 0.003, z);
    el.push(boite([0.15 * affine(z)[0], 0.0008, 0.0022], grille, [x, y - 0.0004, z], { r: 0 }));
  }
  // — le petit bouton « reset / interrupt » sur le flanc gauche, en bas vers l'arrière —
  {
    const z = -0.075;
    const [kx] = affine(z);
    const x = -wC * kx - 0.002;
    el.push(boite([0.004, 0.045, 0.018], beige, [x, 0.028, z], { r: 0.0015 }));
    for (const y of [0.038, 0.058]) el.push(boite([0.004, 0.009, 0.01], beigeFonce, [x - 0.0015, y, z], { r: 0.0012 }));
  }
  return groupe('macintosh-plus', el);
}

// ===========================================================================================
// --- Le mini-rack NAS (10 pouces, 13 U), par terre à gauche du Macintosh Plus, d'après ta photo ---
// Tout en beige platine, comme le Macintosh Plus à côté (ses teintes mêmes). Un cadre ouvert (quatre montants, deux
// plateaux, des patins) et, de haut en bas : le panneau de brassage aux câbles bleus, la tablette des deux petits
// switchs, la passerelle ; un cache ; la tablette du petit boîtier, du boîtier argent et du Raspberry Pi dans son boîtier ; un cache ; la tablette des deux mini-PC ; le panneau de
// ventilation (deux ventilateurs, l'écran de température) ; un cache ; l'onduleur et son afficheur ; la multiprise
// aux huit interrupteurs rouges allumés. Les câbles bleus passent en boucle devant les appareils.
// Dessus : le ThinkPad, ouvert, qui sert de console (son écran, « ecran-thinkpad-nas », montre un tableau de bord
// de supervision ; il se rabat au clic). Les deux afficheurs sont des maillages nommés (« rack-lcd-ventilo »,
// « rack-lcd-onduleur ») : le programme y colle leurs chiffres lumineux.
// Origine : le centre du dessous ; l'avant vers +z.
// ===========================================================================================
function rackNas() {
  const m = creerMateriaux();
  const el = [];
  const U = 0.04445;
  const NU = 13;
  const [WR, DR] = [0.27, 0.25];
  const XM = 0.118; // l'axe des montants (et des vis des panneaux)
  const yR0 = 0.024; // le bas des montants (au-dessus du plateau du bas)
  const yR1 = yR0 + NU * U; // leur haut
  const zP = DR / 2 + 0.002; // la face avant des panneaux
  // beige platine, comme le Macintosh Plus : le cadre dans le ton de son biseau, les façades dans le sien, les
  // façades foncées dans son beige foncé, les ouïes dans le gris-brun de ses ouïes
  const cadre = mat('rack-cadre', '#d3ccb9', { roughness: 0.55 });
  const panneau = mat('rack-panneau', '#ddd6c4', { roughness: 0.55 });
  const panneauFonce = mat('rack-panneau-fonce', '#cbc3af', { roughness: 0.6 });
  const trou = mat('rack-trou', '#121116', { roughness: 0.8 });
  const ouie = mat('rack-ouies', '#6a645a', { roughness: 0.8 });
  const vis = mat('rack-vis', '#c9ccd2', { roughness: 0.3, metalness: 0.7 });
  const argent = mat('rack-argent', '#c4c7cc', { roughness: 0.35, metalness: 0.5 });
  const bleuCable = mat('rack-cable-bleu', '#3e6fd0', { roughness: 0.45 });
  const led = (nom, c) => mat(nom, c, { emissive: c, emissiveIntensity: 1.6, roughness: 0.4 });
  const vert = led('rack-led-verte', '#4be37a');
  const bleu = led('rack-led-bleue', '#4ea4ff');
  const rouge = led('rack-led-rouge', '#ff4038');

  // — le cadre : deux plateaux, quatre montants, des traverses sur les côtés, quatre patins —
  el.push(boite([WR, 0.012, DR], cadre, [0, 0.012, 0], { r: 0.003 }));
  el.push(boite([WR, 0.012, DR], cadre, [0, yR1, 0], { r: 0.003 }));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      el.push(boite([0.018, yR1 - yR0, 0.018], cadre, [sx * XM, yR0, sz * (DR / 2 - 0.009)], { r: 0.002 }));
      el.push(cylindre(0.026, 0.012, m.noirMat, [sx * (WR / 2 - 0.025), 0, sz * (DR / 2 - 0.03)], { segments: 14 }));
    }
    for (const y of [yR0 + 0.004, yR1 - 0.02]) el.push(boite([0.012, 0.016, DR - 0.036], cadre, [sx * XM, y, 0], { r: 0.002 }));
  }
  // — un emplacement de n U, le k-ième depuis le haut : son bas et sa hauteur —
  const fente = (k, n = 1) => [yR1 - (k + n) * U, n * U];
  // une façade : la plaque (254 mm de large), ses oreilles vissées (deux vis de chaque côté)
  const facade = (k, n = 1, materiau = panneau) => {
    const [y0, h] = fente(k, n);
    el.push(boite([0.254, h - 0.0012, 0.0025], materiau, [0, y0 + 0.0006, zP - 0.00125], { r: 0.0012 }));
    for (const sx of [-1, 1]) for (const dy of n === 1 ? [h / 2] : [h * 0.25, h * 0.75]) {
      el.push(cylindre(0.0062, 0.0018, vis, [sx * XM, y0 + dy, zP + 0.0009], { rot: [PI / 2, 0, 0], centre: true, segments: 12 }));
      el.push(boite([0.0035, 0.0006, 0.0004], trou, [sx * XM, y0 + dy - 0.0003, zP + 0.0019], { r: 0 })); // la fente de la vis
    }
    return [y0, h];
  };
  // une tablette : une lèvre en bas de la façade, un plateau qui part vers l'arrière
  const tablette = (k, n) => {
    const [y0, h] = fente(k, n);
    el.push(boite([0.254, 0.012, 0.0025], panneau, [0, y0 + 0.0006, zP - 0.00125], { r: 0.001 }));
    el.push(boite([0.222, 0.0025, DR - 0.03], panneauFonce, [0, y0 + 0.004, -0.004], { r: 0.0008 }));
    for (const sx of [-1, 1]) el.push(cylindre(0.0062, 0.0018, vis, [sx * XM, y0 + 0.0066, zP + 0.0009], { rot: [PI / 2, 0, 0], centre: true, segments: 12 }));
    return [y0 + 0.0065, h];
  };
  // un port RJ45 sur une façade : le trou, et sa languette ; renvoie le point où se branche un câble
  const rj45 = (x, y) => {
    el.push(boite([0.0118, 0.0098, 0.0012], trou, [x, y - 0.0049, zP + 0.0001], { r: 0.0005 }));
    el.push(boite([0.004, 0.002, 0.0013], panneauFonce, [x, y + 0.0028, zP + 0.0002], { r: 0 }));
    return new THREE.Vector3(x, y, zP);
  };
  // un câble bleu branché : sa fiche (le manchon) et le câble qui part en boucle vers `fin`
  const cable = (a, fin, { bombe = 0.05, couleur = bleuCable, chute = 0, dx = 0 } = {}) => {
    el.push(boite([0.0118, 0.0095, 0.016], couleur, [a.x, a.y - 0.0047, a.z + 0.008], { r: 0.0015 }));
    const b = fin.clone();
    const pts = [a.clone().add(new THREE.Vector3(0, 0, 0.016)), a.clone().add(new THREE.Vector3(0, -0.006 - chute * 0.3, bombe * 0.6)),
      a.clone().lerp(b, 0.5).add(new THREE.Vector3(dx, -0.025 - chute, bombe)), b.clone().add(new THREE.Vector3(0, -0.004, bombe * 0.6)), b.clone().add(new THREE.Vector3(0, 0, 0.016))];
    el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0028, 7), couleur)));
    if (fin.userData?.fiche !== false) el.push(boite([0.0118, 0.0095, 0.016], couleur, [b.x, b.y - 0.0047, b.z + 0.008], { r: 0.0015 }));
  };
  // une grille d'aération : des fentes horizontales
  const ouies = (x, y, l, h, pas = 0.0042) => {
    for (let yy = y + pas / 2; yy < y + h - pas / 2; yy += pas) el.push(boite([l, 0.0017, 0.0008], ouie, [x, yy, zP + 0.0002], { r: 0 }));
  };
  // une grille de ventilateur : cercles concentriques et quatre bras
  const ventilo = (x, y, d) => {
    el.push(cylindre(d, 0.0008, trou, [x, y, zP + 0.0002], { rot: [PI / 2, 0, 0], centre: true, segments: 32 }));
    for (const k of [0.92, 0.72, 0.52, 0.32]) el.push(tore(d * k, 0.0011, panneau, [x, y, zP + 0.0009], [0, 0, 0]));
    for (let a = 0; a < 4; a++) el.push(boite([d * 0.98, 0.0014, 0.001], panneau, [x, y - 0.0007, zP + 0.0009], { r: 0, rot: [0, 0, (a * PI) / 4] }));
    el.push(cylindre(d * 0.22, 0.0016, panneau, [x, y, zP + 0.0011], { rot: [PI / 2, 0, 0], centre: true, segments: 20 }));
  };

  // 0 — le panneau de brassage : huit prises, quatre câbles bleus branchés à gauche
  const portsBrassage = [];
  {
    const [y0, h] = facade(0);
    for (let i = 0; i < 8; i++) portsBrassage.push(rj45(-0.083 + i * 0.0155, y0 + h / 2 + 0.004));
    for (let i = 0; i < 8; i++) el.push(boite([0.008, 0.0016, 0.0004], m.uni('#f4f1e8'), [-0.083 + i * 0.0155, y0 + h / 2 - 0.0098, zP + 0.0002], { r: 0 })); // les étiquettes
    el.push(boite([0.06, 0.012, 0.0006], panneauFonce, [0.07, y0 + h / 2 - 0.006, zP + 0.0002], { r: 0.0006 })); // le porte-étiquette
    el.push(sphere(0.0032, bleu, [0.108, y0 + h / 2, zP + 0.0008]));
  }
  // 1 — la tablette des deux petits switchs (cinq ports chacun, des témoins verts)
  const portsSwitch = [];
  {
    const [y, h] = tablette(1, 1);
    for (const cx of [-0.058, 0.058]) {
      el.push(boite([0.1, 0.026, 0.085], m.uni('#d6cfbc'), [cx, y, 0.06], { r: 0.003 }));
      for (let i = 0; i < 5; i++) {
        const x = cx - 0.035 + i * 0.016;
        el.push(boite([0.0118, 0.0095, 0.0012], trou, [x, y + 0.006, 0.1029], { r: 0.0005 }));
        portsSwitch.push(new THREE.Vector3(x, y + 0.0109, 0.1029)); // le centre de la prise
        el.push(boite([0.0022, 0.0015, 0.0006], vert, [x - 0.004, y + 0.019, 0.1029], { r: 0 }));
      }
    }
  }
  // 2 — la passerelle : le logo lumineux, deux ports SFP, huit ports, les témoins
  const portsPasserelle = [];
  {
    const [y0, h] = facade(2);
    const yc = y0 + h / 2;
    el.push(boite([0.052, 0.022, 0.0006], panneauFonce, [-0.07, yc - 0.011, zP + 0.0002], { r: 0.002 }));
    el.push(tore(0.0085, 0.0011, bleu, [-0.087, yc, zP + 0.0008], [0, 0, 0]));
    el.push(boite([0.0115, 0.0095, 0.0012], trou, [-0.068, yc - 0.0047, zP + 0.0001], { r: 0.0004 })); // l'USB
    for (const x of [-0.048, -0.034]) el.push(boite([0.012, 0.009, 0.0012], argent, [x, yc - 0.0045, zP + 0.0001], { r: 0.0004 })); // les SFP
    for (let i = 0; i < 8; i++) portsPasserelle.push(rj45(-0.012 + i * 0.0145, yc + 0.0045));
    for (let i = 0; i < 8; i++) el.push(boite([0.0024, 0.0014, 0.0006], vert, [-0.012 + i * 0.0145, yc - 0.0085, zP + 0.0002], { r: 0 }));
  }
  // les câbles : quatre du brassage vers les switchs (en boucle, à droite), quatre de la passerelle vers le
  // brassage ; un gris, un rouge et un vert courts
  for (let i = 0; i < 4; i++) cable(portsBrassage[i], portsSwitch[5 + i], { bombe: 0.024 + i * 0.004, chute: 0.003 * i });
  for (let i = 0; i < 4; i++) cable(portsPasserelle[2 + i], portsSwitch[i], { bombe: 0.02 + i * 0.003 });
  cable(portsBrassage[5], portsPasserelle[0], { bombe: 0.03, couleur: m.uni('#a9adb4'), dx: -0.05 });
  cable(portsSwitch[4], portsPasserelle[1], { bombe: 0.02, couleur: m.uni('#c9443d') });
  cable(portsSwitch[9], portsPasserelle[7], { bombe: 0.028, couleur: m.uni('#3fa45e') });

  // 3 — un cache
  facade(3);
  // 4-5 — la tablette du boîtier noir, du boîtier argent et du Raspberry Pi
  {
    const [y] = tablette(4, 2);
    el.push(boite([0.07, 0.03, 0.07], m.uni('#d9d2bf'), [-0.08, y, 0.045], { r: 0.008 })); // le petit boîtier
    el.push(boite([0.032, 0.0015, 0.0012], vert, [-0.08, y + 0.031, 0.08], { r: 0 }));
    el.push(boite([0.1, 0.034, 0.09], argent, [0.005, y, 0.035], { r: 0.012 })); // le boîtier argent
    el.push(boite([0.06, 0.012, 0.0012], m.uni('#1d1c22'), [0.005, y + 0.011, 0.0806], { r: 0.003 }));
    for (const dx of [-0.009, 0, 0.009]) el.push(sphere(0.0034, vert, [0.005 + dx, y + 0.017, 0.0812]));
    el.push(boite([0.062, 0.028, 0.09], m.uni('#d2cbb7'), [0.085, y, 0.03], { r: 0.004 })); // le Raspberry Pi, dans son boîtier
    el.push(sphere(0.0045, rouge, [0.105, y + 0.018, 0.0752]));
    for (const dx of [-0.018, -0.004]) el.push(boite([0.008, 0.0045, 0.0012], trou, [0.085 + dx, y + 0.008, 0.0751], { r: 0.0004 }));
    el.push(tube([[0.085, y + 0.012, -0.015], [0.085, y + 0.03, -0.03], [0.07, y + 0.02, -0.08], [0.06, y + 0.005, -0.1]], 0.0022, m.uni('#1e1d22'), 20)); // son câble
  }
  // 6 — un cache
  facade(6);
  // 7 — la tablette des deux mini-PC (l'un à liseré rouge et grille à droite, l'autre à grille)
  {
    const [y] = tablette(7, 1);
    for (const [cx, accent] of [[-0.058, false], [0.058, true]]) {
      el.push(boite([0.1, 0.034, 0.12], m.uni('#d6cfbc'), [cx, y, 0.04], { r: 0.003 }));
      const zf = 0.1003;
      el.push(cylindre(0.0055, 0.001, m.uni('#bdb5a0'), [cx - 0.04, y + 0.017, zf], { rot: [PI / 2, 0, 0], centre: true, segments: 14 }));
      el.push(sphere(0.002, bleu, [cx - 0.04, y + 0.017, zf + 0.0006]));
      for (const dx of [-0.027, -0.016]) el.push(boite([0.008, 0.0035, 0.0008], trou, [cx + dx, y + 0.015, zf], { r: 0.0003 })); // l'USB
      for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) el.push(cylindre(0.0022, 0.0008, ouie, [cx + 0.008 + c * 0.0042, y + 0.008 + r * 0.0055, zf], { rot: [PI / 2, 0, 0], centre: true, segments: 6 }));
      if (accent) el.push(boite([0.0035, 0.034, 0.0012], m.uni('#c3343c'), [cx + 0.0015, y, zf], { r: 0 }));
    }
  }
  // 8-9 — le panneau de ventilation : deux ventilateurs, l'écran de température, ses boutons
  {
    const [y0, h] = facade(8, 2);
    const yc = y0 + h / 2;
    ventilo(-0.07, yc, 0.075);
    ventilo(0.07, yc, 0.075);
    el.push(boite([0.06, 0.036, 0.0008], panneauFonce, [0, yc - 0.018, zP + 0.0002], { r: 0.002 }));
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.022), m.uni('#1b2a3a'));
    lcd.name = 'rack-lcd-ventilo';
    lcd.position.set(0, yc + 0.002, zP + 0.0011);
    el.push(lcd);
    for (const [dx, dy] of [[-0.026, 0.006], [-0.026, -0.004], [0.026, 0.006], [0.026, -0.004]]) el.push(boite([0.004, 0.0045, 0.0014], m.uni('#c3bba6'), [dx, yc + dy - 0.0022, zP + 0.0008], { r: 0.0008 }));
    el.push(boite([0.028, 0.0018, 0.0004], m.uni('#9a937f'), [0, yc - 0.0145, zP + 0.0008], { r: 0 })); // la marque
  }
  // 10 — un cache ajouré
  {
    const [y0, h] = facade(10);
    ouies(0, y0 + 0.008, 0.19, h - 0.016);
  }
  // 11 — l'onduleur : deux grilles, l'afficheur, le bouton rond
  {
    const [y0, h] = facade(11, 1, panneauFonce);
    const yc = y0 + h / 2;
    ouies(-0.075, y0 + 0.008, 0.075, h - 0.016);
    ouies(0.075, y0 + 0.008, 0.075, h - 0.016);
    el.push(boite([0.036, 0.022, 0.0008], m.uni('#18171c'), [-0.012, yc - 0.011, zP + 0.0002], { r: 0.0015 }));
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.016), m.uni('#1b2a3a'));
    lcd.name = 'rack-lcd-onduleur';
    lcd.position.set(-0.012, yc, zP + 0.0011);
    el.push(lcd);
    el.push(cylindre(0.012, 0.004, argent, [0.017, yc, zP + 0.002], { rot: [PI / 2, 0, 0], centre: true, segments: 20 }));
    el.push(tore(0.0125, 0.0007, bleu, [0.017, yc, zP + 0.0042], [0, 0, 0]));
  }
  // 12 — la multiprise : huit interrupteurs à bascule rouges, allumés
  {
    const [y0, h] = facade(12, 1, panneauFonce);
    const yc = y0 + h / 2;
    for (let i = 0; i < 8; i++) {
      const x = -0.0945 + i * 0.027;
      el.push(boite([0.012, 0.016, 0.0012], m.uni('#141318'), [x, yc - 0.008, zP + 0.0001], { r: 0.001 }));
      el.push(boite([0.009, 0.0125, 0.004], rouge, [x, yc - 0.006, zP + 0.0016], { r: 0.0012, rot: [-0.18, 0, 0] }));
    }
  }

  // — dessus : le ThinkPad, ouvert, la console du rack —
  const { groupe: tp } = thinkpad(m, { ecran: 'ecran-thinkpad-nas' });
  tp.position.set(0, yR1 + 0.012, 0.004);
  tp.rotation.y = -0.04;
  el.push(tp);
  return groupe('rack-nas', el);
}

// ===========================================================================================
// --- Le rack à vêtements, sous la pente à gauche de la TV (vu du lit), d'après ta photo d'inspiration ---
// Un portant chromé à roulettes, bas parce que le toit descend (le plafond n'est qu'à 1,03 m au pied du mur bas du
// sud) : la barre à 97 cm, 40 cm entre les deux montants (du bout du coffre de la TV au mur bas), parallèle au mur
// ouest. Les montants se courbent pour devenir la barre ; à leur pied, une traverse sur deux roulettes ; entre eux, un
// panier en fil chromé (un magazine, un pull plié). Sur la barre, cinq cintres en fil vides (les vêtements ont été
// retirés à ta demande ; pas de tote bag Arket non plus : il pendrait devant la TV).
// Origine : le milieu du dessous ; la barre suit z, les vêtements s'étalent sur x (vers la pièce).
// ===========================================================================================
function rackVetements() {
  const m = creerMateriaux();
  const chrome = mat('rack-chrome', '#e4e8eb', { roughness: 0.22, metalness: 0.65 });
  const fil = mat('rack-fil', '#d9dee2', { roughness: 0.3, metalness: 0.55 });
  const el = [];
  const [ZR, YR, R] = [0.2, 0.97, 0.0125]; // demi-écart des montants, hauteur de la barre, rayon des tubes
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // — les montants et la barre : un seul tube aux coins arrondis —
  {
    const k = 0.05;
    const c = new THREE.CurvePath();
    c.add(new THREE.LineCurve3(P(0, 0.07, -ZR), P(0, YR - k, -ZR)));
    c.add(new THREE.QuadraticBezierCurve3(P(0, YR - k, -ZR), P(0, YR, -ZR), P(0, YR, -ZR + k)));
    c.add(new THREE.LineCurve3(P(0, YR, -ZR + k), P(0, YR, ZR - k)));
    c.add(new THREE.QuadraticBezierCurve3(P(0, YR, ZR - k), P(0, YR, ZR), P(0, YR - k, ZR)));
    c.add(new THREE.LineCurve3(P(0, YR - k, ZR), P(0, 0.07, ZR)));
    el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(c, 140, R, 12), chrome)));
  }
  // — les pieds : une traverse sous chaque montant, son manchon, deux roulettes —
  const YP = 0.062;
  for (const s of [-1, 1]) {
    const z = s * ZR;
    el.push(barre([-0.24, YP, z], [0.24, YP, z], R, chrome, 12));
    for (const x of [-0.24, 0.24]) el.push(sphere(2 * R, chrome, [x, YP, z]));
    el.push(cylindre(0.032, 0.034, chrome, [0, YP - 0.006, z], { segments: 16 }));
    for (const x of [-0.205, 0.205]) {
      el.push(boite([0.02, 0.016, 0.026], chrome, [x, 0.036, z], { r: 0.003 })); // la chape
      el.push(cylindre(0.042, 0.016, m.uni('#3a3b40'), [x, 0.021, z], { rot: [PI / 2, 0, 0], centre: true, segments: 18 })); // la roue
      el.push(cylindre(0.02, 0.018, m.uni('#9a9ca2'), [x, 0.021, z], { rot: [PI / 2, 0, 0], centre: true, segments: 12 })); // son moyeu
    }
  }
  // — le panier en fil, entre les montants : le fond quadrillé, les côtés, deux rebords, ses attaches —
  {
    const [XP, ZP, Y0, Y1, rf] = [0.17, ZR - 0.022, 0.09, 0.2, 0.0016];
    for (let i = 0; i <= 10; i++) {
      const x = -XP + (i * 2 * XP) / 10;
      el.push(barre([x, Y0, -ZP], [x, Y0, ZP], rf, fil, 6));
      for (const z of [-ZP, ZP]) el.push(barre([x, Y0, z], [x, Y1, z], rf, fil, 6));
    }
    for (let j = 0; j <= 8; j++) {
      const z = -ZP + (j * 2 * ZP) / 8;
      el.push(barre([-XP, Y0, z], [XP, Y0, z], rf, fil, 6));
      for (const x of [-XP, XP]) el.push(barre([x, Y0, z], [x, Y1, z], rf, fil, 6));
    }
    for (const y of [Y0, Y1]) {
      const bord = [P(-XP, y, -ZP), P(XP, y, -ZP), P(XP, y, ZP), P(-XP, y, ZP)];
      bord.forEach((a, i) => el.push(barre(a.toArray(), bord[(i + 1) % 4].toArray(), 0.003, fil, 8)));
    }
    for (const s of [-1, 1]) el.push(barre([0, Y1, s * ZP], [0, Y1, s * (ZR - R)], 0.004, chrome, 8)); // les attaches aux montants
    // dedans : un magazine (sa couverture en noir et blanc) et un pull beige plié
    const mag = new THREE.Group();
    mag.add(boite([0.21, 0.007, 0.275], m.uni('#f2f1ed'), [0, 0, 0], { r: 0.001 }));
    mag.add(boite([0.17, 0.0004, 0.19], m.uni('#55565c'), [0.0, 0.007, -0.03], { r: 0 }));
    mag.add(boite([0.12, 0.0004, 0.018], m.uni('#1e1e22'), [0.0, 0.007, 0.1], { r: 0 }));
    mag.position.set(0.02, Y0 + 0.0025, -0.03);
    mag.rotation.set(0, 0.12, -0.04);
    el.push(mag);
    el.push(tissu([0.24, 0.05, 0.17], m.uni('#d8cfbf'), [-0.03, Y0 + 0.004, 0.06], { r: 0.02, froissement: 0.004, graine: 5 }));
  }

  // — les cintres en fil, vides (les vêtements ont été retirés) : le crochet par-dessus la barre, le col tordu, le
  // triangle ; un peu de travers, du nord (côté TV) au sud : [z, rotation autour de y]
  const cintre = () => [
    tube([[0, -0.046, 0], [-0.006, -0.026, 0], [-0.017, -0.003, 0], [-0.011, 0.013, 0], [0.003, 0.018, 0], [0.015, 0.009, 0], [0.017, -0.004, 0]], 0.0018, fil, 24),
    tube([[0, -0.046, 0], [0.002, -0.056, 0], [0.19, -0.098, 0], [0.2, -0.108, 0], [0.0, -0.11, 0], [-0.2, -0.108, 0], [-0.19, -0.098, 0], [-0.002, -0.056, 0], [0, -0.046, 0]], 0.0017, fil, 60),
  ];
  for (const [z, ry] of [[-0.145, 0.11], [-0.08, -0.1], [-0.022, 0.08], [0.04, -0.13], [0.115, 0.08]]) {
    const g = new THREE.Group();
    g.add(...cintre());
    g.position.set(0, YR, z);
    g.rotation.y = ry;
    el.push(g);
  }
  return groupe('rack-vetements', el);
}

// ===========================================================================================
// --- Le light stick officiel de KiiiKiii, d'après la photo produit (vue de face, fond blanc) ---
// Pas de cotes officielles trouvées : 25 cm de long pris comme hypothèse, tout le reste mesuré sur la photo
// (1 px ≈ 0,82 mm). Une étoile dodue (creux à 60 % du rayon, pointes arrondies) de 11,3 cm, en acrylique clair de
// 2,4 cm d'épaisseur au chant gris ; dedans, une fine plaque givrée en gradins cernés de liserés gris (l'étoile
// moyenne à 66 % et ses trois marches, la petite à 38 % et sa marche) ; la tige blanche qui descend dans l'étoile ; le col blanc et sa fente, ses deux pastilles
// grises ; le manche carré : en haut, le plastique givré bleuté où l'on devine l'électronique (et le bouton), un joint,
// en bas le capot des piles givré blanc, à fines stries. La breloque de la photo (en bas à droite) n'est pas faite.
// Posé à plat, l'étoile vers le haut, le manche vers +z. Toute l'étoile (matériaux « etoile-kiiikiii… ») s'allume au clic.
// Origine : sous le centre de l'étoile, sur la surface où il est posé.
// ===========================================================================================

// le contour d'une étoile à cinq branches (pointe vers +y) : dix sommets, chacun arrondi par un arc tangent à ses
// deux côtés (rp : rayon des pointes, rc : des creux)
function contourEtoile(RE, RI, rp, rc, n = 10) {
  const sommets = Array.from({ length: 10 }, (_, k) => {
    const a = PI / 2 + (k * PI) / 5;
    const r = k % 2 ? RI : RE;
    return new THREE.Vector2(r * Math.cos(a), r * Math.sin(a));
  });
  const contour = [];
  sommets.forEach((V, k) => {
    const A = sommets[(k + 9) % 10];
    const B = sommets[(k + 1) % 10];
    const u1 = A.clone().sub(V).normalize();
    const u2 = B.clone().sub(V).normalize();
    const alpha = Math.acos(u1.dot(u2)) / 2;
    const rf = k % 2 ? rc : rp;
    const d = rf / Math.tan(alpha);
    const C = V.clone().add(u1.clone().add(u2).normalize().multiplyScalar(rf / Math.sin(alpha)));
    const T1 = V.clone().add(u1.clone().multiplyScalar(d));
    const T2 = V.clone().add(u2.clone().multiplyScalar(d));
    const a1 = Math.atan2(T1.y - C.y, T1.x - C.x);
    let da = Math.atan2(T2.y - C.y, T2.x - C.x) - a1;
    while (da > PI) da -= 2 * PI;
    while (da < -PI) da += 2 * PI;
    for (let i = 0; i <= n; i++) contour.push(new THREE.Vector2(C.x + rf * Math.cos(a1 + (da * i) / n), C.y + rf * Math.sin(a1 + (da * i) / n)));
  });
  return contour;
}

// une ExtrudeGeometry coupée en deux : ses faces (groupe 0) et ses flancs avec le biseau (groupe 1)
function facesEtFlancs(geo) {
  return geo.groups.map(({ start, count }) => {
    const g = new THREE.BufferGeometry();
    for (const [nom, attr] of Object.entries(geo.attributes))
      g.setAttribute(nom, new THREE.BufferAttribute(attr.array.slice(start * attr.itemSize, (start + count) * attr.itemSize), attr.itemSize));
    return g;
  });
}

// la texture d'une face du manche : un givré, et ce qu'on devine derrière (dessiné flou)
function givreManche(haut) {
  const [L, H] = haut ? [128, 332] : [128, 284];
  const c = document.createElement('canvas');
  c.width = L;
  c.height = H;
  const g = c.getContext('2d');
  const fond = g.createLinearGradient(0, 0, L, 0);
  const [bord, milieu] = haut ? ['#f2f5f9', '#dde5ef'] : ['#f5f6f8', '#eceff3'];
  fond.addColorStop(0, bord);
  fond.addColorStop(0.5, milieu);
  fond.addColorStop(1, bord);
  g.fillStyle = fond;
  g.fillRect(0, 0, L, H);
  if (haut) {
    // la carte électronique et ses composants, flous, plus sombres au milieu ; une flèche nette sous le bouton
    g.filter = 'blur(7px)';
    g.fillStyle = '#cdd8e5';
    g.fillRect(L * 0.3, H * 0.12, L * 0.4, H * 0.8);
    for (const [x, y, r, coul] of [[0.5, 0.42, 15, '#a9b8ca'], [0.44, 0.5, 13, '#b3c1d2'], [0.56, 0.66, 17, '#b7c5d6'], [0.48, 0.8, 12, '#c3cfdc']]) {
      g.fillStyle = coul;
      g.beginPath();
      g.ellipse(L * x, H * y, r * 1.3, r, 0, 0, 2 * PI);
      g.fill();
    }
    g.filter = 'blur(1.5px)';
    g.strokeStyle = '#8f9aaa';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(L * 0.42, H * 0.3);
    g.lineTo(L * 0.5, H * 0.26);
    g.lineTo(L * 0.58, H * 0.3);
    g.stroke();
    // le haut, collé au col, reste blanc
    g.filter = 'blur(4px)';
    g.fillStyle = '#f4f6f9';
    g.fillRect(0, -10, L, H * 0.08 + 10);
  } else {
    // le capot des piles : fines stries verticales, une barre plus sombre au milieu (le contact), le fond plus clair
    g.filter = 'blur(1px)';
    for (let x = 18; x < L - 14; x += 9) {
      g.fillStyle = x % 2 ? '#dde2e9' : '#e4e8ed';
      g.fillRect(x, H * 0.08, 2.5, H * 0.84);
    }
    g.filter = 'blur(3px)';
    g.fillStyle = '#c9d1db';
    g.fillRect(L * 0.46, 0, L * 0.08, H * 0.2);
  }
  const carte = new THREE.CanvasTexture(c);
  carte.colorSpace = THREE.SRGBColorSpace;
  carte.anisotropy = 8;
  return carte;
}

function baguetteKiiikiii() {
  const PX = 0.25 / 306; // un pixel de la photo, en mètres
  // l'étoile : blanc givré qui s'allume (lueur rose pâle) ; l'acrylique clair et son chant s'allument plus doucement
  const givre = mat('etoile-kiiikiii', '#f2f5f9', { roughness: 0.55, emissive: '#ffe3f0', emissiveIntensity: 0 });
  const acrylique = mat('etoile-kiiikiii-acrylique', '#f4f7fb', { transparent: true, opacity: 0.22, roughness: 0.06, depthWrite: false, emissive: '#6b5560', emissiveIntensity: 0 });
  const chant = mat('etoile-kiiikiii-chant', '#d5dae1', { transparent: true, opacity: 0.62, roughness: 0.12, depthWrite: false, emissive: '#7a6670', emissiveIntensity: 0 });
  const trait = mat('etoile-kiiikiii-trait', '#c6cdd7', { roughness: 0.4, emissive: '#e9c3d4', emissiveIntensity: 0 });
  const blanc = mat('col-kiiikiii', '#f6f7f9', { roughness: 0.32 });
  const gris = mat('pastille-kiiikiii', '#c9ced6', { roughness: 0.4 });
  const fente = mat('fente-kiiikiii', '#5d6470', { roughness: 0.5 });
  const joint = mat('joint-kiiikiii', '#c3c9d1', { roughness: 0.5 });
  const manche = new THREE.MeshStandardMaterial({ map: givreManche(true), roughness: 0.48 });
  manche.name = 'manche-kiiikiii';
  const capot = new THREE.MeshStandardMaterial({ map: givreManche(false), roughness: 0.5 });
  capot.name = 'capot-kiiikiii';

  const RE = 73 * PX + 0.005 * (1 / Math.sin(0.6) - 1); // 139 px de pointe à pointe, mesurés au bout arrondi des pointes
  const RI = 0.6 * RE; // les creux, bien remplis
  const EP = 0.024; // épaisseur de l'acrylique
  const B = 0.003; // son biseau
  const debout = new THREE.Group(); // le light stick debout : l'étoile dans le plan (x, y), face vers +z, manche vers −y

  // — la grande étoile en acrylique clair : extrudée sur un contour rentré du biseau (qui le rend en s'ajoutant) —
  {
    const forme = new THREE.Shape(contourEtoile(RE - B / Math.sin(0.6), RI - 1.06 * B, 0.002, 0.004 + B));
    const geo = new THREE.ExtrudeGeometry(forme, { depth: EP - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 3 });
    geo.translate(0, 0, -(EP / 2 - B));
    const [faces, flancs] = facesEtFlancs(geo);
    debout.add(new THREE.Mesh(faces, acrylique), new THREE.Mesh(flancs, chant));
  }
  // — dedans, les étoiles givrées en gradins, une fine plaque de diffuseur : chaque marche est une étoile plus petite
  // et à peine plus épaisse, cernée d'un liseré gris (les traits fins de la photo) —
  const etoile = (s, demi, materiau) => {
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(contourEtoile(RE * s, RI * s, 0.0055 * s, 0.006 * s, 6)), { depth: 2 * demi, bevelEnabled: false });
    geo.translate(0, 0.002, -demi);
    debout.add(ombres(new THREE.Mesh(geo, materiau)));
  };
  for (const [s, demi] of [[0.66, 0.0045], [0.63, 0.0051], [0.6, 0.0057], [0.38, 0.0066], [0.35, 0.0073]]) {
    etoile(s, demi, givre);
    etoile(s + 0.014, demi - 0.0003, trait);
  }

  // — la tige qui monte dans l'étoile, le col (rangées 242 à 253 de la photo), sa fente et ses pastilles —
  const y = (rangee) => (187 - rangee) * PX; // une rangée de la photo -> la hauteur (centre de l'étoile en 187)
  debout.add(cylindre(0.012, y(222) - y(243), blanc, [0, y(243), 0], { segments: 20 }));
  const LC = 42 * PX;
  debout.add(boite([LC, y(242) - y(253), EP], blanc, [0, y(253), 0], { r: 0.004 }));
  debout.add(boite([0.0068, 0.0016, 0.002], fente, [0, y(250) - 0.0008, EP / 2 - 0.0006], { r: 0 }));
  for (const sx of [-1, 1]) debout.add(cylindre(0.0034, 0.001, gris, [sx * (LC / 2 - 0.0052), y(248.5), EP / 2], { rot: [PI / 2, 0, 0], centre: true, segments: 14 }));

  // — le manche carré : la partie givrée bleutée (et son bouton), le joint, le capot des piles —
  const [LM, PM] = [0.028, 0.024];
  const ySeam = y(342);
  debout.add(boite([LM, y(253) - ySeam - 0.0004, PM], manche, [0, ySeam + 0.0004, 0], { r: 0.004 }));
  debout.add(cylindre(0.0034, 0.001, fente, [0, y(266), PM / 2], { rot: [PI / 2, 0, 0], centre: true, segments: 14 })); // le bouton
  debout.add(boite([LM - 0.002, 0.002, PM - 0.002], joint, [0, ySeam - 0.001, 0], { r: 0 }));
  debout.add(boite([LM, ySeam - 0.0004 - y(420), PM], capot, [0, y(420), 0], { r: 0.004 }));

  // — posé à plat : l'étoile, le col et le manche ont la même épaisseur (2,4 cm) —
  const couche = new THREE.Group();
  debout.rotation.x = -PI / 2;
  debout.position.y = EP / 2;
  couche.add(debout);
  return groupe('objet_baguette', couche);
}

// ===========================================================================================
// --- La table basse japonaise ronde (chabudai), devant le banc-canapé du coin salon ---
// Le modèle classique : un plateau rond de 75 cm en chêne clair (le même que les bureaux bas), fait de cinq lames
// collées au chant adouci, épais de 2,4 cm ; dessous, une ceinture carrée et quatre pieds carrés, rangés dans ses
// coins : ils se replient sous le plateau grâce aux ferrures d'acier vissées à l'intérieur. 33 cm de haut.
// Le fil du bois suit x. Origine : le centre de la table, au sol.
// ===========================================================================================
function tableBasse() {
  const m = creerMateriaux();
  const [R, H, EP, B] = [0.375, 0.33, 0.024, 0.003]; // rayon, hauteur, épaisseur du plateau, arrondi du chant
  const parts = [];
  const sombres = CHENE.veinesSombres.map((c) => m.uni(c));
  const claires = CHENE.veinesClaires.map((c) => m.uni(c));

  // — le plateau : chaque lame est la part du disque entre deux droites parallèles au fil, extrudée avec un biseau
  // arrondi (qui l'élargit de B : le contour est rentré d'autant). Les lames se touchent : seul l'arrondi de leurs
  // arêtes marque le joint, comme sur le bureau bas —
  const LAMES = 5;
  const ll = (2 * R) / LAMES;
  const r = R - B;
  for (let k = 0; k < LAMES; k++) {
    const [z0, z1] = [-R + k * ll, -R + (k + 1) * ll];
    // dans le plan de la forme, y = −z (la forme est ensuite couchée)
    const ya = k === LAMES - 1 ? -r : -z1 + B;
    const yb = k === 0 ? r : -z0 - B;
    const [ta, tb] = [Math.asin(THREE.MathUtils.clamp(ya / r, -1, 1)), Math.asin(THREE.MathUtils.clamp(yb / r, -1, 1))];
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = ta + ((tb - ta) * i) / n;
      pts.push(new THREE.Vector2(r * Math.cos(t), r * Math.sin(t)));
    }
    for (let i = 0; i <= n; i++) {
      const t = tb + ((ta - tb) * i) / n;
      const p = new THREE.Vector2(-r * Math.cos(t), r * Math.sin(t));
      // au bout du disque, les deux arcs se rejoignent en un même point : pas de doublon (le biseau y ferait une encoche)
      if (p.distanceTo(pts.at(-1)) > 1e-6 && (i < n || p.distanceTo(pts[0]) > 1e-6)) pts.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: EP - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 3 });
    geo.rotateX(-PI / 2);
    geo.translate(0, H - EP + B, 0);
    parts.push(ombres(new THREE.Mesh(geo, m.uni(CHENE.tons[(k + 2) % CHENE.tons.length]))));
    // ses veines, dans la bande de la lame qui reste loin du bord du disque
    let zv;
    let V;
    if (z0 < 0 && z1 > 0) [zv, V] = [0, ll / 2 - 0.008];
    else {
      const signe = Math.sign(z0 + z1);
      const zIn = Math.min(Math.abs(z0), Math.abs(z1)) + 0.008;
      const zOut = Math.min(Math.max(Math.abs(z0), Math.abs(z1)) - 0.008, R - 0.05);
      [zv, V] = [(signe * (zIn + zOut)) / 2, (zOut - zIn) / 2];
    }
    const U = Math.sqrt(R * R - (Math.abs(zv) + V) ** 2) - 0.02;
    const face = { centre: [0, H, zv], u: [1, 0, 0], v: [0, 0, -1], U, V };
    parts.push(...veines({ ...face, nb: Math.max(2, Math.round(U * 9)), materiaux: sombres, graine: 61 + k }));
    parts.push(...veines({ ...face, nb: 1, materiaux: claires, graine: 81 + k }));
  }
  // un nœud, sur la deuxième lame
  {
    const noeud = new THREE.CircleGeometry(0.012, 18);
    noeud.scale(1.8, 1, 1);
    noeud.rotateZ(0.3);
    noeud.rotateX(-PI / 2);
    const coeur = noeud.clone().scale(0.45, 1, 0.45);
    noeud.translate(-0.16, H + 0.0006, -0.14);
    coeur.translate(-0.16, H + 0.0009, -0.14);
    parts.push(new THREE.Mesh(noeud, m.uni(CHENE.noeud[0])), new THREE.Mesh(coeur, m.uni(CHENE.noeud[1])));
  }

  // — la ceinture carrée sous le plateau (ses coins à 3 cm du bord), ses veines dans le sens des traverses —
  const bois = m.uni(CHENE.pieds);
  const veinesPieds = CHENE.veinesPieds.map((c) => m.uni(c));
  const A = 0.245; // demi-côté extérieur de la ceinture
  const [hc, ec] = [0.045, 0.018]; // hauteur, épaisseur des traverses
  const yHaut = H - EP; // le dessous du plateau
  let g = 100;
  for (const s of [-1, 1]) {
    parts.push(boite([2 * A, hc, ec], bois, [0, yHaut - hc, s * (A - ec / 2)], { r: 0.003 }));
    parts.push(...veines({ centre: [0, yHaut - hc / 2, s * A], u: [1, 0, 0], v: [0, s, 0], U: A - 0.02, V: hc / 2 - 0.006, nb: 2, materiaux: veinesPieds, graine: g++ }));
    parts.push(boite([ec, hc, 2 * A - 2 * ec], bois, [s * (A - ec / 2), yHaut - hc, 0], { r: 0.003 }));
    parts.push(...veines({ centre: [s * A, yHaut - hc / 2, 0], u: [0, 0, 1], v: [0, -s, 0], U: A - 0.03, V: hc / 2 - 0.006, nb: 2, materiaux: veinesPieds, graine: g++ }));
  }

  // — les quatre pieds carrés, dans les coins de la ceinture, et leurs ferrures repliables en acier —
  const P = 0.042;
  const c = A - ec - P / 2; // les pieds sont juste à l'intérieur de la ceinture
  const acier = m.uni('#9a9ca4');
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push(boite([P, yHaut, P], bois, [sx * c, 0, sz * c], { r: 0.004 }));
      for (const [nx, nz, vx, vz] of [[sx, 0, 0, sx], [0, sz, -sz, 0]]) { // v choisi pour que u × v = la normale de la face
        const centre = [sx * c + (nx * P) / 2, yHaut / 2, sz * c + (nz * P) / 2];
        parts.push(...veines({ centre, u: [0, 1, 0], v: [vx, 0, vz], U: yHaut / 2 - 0.012, V: P / 2 - 0.004, nb: 2, materiaux: veinesPieds, graine: g++ }));
      }
      // la ferrure : une platine sur la face intérieure du pied, son bras jusqu'à la traverse, l'axe et sa vis
      const fx = sx * (c - P / 2 - 0.0015);
      const fz = sz * (c - P / 2 - 0.0015);
      parts.push(boite([0.003, 0.07, 0.026], acier, [fx, yHaut - 0.075, sz * c], { r: 0 }));
      parts.push(boite([0.026, 0.07, 0.003], acier, [sx * c, yHaut - 0.075, fz], { r: 0 }));
      parts.push(cylindre(0.008, 0.005, acier, [fx - sx * 0.002, yHaut - 0.03, sz * c], { rot: [0, 0, PI / 2], centre: true, segments: 10 }));
      parts.push(cylindre(0.008, 0.005, acier, [sx * c, yHaut - 0.03, fz - sz * 0.002], { rot: [PI / 2, 0, 0], centre: true, segments: 10 }));
    }
  }
  return groupe('table-basse', parts);
}

// ===========================================================================================
// --- Un petit plateau repas en inox brossé, vide, posé sur la table basse ---
// 36 × 26 cm, 2,2 cm de haut : un fond plat aux angles arrondis, une paroi qui s'évase en s'arrondissant, le bord
// roulé. Une seule tôle, vue des deux côtés. Origine : le centre du dessous, sur la table (le fond est à 1 mm
// au-dessus, pour ne pas se confondre avec le plateau de la table).
// ===========================================================================================
function plateauRepas() {
  const inox = mat('inox-plateau', '#dfe2e6', { roughness: 0.32, metalness: 0.45, side: THREE.DoubleSide });
  const [W, D, R0] = [0.34, 0.24, 0.028]; // le fond avant l'évasement, et le rayon de ses angles
  const Y0 = 0.001;
  const N = 12; // points par angle
  // le contour du fond agrandi de o, à la hauteur y : la même suite de points pour chaque anneau
  const anneau = (o, y) => {
    const [cx, cz, r] = [W / 2 - R0, D / 2 - R0, R0 + o];
    const pts = [];
    for (const [sx, sz, a0] of [[1, 1, 0], [-1, 1, PI / 2], [-1, -1, PI], [1, -1, (3 * PI) / 2]]) {
      for (let i = 0; i <= N; i++) {
        const a = a0 + (i / N) * (PI / 2);
        pts.push(new THREE.Vector3(sx * cx + r * Math.cos(a), Y0 + y, sz * cz + r * Math.sin(a)));
      }
    }
    return pts;
  };
  // la coupe de la paroi, du bord du fond jusqu'au bord roulé : [agrandissement, hauteur]
  const coupe = [[-0.012, 0], [-0.006, 0.0008], [-0.0025, 0.003], [-0.0005, 0.007], [0.0015, 0.013], [0.004, 0.019], [0.0055, 0.0215]];
  const anneaux = coupe.map(([o, y]) => anneau(o, y));
  const M = anneaux[0].length;
  const pos = anneaux.flat().flatMap((p) => [p.x, p.y, p.z]);
  const idx = [];
  for (let j = 0; j < anneaux.length - 1; j++) {
    for (let i = 0; i < M; i++) {
      const [a, b] = [j * M + i, j * M + ((i + 1) % M)];
      idx.push(a, b, a + M, b, b + M, a + M);
    }
  }
  const paroi = new THREE.BufferGeometry();
  paroi.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  paroi.setIndex(idx);
  paroi.computeVertexNormals();
  // le fond plat (dans le plan de la forme, y = −z : la forme est couchée ensuite)
  const fond = new THREE.ShapeGeometry(new THREE.Shape(anneaux[0].map((p) => new THREE.Vector2(p.x, -p.z))));
  fond.rotateX(-PI / 2);
  fond.translate(0, Y0, 0);
  // le bord roulé, tout autour
  const [oB, yB] = coupe.at(-1);
  const bord = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(anneau(oB + 0.0012, yB + 0.0008), true), 4 * N * 4, 0.002, 8, true);
  return groupe('plateau-repas', [paroi, fond, bord].map((g) => ombres(new THREE.Mesh(g, inox))));
}

// nom du fichier -> fonction qui construit le modèle (fusionné : un maillage par matériau)
// ===========================================================================================
// --- La platine vinyle Rega Planar 1, blanc mat, posée sur le meuble à vinyles du coin salon ---
// D'après les photos officielles de Rega et ses cotes : 447 × 360 mm, 117 mm de haut couvercle fermé. Le socle blanc
// mat sur quatre pieds noirs (l'interrupteur dessous, à l'avant gauche ; le logo « P1 » gris dans le coin avant
// droit) ; le plateau en résine phénolique noire brillante de 23 mm sur son sous-plateau, le feutre et un vinyle
// (l'étiquette, maillage « etiquette-rega », reçoit une pochette dans main.js) ; le bras RB110 : tube noir conique,
// chape du roulement, contrepoids, lève-bras à manette chromée, repose-bras en U ; la cellule Rega Carbon grise et
// ses quatre fils de couleur ; le couvercle en acrylique clair sur ses deux charnières.
// Quatre sous-groupes s'animent (main.js) : le plateau tourne sur son axe (pivot_plateau_rega), le bras pivote sur
// son roulement vertical (pivot_bras_rega) et se lève (pivot_levee_rega), le couvercle s'ouvre sur ses charnières
// (pivot_couvercle_rega). Bras au repos : il pointe droit vers l'avant (rotation 0).
// Origine : le centre du socle au sol, la façade vers +z.
// ===========================================================================================
export const REGA = { L: 0.24, axe: [-0.0495, 0.011], pivot: [0.1325, -0.116] }; // longueur effective du bras, axe du plateau, roulement du bras

// un tube droit qui s'affine de a vers b (le tube du bras)
function barreConique(a, b, rA, rB, materiau, segments = 16) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, dir.length(), segments), materiau);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return ombres(mesh);
}

// un décalque imprimé : un plan détouré dessiné sur un canvas, à plat (normale +y) ou debout (normale +z) ;
// main.js le passe devant son support (polygonOffset) grâce à son nom en « imprime-… »
function decalque(l, p, dessiner, { nom, px = 12000, debout = false, rugosite = 0.6 } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.round(l * px);
  c.height = Math.round(p * px);
  const g = c.getContext('2d');
  dessiner(g, c.width, c.height);
  const carte = new THREE.CanvasTexture(c);
  carte.colorSpace = THREE.SRGBColorSpace;
  carte.anisotropy = 8;
  const materiau = new THREE.MeshStandardMaterial({ map: carte, transparent: true, depthWrite: false, roughness: rugosite });
  materiau.name = nom;
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(l, p), materiau);
  if (!debout) plan.rotation.x = -PI / 2;
  plan.name = nom;
  return plan;
}

// la face gravée du vinyle : les sillons en anneaux de reflets, les silences entre les morceaux, l'entrée et la
// sortie lisses (vue de dessus ; le centre du canvas est l'axe)
function sillonsVinyle() {
  const N = 1024;
  const R = 0.151;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const px = (r) => (r / R) * (N / 2);
  const anneau = (r, largeur, couleur) => {
    g.strokeStyle = couleur;
    g.lineWidth = Math.max(px(largeur), 0.6);
    g.beginPath();
    g.arc(N / 2, N / 2, px(r), 0, 2 * PI);
    g.stroke();
  };
  g.fillStyle = '#1b1920';
  g.fillRect(0, 0, N, N);
  const alea = hasard(77);
  // les sillons : de fines bandes plus ou moins claires (le reflet change d'un tour à l'autre)
  const teintes = ['#1d1b22', '#222027', '#26242c', '#1a1820'];
  for (let r = 0.0605; r < 0.1462; r += 0.00032) anneau(r, 0.00034, teintes[Math.floor(alea() * teintes.length)]);
  // cinq morceaux : les silences entre eux sont lisses, un peu plus sombres et brillants
  for (const r of [0.072, 0.088, 0.104, 0.121, 0.135]) anneau(r, 0.0011, '#141217');
  // l'entrée (bord) et la sortie (près de l'étiquette) : lisses
  anneau(0.1484, 0.0042, '#17151b');
  anneau(0.0555, 0.0098, '#17151b');
  anneau(0.0512, 0.0012, '#2a2830'); // le petit bourrelet autour de l'étiquette
  const carte = new THREE.CanvasTexture(c);
  carte.colorSpace = THREE.SRGBColorSpace;
  carte.anisotropy = 8;
  carte.userData.mimeType = 'image/jpeg'; // opaque : en JPEG dans le .glb (le PNG des anneaux pesait 1 Mo)
  return carte;
}

function platineRega() {
  const m = creerMateriaux();
  const el = [];
  const [W, D] = [0.447, 0.36];
  const PIED = 0.014;
  const EP = 0.025; // l'épaisseur du socle (avec les pieds : 117 mm couvercle fermé, le contrepoids passe dessous)
  const yP = PIED + EP; // le dessus du socle
  const blanc = mat('rega-blanc', '#f1efea', { roughness: 0.82 });
  const noir = mat('rega-noir', '#2b2932', { roughness: 0.62 }); // le noir mat du bras, des pieds, de la cellule
  const noirTube = mat('rega-tube', '#2d2b34', { roughness: 0.48 }); // le tube anodisé, un rien satiné
  const plateauNoir = mat('rega-plateau', '#1f1d24', { roughness: 0.14, metalness: 0.1 }); // la résine phénolique, brillante
  const feutre = mat('rega-feutre', '#2c2b31', { roughness: 1 });
  const vinyle = mat('rega-vinyle', '#1c1a21', { roughness: 0.3 });
  const gris = mat('rega-carbon', '#cfd0d3', { roughness: 0.55 }); // le corps de la cellule Carbon
  const vis = m.chrome;

  // — le socle, ses pieds, l'interrupteur dessous, les fentes des charnières au bord arrière —
  el.push(boite([W, EP, D], blanc, [0, PIED, 0], { r: 0.004 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el.push(cylindre(0.036, PIED, noir, [sx * (W / 2 - 0.058), 0, sz * (D / 2 - 0.05)], { dBas: 0.032, segments: 22 }));
  el.push(boite([0.012, 0.006, 0.018], noir, [-W / 2 + 0.035, PIED - 0.006, D / 2 - 0.045], { r: 0 }));
  for (const sx of [-1, 1]) el.push(boite([0.026, 0.0004, 0.0032], m.uni('#3a3842'), [sx * (W / 2 - 0.05), yP, -D / 2 + 0.0065], { r: 0 }));
  // le logo « P1 » (un p arrondi et un 1 au trait fin) et « planar one » en petit, gris, dans le coin avant droit
  const logo = decalque(0.034, 0.034, (g, w, h) => {
    g.strokeStyle = g.fillStyle = '#a19fa6';
    g.lineWidth = w * 0.03;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(w * 0.36, h * 0.34, w * 0.17, PI * 0.5, PI * 2.5);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.19, h * 0.34);
    g.lineTo(w * 0.19, h * 0.74);
    g.moveTo(w * 0.62, h * 0.2);
    g.lineTo(w * 0.7, h * 0.17);
    g.lineTo(w * 0.7, h * 0.51);
    g.stroke();
    g.font = `400 ${h * 0.085}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.textBaseline = 'middle';
    g.fillText('planar one', w * 0.26, h * 0.7);
  }, { nom: 'imprime-rega-p1' });
  logo.position.set(W / 2 - 0.038, yP + 0.0003, D / 2 - 0.034);
  el.push(logo);

  // — le plateau : sous-plateau (moyeu), plateau brillant au bord adouci, feutre, vinyle, étiquette, axe —
  const [xs, zs] = REGA.axe;
  const plateau = new THREE.Group();
  plateau.name = 'pivot_plateau_rega';
  plateau.position.set(xs, yP, zs);
  plateau.add(cylindre(0.14, 0.006, noir, [0, 0, 0], { segments: 40 }));
  plateau.add(
    tourne(
      [[0, 0.006], [0.1452, 0.006], [0.1483, 0.0072], [0.149, 0.0095], [0.149, 0.0262], [0.1484, 0.0282], [0.1463, 0.029], [0, 0.029]],
      plateauNoir,
      [0, 0, 0],
      { segments: 96 },
    ),
  );
  plateau.add(cylindre(0.292, 0.003, feutre, [0, 0.029, 0], { segments: 72 }));
  const yDisque = 0.032;
  const EV = 0.0016; // l'épaisseur du vinyle
  const tranche = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.151, EV, 96, 1, true), vinyle);
  tranche.position.y = yDisque + EV / 2;
  plateau.add(ombres(tranche));
  const face = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.151, 128, 1), mat('rega-sillons', '#ffffff', { map: sillonsVinyle(), roughness: 0.32 }));
  face.rotation.x = -PI / 2;
  face.position.y = yDisque + EV;
  plateau.add(ombres(face));
  const etiquette = new THREE.Mesh(new THREE.CircleGeometry(0.05, 64), mat('etiquette-rega', '#e8dcc2', { roughness: 0.7 }));
  etiquette.rotation.x = -PI / 2;
  etiquette.position.y = yDisque + EV;
  etiquette.name = 'etiquette-rega';
  plateau.add(ombres(etiquette));
  plateau.add(cylindre(0.0072, 0.0465 - 0.029, noir, [0, 0.029, 0], { segments: 16 }));
  plateau.add(sphere(0.0072, noir, [0, 0.0465, 0], { echelle: [1, 0.6, 1] }));
  el.push(plateau);

  // — le bras RB110 —
  const [xp, zp] = REGA.pivot;
  const L = REGA.L;
  const BETA = 0.4; // l'angle de la tête (offset), tournée vers l'axe du plateau
  const yR = yDisque + EV; // le dessus du disque : la pointe du diamant s'y pose
  const yB = yR + 0.0165 + 0.0035 + 0.0039; // l'axe du tube, juste au-dessus de la coquille
  // l'embase fixe : un pied rond à trois lobes vissés, et une barre vers l'avant (« RB110 ») qui porte le repose-bras
  el.push(cylindre(0.054, 0.011, noir, [xp, yP, zp], { dBas: 0.06, segments: 32 }));
  for (const a of [0.7, 2.75, -1.55]) {
    const [x, z] = [xp + Math.cos(a) * 0.033, zp + Math.sin(a) * 0.033];
    el.push(cylindre(0.017, 0.006, noir, [x, yP, z], { segments: 16 }));
    el.push(cylindre(0.0072, 0.0016, m.uni('#45434d'), [x, yP + 0.006, z], { segments: 6 }));
  }
  el.push(boite([0.013, 0.0072, 0.072], noir, [xp + 0.013, yP, zp + 0.049], { r: 0.002 }));
  const rb110 = decalque(0.024, 0.0075, (g, w, h) => {
    g.fillStyle = '#f2f1f4';
    g.font = `300 ${h * 0.72}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('RB110', w / 2, h * 0.54);
  }, { nom: 'imprime-rega-rb110', px: 24000 });
  rb110.rotation.z = PI / 2; // il se lit le long de la barre, de l'avant vers l'arrière
  rb110.position.set(xp + 0.013, yP + 0.0075, zp + 0.05);
  el.push(rb110);
  // le repose-bras : un petit fût et un U où se cale le tube
  const [xr, zr] = [xp + 0.0045, zp + 0.079]; // (le tube y passe à 4,5 mm de l'axe du roulement)
  el.push(cylindre(0.0075, yB - 0.008 - 0.0072, noir, [xr + 0.006, yP + 0.0072, zr], { segments: 12 }));
  el.push(boite([0.018, 0.003, 0.006], noir, [xr, yP + yB - 0.008, zr], { r: 0 }));
  for (const sx of [-1, 1]) el.push(boite([0.0024, 0.009, 0.006], noir, [xr + sx * 0.0072, yP + yB - 0.005, zr], { r: 0 }));
  // le lève-bras : une colonne côté plateau, une palette en arc sous le tube (là où il passe pendant la lecture),
  // et sa manette chromée qui part vers l'avant
  const auBras = (a, rho) => [xp + rho * Math.sin(a), zp + rho * Math.cos(a)];
  const [xc, zc] = auBras(-1.02, 0.05);
  el.push(cylindre(0.011, 0.004, noir, [xc, yP, zc], { segments: 16 }));
  el.push(cylindre(0.0072, yB - 0.0095 - 0.004, m.uni('#8f939b'), [xc, yP + 0.004, zc], { segments: 14 }));
  const [xa, za] = auBras(-0.9, 0.05);
  const [xb, zb] = auBras(-0.24, 0.05);
  el.push(barre([xc, yP + yB - 0.0095, zc], [xa, yP + yB - 0.0095, za], 0.0022, noir, 10));
  el.push(barre([xa, yP + yB - 0.0095, za], [xb, yP + yB - 0.0095, zb], 0.0022, noir, 10));
  el.push(barre([xc, yP + 0.012, zc], [xc + 0.012, yP + 0.0065, zc + 0.046], 0.0019, vis, 10));
  el.push(sphere(0.0052, vis, [xc + 0.0125, yP + 0.0063, zc + 0.048], { echelle: [1, 1, 1.6] }));

  // ce qui tourne avec le bras : le fût du roulement vertical et la chape du roulement horizontal
  const bras = new THREE.Group();
  bras.name = 'pivot_bras_rega';
  bras.position.set(xp, yP, zp);
  bras.add(cylindre(0.025, yB - 0.011 - 0.009, noir, [0, 0.011, 0], { segments: 24 }));
  bras.add(boite([0.031, 0.021, 0.027], noir, [0, yB - 0.012, 0], { r: 0.007 })); // la chape, bombée
  for (const sx of [-1, 1]) {
    bras.add(cylindre(0.016, 0.004, noir, [sx * 0.0175, yB, 0], { rot: [0, 0, PI / 2], centre: true, segments: 20 })); // les chapeaux des roulements
    bras.add(tore(0.011, 0.0007, m.uni('#4a4852'), [sx * 0.0196, yB, 0], [0, PI / 2, 0]));
  }
  // ce qui se lève : le tube, le contrepoids, la coquille et la cellule (charnière : l'axe du roulement horizontal)
  const levee = new THREE.Group();
  levee.name = 'pivot_levee_rega';
  levee.position.y = yB;
  bras.add(levee);
  const H = [0.034 * Math.sin(BETA), 0, L - 0.034 * Math.cos(BETA)]; // l'arrière de la coquille, où arrive le tube
  levee.add(barreConique([0, 0, 0.012], H, 0.0053, 0.0039, noirTube, 20));
  levee.add(barre([0, 0, 0.014], [0, 0, -0.072], 0.0052, noirTube, 16)); // le tube traverse la chape, puis la queue
  levee.add(cylindre(0.0118, 0.006, noir, [0, 0, 0.014], { rot: [PI / 2, 0, 0], centre: true, segments: 18 })); // la bague à la sortie de la chape
  // le contrepoids (111 g) : un cylindre aux arêtes adoucies, une gorge, et le bout de la queue
  levee.add(
    tourne(
      [[0.0053, -0.01], [0.0158, -0.01], [0.0168, -0.009], [0.0168, 0.009], [0.0158, 0.01], [0.0053, 0.01]],
      noir,
      [0, 0, -0.05],
      { rot: [PI / 2, 0, 0], segments: 40 },
    ),
  );
  levee.add(tore(0.0336, 0.0006, m.uni('#3c3a44'), [0, 0, -0.047], [0, 0, 0]));
  levee.add(cylindre(0.0092, 0.012, m.uni('#3a3842'), [0, 0, -0.072], { rot: [PI / 2, 0, 0], centre: true, segments: 16 }));
  // la coquille et la cellule, tournées de l'angle d'offset : origine à la pointe du diamant
  const tete = new THREE.Group();
  tete.position.set(0, yR - yB, L);
  tete.rotation.y = -BETA;
  levee.add(tete);
  tete.add(boite([0.019, 0.0035, 0.04], noir, [0, 0.0165, -0.014], { r: 0 })); // la coquille
  tete.add(boite([0.011, 0.005, 0.012], noir, [0, 0.0185, -0.031], { r: 0 })); // son col, qui rejoint le tube
  for (const sx of [-1, 1]) tete.add(cylindre(0.0032, 0.0009, vis, [sx * 0.0063, 0.02, -0.012], { segments: 10 })); // les vis
  tete.add(tube([[0.008, 0.0183, 0.004], [0.017, 0.019, 0.006], [0.026, 0.0215, 0.006], [0.033, 0.0225, 0.0035], [0.036, 0.02, 0.002]], 0.0017, noir, 16)); // le lève-doigt
  tete.add(boite([0.0165, 0.0145, 0.022], gris, [0, 0.002, -0.0095], { r: 0 })); // le corps de la Carbon
  tete.add(boite([0.007, 0.0026, 0.009], noir, [0, 0.0005, -0.0035], { r: 0 })); // le porte-pointe
  tete.add(barre([0, 0.0012, -0.0015], [0, 0.0001, 0.0012], 0.0004, m.chrome, 6)); // le cantilever et le diamant
  const carbon = decalque(0.0145, 0.0125, (g, w, h) => {
    g.fillStyle = '#26242c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${h * 0.36}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.fillText('rega', w / 2, h * 0.36);
    g.font = `500 ${h * 0.2}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    g.fillText('CARBON', w / 2, h * 0.72);
  }, { nom: 'imprime-rega-carbon', px: 30000, debout: true });
  carbon.position.set(0, 0.0092, 0.00155);
  tete.add(carbon);
  // les quatre fils (rouge, vert, bleu, blanc) des broches de la cellule jusqu'au bout du tube
  [['#d8454f', -0.004, 0.006], ['#4fa36b', 0.004, 0.006], ['#4a74c9', -0.004, 0.011], ['#f2f2f4', 0.004, 0.011]].forEach(([c, x, y]) => {
    tete.add(tube([[x, y, -0.0205], [x * 0.9, y + 0.002, -0.026], [x * 0.5, 0.0185, -0.033], [0, yB - yR - 0.001, -0.038]], 0.00055, m.uni(c), 8));
  });
  el.push(bras);

  // — les câbles : la paire RCA et le cordon d'alimentation sortent sous l'arrière et filent vers le mur —
  for (const dx of [-0.0025, 0.0025]) el.push(tube([[0.12 + dx, PIED + 0.004, -D / 2 + 0.01], [0.12 + dx, 0.004, -D / 2 - 0.03], [0.1 + dx, 0.0028, -0.25], [0.09 + dx, 0.0028, -0.296], [0.09 + dx, -0.02, -0.297]], 0.0022, m.uni('#26242b'), 24));
  el.push(tube([[-0.17, PIED + 0.004, -D / 2 + 0.01], [-0.17, 0.003, -D / 2 - 0.03], [-0.15, 0.0022, -0.25], [-0.14, 0.0022, -0.296], [-0.14, -0.02, -0.297]], 0.0018, m.uni('#26242b'), 24));

  // — le couvercle : une boîte d'acrylique clair (parois de 3 mm, chants un peu plus visibles), sur deux charnières —
  const couvercle = new THREE.Group();
  couvercle.name = 'pivot_couvercle_rega';
  couvercle.position.set(0, yP, -D / 2);
  const HC = 0.117 - yP;
  const EC = 0.003;
  const acrylique = mat('rega-couvercle', '#f2f6f8', { transparent: true, opacity: 0.13, roughness: 0.04, depthWrite: false });
  const chant = mat('rega-couvercle-chant', '#e3eeee', { transparent: true, opacity: 0.38, roughness: 0.1, depthWrite: false });
  couvercle.add(boite([W, EC, D], acrylique, [0, HC - EC, D / 2], { r: 0 }));
  for (const z of [EC / 2, D - EC / 2]) couvercle.add(boite([W - 2 * EC, HC - EC, EC], acrylique, [0, 0, z], { r: 0 }));
  for (const sx of [-1, 1]) couvercle.add(boite([EC, HC - EC, D], acrylique, [sx * (W / 2 - EC / 2), 0, D / 2], { r: 0 }));
  // les chants : le tour du dessus et les quatre arêtes verticales
  const c = 0.0032;
  for (const z of [c / 2, D - c / 2]) couvercle.add(boite([W, c, c], chant, [0, HC - c, z], { r: 0 }));
  for (const sx of [-1, 1]) {
    couvercle.add(boite([c, c, D - 2 * c], chant, [sx * (W / 2 - c / 2), HC - c, D / 2], { r: 0 }));
    for (const z of [c / 2, D - c / 2]) couvercle.add(boite([c, HC - c, c], chant, [sx * (W / 2 - c / 2), 0, z], { r: 0 }));
  }
  // les charnières : une platine noire sur la paroi arrière, une languette qui entre dans la fente du socle
  for (const sx of [-1, 1]) {
    couvercle.add(boite([0.02, 0.011, 0.004], noir, [sx * (W / 2 - 0.05), 0.001, -0.002], { r: 0 }));
    couvercle.add(boite([0.024, 0.012, 0.0025], noir, [sx * (W / 2 - 0.05), -0.012, 0.0065], { r: 0 }));
  }
  el.push(couvercle);

  return groupe('platine-rega', el);
}

const fabrique = (f) => () => fusionner(f());
export const modelesReve = {
  'tapis-miffy': fabrique(tapisMiffy),
  plante: fabrique(plante),
  'bureau-bas': fabrique(bureauBas),
  'bureau-retour': fabrique(bureauRetour),
  'chaise-sol': fabrique(chaiseSol),
  tolomeo: fabrique(tolomeo),
  tasse: fabrique(tasse),
  serviette: fabrique(serviette),
  'bureau-studio': fabrique(bureauStudio),
  tatami: fabrique(tatami),
  'console-lit': fabrique(consoleLit),
  'sac-mantis': fabrique(sacMantis),
  branchements: fabrique(branchements),
  'coin-salon': fabrique(coinSalon),
  'season-greetings': fabrique(seasonGreetings),
  'meuble-hifi': fabrique(meubleHifi),
  drapeau: fabrique(drapeau),
  'macintosh-plus': fabrique(macPlus),
  'rack-nas': fabrique(rackNas),
  'rack-vetements': fabrique(rackVetements),
  'baguette-kiiikiii': fabrique(baguetteKiiikiii),
  'platine-rega': fabrique(platineRega),
  'table-basse': fabrique(tableBasse),
  'plateau-repas': fabrique(plateauRepas),
};
