import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { creerMateriaux, boite, cylindre, sphere, tore, barre, tube, tourne, tissu, fusionner, RoundedBoxGeometry } from './outils.js';

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
// --- Bibliothèque basse : un Kallax 4 × 2 blanc couché (147 × 77 × 39 cm), garni ---
// En bas : deux boîtes en tissu (lilas, vert sauge), un panier en osier avec un plaid, une pile de magazines.
// En haut : une rangée d'albums, un cadre photo, un pothos dans un pot en terre cuite qui retombe sur la case du
// dessous, des classeurs de photocards et une petite enceinte. Dessus : une lampe champignon au fond et, côté
// plante, deux livres et une bougie (bas, pour ne pas cacher les portraits accrochés au-dessus).
// ===========================================================================================
function bibliotheque() {
  const m = creerMateriaux();
  const [L, H, P] = [1.47, 0.77, 0.39];
  const E = 0.0425; // cadre extérieur, plus épais
  const e = 0.015; // cloisons et tablette
  const c = (L - 2 * E - 3 * e) / 4; // une case : 33,5 cm
  const hc = (H - 2 * E - e) / 2;
  const xc = (j) => -L / 2 + E + c / 2 + j * (c + e); // centre de la colonne j
  const yb = (i) => E + i * (hc + e); // bas de la rangée i
  const avant = P / 2; // la façade
  const parts = [];

  // le meuble : dessus et dessous sur toute la longueur, flancs entre les deux, cloisons et tablette fines en
  // léger retrait, fond gris très pâle
  parts.push(boite([L, E, P], m.blanc, [0, 0, 0], { r: 0.004 }), boite([L, E, P], m.blanc, [0, H - E, 0], { r: 0.004 }));
  for (const s of [-1, 1]) parts.push(boite([E, H - 2 * E, P], m.blanc, [s * (L / 2 - E / 2), E, 0], { r: 0.003 }));
  for (const j of [0, 1, 2]) parts.push(boite([e, H - 2 * E, P - 0.004], m.blanc, [xc(j) + c / 2 + e / 2, E, -0.002], { r: 0.002 }));
  parts.push(boite([L - 2 * E, e, P - 0.004], m.blanc, [0, yb(1) - e, -0.002], { r: 0.002 }));
  parts.push(boite([L - 0.01, H - 0.01, 0.006], m.uni('#eeedf0'), [0, 0.005, -P / 2 + 0.003], { r: 0.001 }));
  // petits patins sous les coins
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(cylindre(0.02, 0.004, m.uni('#d9d6dc'), [sx * (L / 2 - 0.04), -0.002, sz * (P / 2 - 0.04)], { segments: 10 }));

  // --- rangée du bas ---
  const y0 = yb(0);
  // boîte en tissu, poignée découpée sur la façade et couture du bord
  const boiteTissu = (x, couleur, fonce) => {
    const zc = avant - 0.012 - 0.17;
    return [
      boite([0.31, 0.305, 0.34], m.uni(couleur), [x, y0, zc], { r: 0.018 }),
      boite([0.1, 0.03, 0.006], m.uni(fonce), [x, y0 + 0.235, zc + 0.169], { r: 0.003 }),
      boite([0.29, 0.004, 0.004], m.uni(fonce), [x, y0 + 0.285, zc + 0.17], { r: 0.001 }),
    ];
  };
  parts.push(...boiteTissu(xc(0), '#d8c6ec', '#a993c7'));
  parts.push(...boiteTissu(xc(2), '#cfe0c9', '#9fbb98'));

  // panier en osier : bandes tressées alternées, montants verticaux, rebord plus épais, plaid crème dedans
  {
    const x = xc(1);
    const zc = avant - 0.014 - 0.16;
    const [l, h, p] = [0.3, 0.24, 0.32];
    const n = 8;
    for (let k = 0; k < n; k++) {
      const saillie = k % 2 ? 0.006 : 0;
      parts.push(boite([l + saillie, (h / n) * 1.02, p + saillie], k % 2 ? m.osier : m.osierFonce, [x, y0 + (k * h) / n, zc], { r: 0.008 }));
    }
    for (let k = 0; k < 7; k++) {
      const dx = -l / 2 + 0.025 + (k * (l - 0.05)) / 6;
      parts.push(boite([0.01, h, 0.006], m.osierPaille, [x + dx, y0, zc + p / 2 + 0.002], { r: 0.002 }));
    }
    for (const s of [-1, 1]) {
      parts.push(boite([l + 0.016, 0.022, 0.016], m.osierPaille, [x, y0 + h, zc + s * (p / 2)], { r: 0.007 }));
      parts.push(boite([0.016, 0.022, p + 0.016], m.osierPaille, [x + s * (l / 2), y0 + h, zc], { r: 0.007 }));
    }
    parts.push(boite([0.08, 0.026, 0.008], m.uni('#bfa27c'), [x, y0 + h - 0.06, zc + p / 2 + 0.004], { r: 0.003 })); // la poignée
    parts.push(tissu([0.25, 0.07, 0.26], m.uni('#efe3c4'), [x, y0 + h - 0.015, zc], { r: 0.03, froissement: 0.01, graine: 4 }));
  }

  // pile de magazines à plat, un peu de travers, et deux grands albums dessus
  {
    const x = xc(3);
    const couleurs = ['#e9e3f2', '#9fb5d9', '#f3e2c9', '#c9d7e6', '#f8f4ee', '#b9d6c6', '#d5c0e8'];
    couleurs.forEach((co, k) => parts.push(boite([0.23, 0.009, 0.3], m.uni(co), [x + (k % 2 ? 0.006 : -0.004), y0 + k * 0.0095, 0.01], { r: 0.002, rot: [0, (k % 3 - 1) * 0.05, 0] })));
    parts.push(boite([0.22, 0.022, 0.29], m.uni('#f2c26b'), [x - 0.004, y0 + 0.067, 0.012], { r: 0.003, rot: [0, 0.07, 0] }));
    parts.push(boite([0.2, 0.026, 0.26], m.uni('#c6b2e6'), [x + 0.006, y0 + 0.089, 0.018], { r: 0.003, rot: [0, -0.04, 0] }));
  }

  // --- rangée du haut ---
  const y1 = yb(1);
  // une rangée d'albums debout (tranche vers l'avant), le dernier penché contre les autres
  {
    const albums = [
      [0.026, 0.29, 0.24, '#e6dcc8'],
      [0.018, 0.26, 0.21, '#bcd0f0'],
      [0.032, 0.3, 0.25, '#fbe2a4'],
      [0.022, 0.27, 0.22, '#cfe9d5'],
      [0.028, 0.29, 0.24, '#e0caf3'],
      [0.016, 0.25, 0.2, '#35323f'],
      [0.03, 0.28, 0.23, '#c7dfd6'],
    ];
    let x = xc(0) - c / 2 + 0.008;
    for (const [ep, h, p, co] of albums) {
      parts.push(boite([ep, h, p], m.uni(co), [x + ep / 2, y1, 0.04], { r: 0.003 }));
      parts.push(boite([0.004, h * 0.55, 0.002], m.uni('#ffffff'), [x + ep / 2, y1 + h * 0.3, 0.04 + p / 2 + 0.001], { r: 0.001 })); // l'étiquette de la tranche
      x += ep + 0.002;
    }
    // le dernier, penché à 20° contre la rangée (le haut appuyé sur l'album d'avant, le pied écarté)
    const a = 0.35;
    const [ep, h, p] = [0.024, 0.27, 0.22];
    const cx = x + (h / 2) * Math.sin(a) + (ep / 2) * Math.cos(a);
    const cy = y1 + (h / 2) * Math.cos(a) + (ep / 2) * Math.sin(a);
    parts.push(boite([ep, h, p], m.uni('#a9d4e6'), [cx, cy - h / 2, 0.04], { r: 0.003, rot: [0, 0, a] }));
  }

  // un cadre photo un peu penché en arrière, au milieu de la case
  {
    const cadre = new THREE.Group();
    cadre.add(
      boite([0.15, 0.2, 0.014], m.uni('#f1e4d2'), [0, 0, 0], { r: 0.004 }),
      boite([0.11, 0.15, 0.003], m.uni('#cfd9e6'), [0, 0.025, 0.008], { r: 0.001 }),
      boite([0.07, 0.07, 0.002], m.uni('#efe3d3'), [-0.01, 0.06, 0.0105], { r: 0.001 }),
    );
    cadre.position.set(xc(1), y1, -0.03);
    cadre.rotation.set(-0.12, 0.08, 0);
    parts.push(cadre);
  }

  // un pothos dans un petit pot, ses lianes retombent par-dessus la tablette devant le panier ; deux livres à plat
  {
    const x = xc(2) + 0.04;
    parts.push(boite([0.22, 0.03, 0.17], m.uni('#efe6da'), [xc(2) - 0.03, y1, -0.085], { r: 0.003, rot: [0, 0.1, 0] }));
    parts.push(boite([0.19, 0.025, 0.15], m.uni('#9fb5d9'), [xc(2) - 0.035, y1 + 0.03, -0.08], { r: 0.003, rot: [0, -0.05, 0] }));
    parts.push(tourne([[0, 0.002], [0.05, 0.002], [0.054, 0.01], [0.062, 0.1], [0.064, 0.112], [0.056, 0.112], [0.054, 0.095]], m.uni('#e2c2a4'), [x, y1, 0.075], { segments: 22 }));
    parts.push(cylindre(0.11, 0.006, m.uni('#7a6556'), [x, y1 + 0.09, 0.075], { segments: 18 })); // terreau
    const tige = m.uni('#7fae7f');
    const feuilles = [m.uni('#86b98a'), m.uni('#9fcb98'), m.uni('#6f9f78')];
    const geoFeuille = new THREE.ShapeGeometry(formeCoeur(0.022), 6);
    const alea = hasard(7);
    // chaque liane : du pot, par-dessus le bord de la case, puis elle pend devant la façade
    const lianes = [
      [[x - 0.02, y1 + 0.1, 0.09], [x - 0.04, y1 + 0.12, 0.16], [x - 0.05, y1 + 0.02, avant + 0.02], [x - 0.06, y1 - 0.12, avant + 0.035], [x - 0.065, y1 - 0.2, avant + 0.03]],
      [[x + 0.01, y1 + 0.1, 0.1], [x + 0.02, y1 + 0.13, 0.16], [x + 0.03, y1 + 0.01, avant + 0.025], [x + 0.035, y1 - 0.07, avant + 0.04]],
      [[x - 0.03, y1 + 0.1, 0.06], [x - 0.08, y1 + 0.1, 0.02], [x - 0.12, y1 + 0.068, -0.03], [x - 0.16, y1 + 0.062, -0.07]],
      [[x - 0.01, y1 + 0.1, 0.06], [x, y1 + 0.19, 0.03], [x - 0.02, y1 + 0.25, -0.03]],
    ];
    for (const pts of lianes) {
      parts.push(tube(pts, 0.0022, tige, 24));
      const courbe = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const n = Math.round(courbe.getLength() / 0.035);
      for (let k = 1; k <= n; k++) {
        const p = courbe.getPointAt(Math.min(1, k / n));
        const f = new THREE.Mesh(geoFeuille, feuilles[k % 3]);
        f.position.copy(p);
        f.rotation.set(-0.6 + alea() * 1.2, (alea() - 0.5) * 2.4, PI + (alea() - 0.5) * 1.6);
        f.scale.setScalar(0.75 + alea() * 0.5);
        parts.push(ombres(f));
      }
    }
  }

  // trois classeurs de photocards debout et une petite enceinte ronde
  {
    const x = xc(3);
    ['#cfe0f6', '#d8e8d2', '#fdf0c4'].forEach((co, k) => {
      parts.push(boite([0.042, 0.24, 0.2], m.uni(co), [x - 0.1 + k * 0.046, y1, 0.02], { r: 0.008 }));
      parts.push(boite([0.044, 0.012, 0.03], m.uni('#ffffff'), [x - 0.1 + k * 0.046, y1 + 0.17, 0.12], { r: 0.003 })); // l'anneau du classeur
    });
    parts.push(cylindre(0.1, 0.12, m.uni('#d9c9ee'), [x + 0.085, y1, 0.04], { segments: 22 }));
    parts.push(cylindre(0.09, 0.004, m.uni('#a996c4'), [x + 0.085, y1 + 0.12, 0.04], { segments: 22 }));
    parts.push(cylindre(0.014, 0.004, m.uni('#ffffff'), [x + 0.085, y1 + 0.123, 0.04], { segments: 10 }));
  }

  // --- dessus ---
  // une lampe champignon au fond : pied rond, tige, chapeau bombé
  {
    const x = -0.55;
    parts.push(cylindre(0.12, 0.016, m.uni('#f1ebe1'), [x, H, -0.02], { segments: 24 }));
    parts.push(cylindre(0.028, 0.27, m.uni('#f1ebe1'), [x, H + 0.016, -0.02], { dBas: 0.036, segments: 16 }));
    parts.push(tourne([[0, 0.39], [0.05, 0.383], [0.09, 0.36], [0.118, 0.325], [0.13, 0.29], [0.128, 0.278], [0.11, 0.28], [0.06, 0.29], [0.02, 0.295]], m.uni('#f7f2ef'), [x, H, -0.02], { segments: 32 }));
  }
  // côté plante, deux livres à plat et une bougie dans son pot
  {
    const x = 0.48;
    parts.push(boite([0.21, 0.03, 0.16], m.uni('#e8d9f3'), [x, H, 0.0], { r: 0.003, rot: [0, 0.12, 0] }));
    parts.push(boite([0.18, 0.026, 0.14], m.uni('#f8f2e8'), [x - 0.01, H + 0.03, 0.01], { r: 0.003, rot: [0, -0.08, 0] }));
    parts.push(cylindre(0.07, 0.075, m.uni('#efe6d8'), [x + 0.02, H + 0.056, 0.0], { segments: 18 }));
    parts.push(cylindre(0.06, 0.004, m.uni('#fff7ea'), [x + 0.02, H + 0.131, 0.0], { segments: 18 }));
    parts.push(cylindre(0.004, 0.012, m.uni('#4a4152'), [x + 0.02, H + 0.135, 0.0], { segments: 6 }));
  }

  return groupe('bibliotheque', parts);
}

// ===========================================================================================
// --- Grand tapis rond noir (Ø 140 cm) : laine épaisse à sillons concentriques, cordon tressé au bord ---
// ===========================================================================================
function tapis() {
  const R = 0.7;
  const h = 0.012;
  const laine = mat('laine', '#4a4660', { roughness: 1 });
  const cordon = mat('cordon', '#393649', { roughness: 1 });
  // le profil, du centre vers le bord : plat, avec un sillon tous les 8 cm (le motif, tout en relief)
  const profil = [[0, h]];
  for (let r = 0.08; r < R - 0.05; r += 0.08) profil.push([r - 0.01, h], [r, h - 0.0028], [r + 0.01, h]);
  profil.push([R - 0.03, h], [R - 0.02, h * 0.8], [R - 0.016, 0]);
  const disque = ombres(new THREE.Mesh(new THREE.LatheGeometry(profil.map(([r, y]) => new THREE.Vector2(r, y)), 72), laine));
  disque.material.side = THREE.DoubleSide;
  // le cordon : un tore aplati, et de petites torsades le long du tore (le tressage)
  const tor = new THREE.TorusGeometry(R - 0.012, 0.0095, 8, 120);
  tor.rotateX(PI / 2);
  tor.scale(1, 0.85, 1);
  tor.translate(0, 0.0075, 0);
  const torsades = [];
  const nb = 110;
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * 2 * PI;
    const g = new THREE.CapsuleGeometry(0.0045, 0.014, 1, 5);
    g.rotateX(0.9); // la torsade penche le long du cordon, comme une corde
    g.rotateY(-a);
    g.translate((R - 0.012) * Math.cos(a), 0.012, -(R - 0.012) * Math.sin(a));
    torsades.push(g);
  }
  return groupe('tapis', disque, ombres(new THREE.Mesh(tor, cordon)), ...torsades.map((g) => ombres(new THREE.Mesh(g, cordon))));
}

// ===========================================================================================
// --- Grande plante : un monstera de 1,30 m dans un cache-pot crème, sur un tuteur en fibre de coco ---
// Les feuilles sont découpées (fentes entre les nervures), pliées le long de la nervure centrale et tombent
// un peu au bout. Elles partent toutes vers la pièce ou de côté : le mur est est à 35 cm derrière (côté +x),
// et la bibliothèque basse commence à 32 cm (côté −z), sous les feuilles du haut.
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

  // les feuilles : [longueur, azimut (degrés, 0 = vers le mur, 90 = vers le lampadaire, 180 = vers la pièce),
  // hauteur de l'attache, distance de l'attache au tuteur, pente (degrés), roulis]
  const liste = [
    [0.44, 165, 1.24, 0.1, 8, 0.1],
    [0.42, 205, 1.12, 0.13, -6, -0.15],
    [0.4, 128, 1.05, 0.14, -4, 0.2],
    [0.38, 248, 0.98, 0.13, -2, -0.1],
    [0.34, 95, 0.86, 0.1, 2, 0.25],
    [0.36, 182, 0.84, 0.15, -10, 0.05],
    [0.32, 150, 0.68, 0.15, 4, 0.15],
    [0.3, 215, 0.6, 0.14, 0, -0.2],
    [0.27, 112, 0.52, 0.12, 12, 0.1],
    [0.18, 262, 1.3, 0.06, 38, -0.4], // une jeune feuille qui se déplie, en haut
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

// Les veines du bois, sans texture (comme tout le site : de la géométrie en couleur unie) : de fines lignes un
// peu plus foncées ou plus claires que le bois, qui ondulent le long du fil et s'effilent aux deux bouts, posées à
// fleur d'une face (0,4 mm devant).
//   centre : le centre de la face ; u : le sens du fil, v : l'autre axe de la face (u × v = la normale, vers
//   l'extérieur) ; U, V : les demi-longueurs de la face selon u et v ; nb : nombre de veines ;
//   materiaux : les couleurs possibles, prises au hasard ; graine : le tirage (le même à chaque export).
function veines({ centre, u, v, U, V, nb, materiaux, graine, largeur = 0.0017 }) {
  const alea = hasard(graine);
  const eu = new THREE.Vector3(...u);
  const ev = new THREE.Vector3(...v);
  const en = new THREE.Vector3().crossVectors(eu, ev);
  const c = new THREE.Vector3(...centre).addScaledVector(en, 0.0004);
  const sortie = [];
  for (let k = 0; k < nb; k++) {
    const v0 = (alea() * 2 - 1) * V * 0.8;
    const u0 = -U + alea() * U * 0.7; // une veine ne court pas toujours d'un bout à l'autre
    const u1 = U - alea() * U * 0.7;
    const amp = (0.3 + alea() * 0.7) * Math.min(V * 0.2, 0.008);
    const f = 4 + alea() * 6;
    const ph = alea() * 6.28;
    const w = largeur * (0.6 + alea() * 0.8);
    const n = Math.max(6, Math.round((u1 - u0) / 0.02));
    const pos = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const uu = u0 + (u1 - u0) * t;
      const vv = THREE.MathUtils.clamp(v0 + amp * Math.sin(f * uu + ph) + amp * 0.35 * Math.sin(2.7 * f * uu + 1.3 * ph), -V, V);
      const demi = (w / 2) * Math.sqrt(Math.sin(PI * t)); // s'effile aux deux bouts
      for (const s of [-1, 1]) {
        const p = c.clone().addScaledVector(eu, uu).addScaledVector(ev, vv + s * demi);
        pos.push(p.x, p.y, p.z);
      }
      if (i < n) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, materiaux[Math.floor(alea() * materiaux.length)]);
    mesh.receiveShadow = true;
    sortie.push(mesh);
  }
  return sortie;
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
function thinkpad(m) {
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
  const tch = (u0, w, z0, h, materiau = touche) => el.push(boite([w * U - JEU, HT, h * U - JEU], materiau, [xk(u0 + w / 2), yt, z0 + (h * U) / 2], { r: 0.0009 }));
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
  const logo = (y) => {
    const g = new THREE.Group();
    g.add(boite([0.034, 0.0003, 0.0052], argent, [0, 0, 0], { r: 0.0008 }));
    g.add(boite([0.0026, 0.0005, 0.0026], rouge, [-0.0083, 0, -0.0045], { r: 0.0008 }));
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
  dalle.name = 'ecran-thinkpad';
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
  const logoCapot = logo(EPC);
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
// ===========================================================================================
function tapisDeSouris(m, L, P) {
  const R = 0.011;
  const E = 0.004;
  const forme = rectArrondi(new THREE.Shape(), -L / 2, -P / 2, L / 2, P / 2, R);
  const mousse = new THREE.ExtrudeGeometry(forme, { depth: E, bevelEnabled: false, curveSegments: 6 });
  mousse.rotateX(-PI / 2);
  const dessus = new THREE.ShapeGeometry(forme, 6);
  const uv = dessus.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + L / 2) / L, (uv.getY(i) + P / 2) / P);
  dessus.rotateX(-PI / 2);
  dessus.translate(0, E + 0.0008, 0); // 0,8 mm au-dessus de la mousse : plus près, l'image scintillait de loin
  const image = new THREE.Mesh(dessus, m.uni('#1d1b22'));
  image.name = 'tapis-souris';
  image.receiveShadow = true;
  const k = [1 - 0.0016 / L, 1 - 0.0016 / P];
  const pts = forme.getSpacedPoints(200).slice(0, -1).map((q) => new THREE.Vector3(q.x * k[0], E - 0.0001, -q.y * k[1]));
  const couture = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 260, 0.0013, 5, true);
  return groupe('objet_tapis', ombres(new THREE.Mesh(mousse, m.uni('#26242d'))), image, ombres(new THREE.Mesh(couture, m.uni('#1b1a20'))));
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
// dedans, douille), le petit bouton pour l'orienter, et le cordon qui file vers le mur. Mesures : base Ø 23 cm
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
  el.push(tube([[0.098, Y + 0.004, -0.035], [0.16, Y + 0.0025, -0.058], [0.205, Y - 0.006, -0.074], [0.222, Y - 0.12, -0.08], [0.226, 0.006, -0.083], [0.3, 0.003, -0.11]], 0.0025, m.uni('#3b3946'), 40));
  return groupe('tolomeo', el);
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
function structureBois(m, { L, P, T, ep = 0.028, lames = 5, noeuds = [], graine = 11 }) {
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
      parts.push(boite([0.042, hp, 0.042], bois, [sx * px, 0.006, sz * pz], { r: 0.004 }));
      parts.push(cylindre(0.034, 0.006, m.uni('#d8d0c4'), [sx * px, 0, sz * pz], { segments: 10 })); // patin
      // des veines sur les quatre faces du pied, dans le sens du fil (vertical)
      const yMilieu = 0.006 + hp / 2;
      for (const [n, v] of [[[1, 0, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, -1]], [[0, 0, 1], [-1, 0, 0]], [[0, 0, -1], [1, 0, 0]]]) {
        const centre = [sx * px + n[0] * 0.021, yMilieu, sz * pz + n[2] * 0.021];
        parts.push(...veines({ centre, u: [0, 1, 0], v, U: hp / 2 - 0.01, V: 0.017, nb: 2, materiaux: veinesPieds, graine: g++ }));
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
// Origine : le centre du dessous ; posée sur le bandana, lui-même sur le retour : sa hauteur (34,25 cm) est comprise
// dans le modèle, comme pour la lampe.
// ===========================================================================================
function tasse() {
  const m = creerMateriaux();
  const Y = 0.3425; // le dessus du bandana
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
// --- Le bandana du Season's Greetings 2027 de NMIXX, « Mixx on the Road » (65 × 65 cm), sous la tasse ---
// Son imprimé est tiré de la planche du coffret (public/textures/bandana-mixx.jpg, collé par le programme sur le
// maillage « imprime-bandana ») : les faux-plis de la photo viennent avec. Le retour (70 × 39 cm) est trop étroit pour
// l'étaler : il est plié en deux dans la longueur (on voit la moitié gauche de l'imprimé, 38 cm de large), posé à
// plat sous la tasse, puis il passe par-dessus le bord avant du retour et pend vers la pièce. Le haut de
// l'imprimé (le collage rose) est à plat, le bas (le grand emblème « Mixx on the Road ») pend, à l'endroit pour
// qui regarde depuis la chambre. Plis : de petites bosses à plat (pas sous la tasse), un arrondi sur le bord du
// retour, des plis verticaux qui se creusent vers le bas, l'ourlet qui ondule ; le pli du tissu d'un côté, les
// deux ourlets de l'autre, l'envers plus pâle dessous.
// Origine : le bord avant du dessus du retour, au milieu du bandana ; le tissu pend vers +x.
// ===========================================================================================
function bandana() {
  const m = creerMateriaux();
  // plié en quatre (32,5 cm de côté), tout à plat sous la tasse : rien ne dépasse du retour
  const LONG = 0.325;
  const LARGE = 0.32;
  const A = 0.325; // tout est à plat
  const RB = 0.012; // l'arrondi sur le bord du retour
  const ARC = (PI / 2) * RB;
  const YT = 0.3415; // le dessus du tissu (plié en deux) sur le retour
  const TASSE = [-0.17, 0.025]; // la tasse, dans ce repère : rien ne bosse dessous
  const EP = 0.0015;
  // le point du tissu à la distance s du bout posé (le long) et w du bord droit vu depuis la pièce (en travers)
  const point = (s, w) => {
    const z = -LARGE / 2 + w;
    let x;
    let y;
    if (s < A) {
      x = s - A;
      y = YT;
      const loinTasse = Math.hypot(x - TASSE[0], z - TASSE[1]) > 0.065;
      if (loinTasse && s > 0.01) y += 0.0016 * Math.max(0, Math.sin(19 * s + 2) * Math.sin(23 * w + 1)) * Math.min(1, (A - s) / 0.05 + 0.2);
    } else if (s < A + ARC) {
      const t = (s - A) / RB;
      x = RB * Math.sin(t);
      y = YT - RB + RB * Math.cos(t);
    } else {
      const d = s - A - ARC; // ce qui pend
      const creux = 0.016 * Math.min(1, d / 0.28) ** 1.3;
      x = RB + 0.03 * d + creux * (0.75 * Math.sin((2 * PI * z) / 0.115 + 1.3) + 0.35 * Math.sin((2 * PI * z) / 0.047 + 0.4) + 0.75);
      y = YT - RB - d;
    }
    return new THREE.Vector3(x, y, z);
  };
  const [nS, nW] = [96, 28];
  const pos = [];
  const uv = [];
  for (let i = 0; i <= nS; i++) {
    for (let j = 0; j <= nW; j++) {
      const s = (i / nS) * LONG;
      const w = (j / nW) * LARGE;
      pos.push(...point(s, w).toArray());
      uv.push(0.12 + 0.5 * (1 - j / nW), 0.5 * (1 - s / LONG)); // le quart du bas, avec tout le grand emblème
    }
  }
  const idx = [];
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < nW; j++) {
      const a = i * (nW + 1) + j;
      idx.push(a, a + 1, a + nW + 1, a + 1, a + nW + 2, a + nW + 1); // face imprimée vers le haut, puis vers la pièce
    }
  }
  const dessus = new THREE.BufferGeometry();
  dessus.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  dessus.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  dessus.setIndex(idx);
  dessus.computeVertexNormals();
  // l'envers : la même surface, 1,5 mm en retrait, tournée dans l'autre sens
  const n = dessus.attributes.normal;
  const posEnvers = pos.map((v, k) => v - n.array[k] * EP);
  const idxEnvers = [];
  for (let k = 0; k < idx.length; k += 3) idxEnvers.push(idx[k], idx[k + 2], idx[k + 1]);
  const envers = new THREE.BufferGeometry();
  envers.setAttribute('position', new THREE.Float32BufferAttribute(posEnvers, 3));
  envers.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(uv.length), 2));
  envers.setIndex(idxEnvers);
  envers.computeVertexNormals();
  const imprime = new THREE.Mesh(dessus, m.uni('#e8dfe4'));
  imprime.name = 'imprime-bandana'; // pas « bandana » : le modèle porte déjà ce nom, et le chargeur renommerait le doublon
  imprime.castShadow = true;
  imprime.receiveShadow = true;
  const el = [imprime, ombres(new THREE.Mesh(envers, m.uni('#ece6e8')))];
  // les bords : le pli du tissu (côté −z, un bourrelet arrondi), les deux ourlets (côté +z), l'ourlet du bas
  const bord = (w) => Array.from({ length: 49 }, (_, k) => point((k / 48) * LONG, w).toArray());
  el.push(tube(bord(0.0004), EP * 0.75, m.uni('#ddd4d8'), 120));
  el.push(tube(bord(LARGE - 0.0004), 0.001, m.uni('#e4dce0'), 120));
  el.push(tube(Array.from({ length: 29 }, (_, k) => point(LONG - 0.0004, (k / 28) * LARGE).toArray()), 0.001, m.uni('#e4dce0'), 60));
  return groupe('bandana', el);
}

// nom du fichier -> fonction qui construit le modèle (fusionné : un maillage par matériau)
const fabrique = (f) => () => fusionner(f());
export const modelesReve = {
  bibliotheque: fabrique(bibliotheque),
  tapis: fabrique(tapis),
  plante: fabrique(plante),
  'bureau-bas': fabrique(bureauBas),
  'bureau-retour': fabrique(bureauRetour),
  'chaise-sol': fabrique(chaiseSol),
  tolomeo: fabrique(tolomeo),
  tasse: fabrique(tasse),
  bandana: fabrique(bandana),
};
