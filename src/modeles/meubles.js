import * as THREE from 'three';
import { veinerBois, creerMateriaux, boite, cylindre, sphere, tore, barre, tube, tourne, tissu, plan, pales, grille, fusionner } from './outils.js';

// Les meubles de la chambre, modélisés à la main (en code) d'après tes photos, dans
// le style de la référence : couleurs unies, pastel, mates, et le détail dans la
// géométrie (tressage de l'osier, charnières, vis, grilles de ventilateur…).
// Chaque fonction renvoie un groupe dont l'origine est le centre du meuble au sol,
// exactement comme les formes provisoires de chambre.js : le modèle se pose donc au
// même endroit, sans réglage. `fusionner` regroupe ensuite tout en un seul maillage
// par matériau. Le résultat est exporté en .glb (public/models/) par la page modeles.html.

const PI = Math.PI;
const groupe = (nom, ...enfants) => {
  const g = new THREE.Group();
  g.name = nom;
  g.add(...enfants);
  return g;
};
// un maillage qui porte et reçoit les ombres
const ombres = (o) => {
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
const axeX = [0, 0, PI / 2]; // couche un cylindre pour que son axe soit x
const axeZ = [PI / 2, 0, 0]; // … ou z

// Extrude une forme 2D (dessinée en X, Y) sur `profondeur` et la place dans le repère
// du meuble avec `matrice`.
function extrusion(forme, profondeur, materiau, matrice) {
  const geo = new THREE.ExtrudeGeometry(forme, { depth: profondeur, bevelEnabled: false, curveSegments: 10 });
  geo.applyMatrix4(matrice);
  const m = new THREE.Mesh(geo, materiau);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Bande plate qui suit une courbe dessinée dans le plan du mur : points = [[y, z], …].
// Le mur est en x ; `x` = position, `ep` = épaisseur (x), `larg` = largeur (dans le plan).
function bande(points, x, ep, larg, materiau) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [y0, z0] = points[i];
    const [y1, z1] = points[i + 1];
    const longueur = Math.hypot(y1 - y0, z1 - z0) + larg * 0.3; // léger recouvrement aux jonctions
    const m = new THREE.Mesh(new THREE.BoxGeometry(ep, longueur, larg), materiau);
    m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
    m.rotation.x = Math.atan2(z1 - z0, y1 - y0);
    m.castShadow = true;
    m.receiveShadow = true;
    out.push(m);
  }
  return out;
}

// Oreiller : un coussin bombé au centre, aux bords et aux coins pincés (là où la taie est
// cousue), avec de petits plis. Dimensions : l (x), h (hauteur au centre), p (z).
export function oreiller(l, h, p, materiau, [x, yBas, z], graine = 1) {
  const geo = new THREE.BoxGeometry(l, h, p, 12, 4, 16);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const nx = Math.abs(vx) / (l / 2);
    const nz = Math.abs(vz) / (p / 2);
    const e = (nx ** 2 + nz ** 2) / 2; // 0 au centre, 1 sur le bord
    const bombe = Math.max(0.1, Math.sqrt(Math.max(0, 1 - e))); // coupe en lentille : épais au milieu, fin au bord
    const pli = 0.003 * Math.sin(vx * 38 + graine) * Math.sin(vz * 31 + graine * 2);
    pos.setXYZ(i, vx * (1 - 0.04 * nz ** 2), vy * bombe + pli, vz * (1 - 0.05 * nx ** 2));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, materiau);
  m.position.set(x, yBas + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Un câble qui descend le long d'un fût, passe par-dessus le pied rond (il suit sa surface, sans le traverser) et
// finit au sol. `haut` : ses points le long du fût, jusqu'au bas ; `dessus` : le dessus du pied (des points [rayon,
// hauteur] de son profil de révolution) ; `fin` : ses points au sol après le pied ; `marge` : de combien il flotte
// au-dessus (plus si le pied a un jonc ou une arête vive).
function cableSurPied(haut, dessus, fin, rayon, materiau, marge = 0.003) {
  const [x0, , z0] = haut[haut.length - 1];
  const a = Math.atan2(z0, x0);
  const r0 = Math.hypot(x0, z0);
  const pts = [...dessus].sort((p, q) => p[0] - q[0]);
  const h = (r) => {
    if (r <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (r <= pts[i][0]) {
        const [ra, ha] = pts[i - 1];
        const [rb, hb] = pts[i];
        return ha + ((hb - ha) * (r - ra)) / (rb - ra);
      }
    }
    return 0;
  };
  const rBord = pts[pts.length - 1][0];
  const surPied = [];
  for (let r = r0; r < rBord; r += 0.012) surPied.push([r * Math.cos(a), h(r) + rayon + marge, r * Math.sin(a)]);
  surPied.push([(rBord + 0.007) * Math.cos(a), h(rBord) + rayon * 0.8, (rBord + 0.007) * Math.sin(a)]);
  surPied.push([(rBord + 0.02) * Math.cos(a), rayon + 0.001, (rBord + 0.02) * Math.sin(a)]);
  return tube([...haut, ...surPied, ...fin], rayon, materiau, 90);
}

// --- Lit 160 × 210 : plateforme en chêne, couette à carreaux, tête de lit à deux lattes ---
function lit() {
  const m = creerMateriaux();
  const pieds = [
    [0.95, 0.78],
    [0.95, -0.78],
    [-0.95, 0.78],
    [-0.95, -0.78],
  ].flatMap(([x, z]) => [
    cylindre(0.07, 0.09, m.cheneFonce, [x, 0.008, z], { dBas: 0.056 }),
    cylindre(0.06, 0.012, m.noirMat, [x, 0, z]), // patin
  ]);
  // panneaux encastrés sur les côtés de la plateforme
  const panneaux = [];
  for (const z of [0.852, -0.852]) for (const x of [-0.5, 0.5]) panneaux.push(boite([0.8, 0.12, 0.004], m.cheneFonce, [x, 0.14, z], { r: 0.002 }));
  for (const z of [0.42, -0.42]) panneaux.push(boite([0.004, 0.12, 0.7], m.cheneFonce, [-1.052, 0.14, z], { r: 0.002 }));
  // la tête ronde d'une vis sur le pied du lit, comme sur la photo
  const vis = cylindre(0.026, 0.006, m.cheneClair, [-1.06, 0.16, 0.58], { rot: axeX, centre: true, segments: 14 });

  const refCouette = [-1.04, 0.6, -0.83, 0.83]; // zone couverte par le motif à carreaux
  // tête de lit plaquée contre le mur est (x = 3,6 dans la pièce, donc 1,1 ici) :
  // deux grandes lattes de chêne, avec deux barres métalliques plates derrière,
  // visibles dans l'espace entre les lattes
  const barres = [0.72, -0.72].map((z) => boite([0.02, 0.62, 0.05], m.metal, [1.09, 0.3, z], { r: 0.003 }));

  return groupe(
    'lit',
    ...pieds,
    boite([2.12, 0.2, 1.7], m.chene, [0.01, 0.1, 0], { r: 0.012 }),
    ...panneaux,
    vis,
    // rebord plus clair tout autour de la plateforme
    boite([2.1, 0.04, 0.06], m.cheneClair, [0, 0.3, 0.82], { r: 0.01 }),
    boite([2.1, 0.04, 0.06], m.cheneClair, [0, 0.3, -0.82], { r: 0.01 }),
    boite([0.06, 0.04, 1.7], m.cheneClair, [-1.02, 0.3, 0], { r: 0.01 }),
    // matelas posé sur la plateforme, à l'intérieur des rebords : rien ne se touche
    tissu([1.94, 0.29, 1.52], m.drap, [-0.015, 0.2, 0], { r: 0.05, froissement: 0.002, divisions: [8, 2, 8] }),
    // couette : plus large que le matelas, elle descend jusque dans les rebords (qui s'arrêtent à 34 cm) : plus de fente
    tissu([1.64, 0.27, 1.66], m.couette, [-0.22, 0.32, 0], { r: 0.05, froissement: 0.01, graine: 3, uvDessus: refCouette, divisions: [26, 4, 28] }),
    // un seul oreiller, au centre du lit, contre la tête de lit
    oreiller(0.5, 0.2, 0.7, m.oreillerOrange, [0.76, 0.48, 0], 5),
    // les deux lattes (basse et haute) et les barres derrière
    boite([0.03, 0.18, 1.76], m.chene, [1.065, 0.42, 0], { r: 0.008 }),
    boite([0.03, 0.2, 1.76], m.chene, [1.065, 0.7, 0], { r: 0.008 }),
    ...barres,
  );
}

// --- Commode MALM à 4 tiroirs, en chêne, d'après tes photos ---
// Flancs lisses ; quatre grandes façades pleine largeur, épaisses, qui avancent devant le caisson et
// ne se touchent pas : entre deux façades, une fente d'ombre (c'est par là qu'on tire le tiroir, il n'y a
// pas de poignée). Plateau fin qui déborde un peu, socle en retrait. La face avant regarde -x.
function commode() {
  const m = creerMateriaux();
  const FACE = -0.25; // plan de la face avant du caisson
  const EP = 0.02; // épaisseur d'une façade
  const tiroirs = [];
  const hauteurs = [0.222, 0.222, 0.222, 0.222]; // de 5 cm à 97,4 cm : une fente d'ombre reste sous le plateau
  let bas = 0.05;
  for (const h of hauteurs) {
    tiroirs.push(boite([EP, h, 0.8], m.commode, [FACE - EP / 2, bas, 0], { r: 0.004 }));
    bas += h + 0.012; // fente d'ombre entre deux façades
  }
  return groupe(
    'commode',
    boite([0.44, 0.045, 0.76], m.cheneFonce, [0.02, 0, 0], { r: 0.004 }), // socle en retrait
    boite([0.5, 0.935, 0.8], m.commode, [0, 0.045, 0], { r: 0.006 }), // caisson, flancs lisses
    // le fond des fentes : la face du caisson, plus sombre, derrière les façades
    boite([0.004, 0.93, 0.79], m.cheneFonce, [FACE - 0.002, 0.048, 0], { r: 0.001 }),
    boite([0.52, 0.02, 0.81], m.commode, [-0.01, 0.98, 0], { r: 0.006 }), // plateau qui déborde devant
    boite([0.004, 0.012, 0.81], m.cheneFonce, [-0.272, 0.984, 0], { r: 0.001 }), // chant du plateau
    ...tiroirs,
  );
}

// --- Lampadaire en acier brossé : double fût, grande vasque en verre dépoli, liseuse ---
function lampadaire() {
  const m = creerMateriaux();
  const rayonsVasque = [0, 120, 240].map((deg) => {
    const a = (deg * PI) / 180;
    return barre([0, 1.745, 0], [0.17 * Math.cos(a), 1.79, 0.17 * Math.sin(a)], 0.0035, m.metalClair, 6);
  });
  return groupe(
    'lampadaire',
    // pied lesté
    tourne([[0, 0], [0.15, 0], [0.15, 0.01], [0.14, 0.02], [0.06, 0.03], [0.04, 0.05], [0.025, 0.055], [0.0175, 0.06]], m.metalClair, [0, 0, 0]),
    tore(0.285, 0.006, m.metalFonce, [0, 0.012, 0], [PI / 2, 0, 0]),
    // double fût avec trois manchons
    cylindre(0.02, 1.7, m.metalClair, [0, 0.05, 0.016]),
    cylindre(0.02, 1.7, m.metalClair, [0, 0.05, -0.016]),
    ...[0.5, 1.2, 1.62].map((y) => cylindre(0.05, 0.02, m.metalFonce, [0, y, 0])),
    // variateur : boîtier, molette et deux boutons
    boite([0.05, 0.1, 0.06], m.metalFonce, [0, 0.95, 0], { r: 0.01 }),
    cylindre(0.036, 0.012, m.noirMat, [0, 1.0, 0.031], { rot: axeZ, centre: true }),
    cylindre(0.012, 0.008, m.noirMat, [-0.012, 0.96, 0.032], { rot: axeZ, centre: true }),
    cylindre(0.012, 0.008, m.noirMat, [0.012, 0.96, 0.032], { rot: axeZ, centre: true }),
    // câble qui descend le long du fût, passe par-dessus le pied lesté (et son jonc) et part vers le mur
    cableSurPied(
      [[0, 0.95, -0.034], [0.004, 0.5, -0.042], [0, 0.12, -0.04]],
      [[0.15, 0.01], [0.14, 0.02], [0.06, 0.03], [0.04, 0.05], [0.025, 0.055], [0.0175, 0.06]],
      [[0.03, 0.008, -0.2], [0.07, 0.008, -0.25], [0.12, 0.008, -0.3]],
      0.004,
      m.noirMat,
      0.007,
    ),
    // grande vasque : coupe fine, jonc, trois rayons, capuchon
    tourne([[0.03, 0], [0.08, -0.012], [0.14, 0.002], [0.18, 0.04], [0.185, 0.065], [0.18, 0.066], [0.175, 0.04], [0.14, 0.02], [0.08, 0.012], [0.03, 0.008]], m.verreDepoli, [0, 1.74, 0]),
    tore(0.37, 0.004, m.metalClair, [0, 1.805, 0], [PI / 2, 0, 0]),
    ...rayonsVasque,
    cylindre(0.05, 0.016, m.metalFonce, [0, 1.74, 0]),
    // liseuse : collier, bras à deux articulations, petite vasque et son jonc
    boite([0.034, 0.04, 0.05], m.metalFonce, [0, 1.33, 0], { r: 0.006 }),
    tube([[0, 1.35, 0], [0.05, 1.45, 0], [0.14, 1.54, 0], [0.24, 1.585, 0], [0.3, 1.6, 0]], 0.0065, m.metalClair),
    sphere(0.02, m.metalFonce, [0.05, 1.45, 0]),
    sphere(0.02, m.metalFonce, [0.24, 1.585, 0]),
    tourne([[0.012, 0], [0.04, -0.012], [0.07, 0.0], [0.078, 0.022], [0.073, 0.023], [0.04, 0.006], [0.012, 0.012]], m.verreDepoli, [0.31, 1.58, 0]),
    tore(0.156, 0.003, m.metalClair, [0.31, 1.602, 0], [PI / 2, 0, 0]),
  );
}

// MacBook Air 13" ouvert (304 × 215 mm), posé sur le bureau, l'écran tourné vers la chaise (côté +z).
// (x, y, z) = centre du dessous de la base ; y = hauteur du plateau de verre.
//  - base en coin : 11,3 mm à la charnière, 4 mm devant, le dessus penche donc vers l'utilisateur ;
//  - clavier de 69 touches sur 6 rangées (rangée des fonctions plus basse, flèches en demi-hauteur),
//    fente de ventilation sous la charnière ; trackpad large entouré d'un fin sillon ;
//  - charnière cylindrique, capot arrondi avec la pomme, écran noir encadré avec encoche et caméra ;
//  - quatre pieds en caoutchouc, ports sur le flanc gauche, prise casque à droite.
export function macbook(m, x, y, z) {
  const L = 0.304;
  const P = 0.215;
  const EP = 0.0113; // épaisseur à la charnière
  const EF = 0.004; // épaisseur au bord avant
  const PENTE = (EP - EF) / P;
  const ANG = Math.atan(PENTE);
  const PIEDS = 0.0015;
  const biseau = 0.0012; // arrondi des arêtes de la base : il rehausse le dessus d'autant
  const base = y + PIEDS; // dessous de la base
  const zh = z - P / 2; // z du bord arrière (charnière)
  const dessus = (zr) => base + EP + biseau - PENTE * zr; // hauteur du dessus à la profondeur zr (0 = charnière)
  const el = [];

  // — base en coin : profil (z, y) extrudé sur la largeur, biseauté sur les arêtes —
  const forme = new THREE.Shape();
  forme.moveTo(0, 0);
  forme.lineTo(-P, 0);
  forme.lineTo(-P, EF);
  forme.lineTo(0, EP);
  forme.closePath();
  const geo = new THREE.ExtrudeGeometry(forme, { depth: L - 2 * biseau, bevelEnabled: true, bevelThickness: biseau, bevelSize: biseau, bevelSegments: 2 });
  geo.translate(0, 0, biseau - L / 2 + biseau);
  geo.rotateY(Math.PI / 2); // l'extrusion devient la largeur (x) et la profondeur (z) s'étend vers l'avant
  const chassis = new THREE.Mesh(geo, m.metalClair);
  chassis.position.set(x, base, zh);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  el.push(chassis);

  // — clavier : les touches rangée par rangée, directement sur l'aluminium —
  const U = 0.019; // pas d'une touche
  const largeurClavier = 15 * U;
  const zClavier = 0.019;
  const profondeurClavier = 0.0095 + 0.0025 + 5 * U;
  const rangees = [
    { h: 0.0095, largeurs: [1.5, ...Array(12).fill(1), 1.5] }, // échap, F1–F12, Touch ID
    { h: 0.0165, largeurs: [...Array(13).fill(1), 2] }, // chiffres, supprimer
    { h: 0.0165, largeurs: [1.5, ...Array(12).fill(1), 1.5] }, // tab, AZERTY…
    { h: 0.0165, largeurs: [1.75, ...Array(11).fill(1), 2.25] }, // verr. maj, retour
    { h: 0.0165, largeurs: [2.25, ...Array(10).fill(1), 2.75] }, // maj
    { h: 0.0165, largeurs: [1, 1, 1, 1.25, 5.5, 1.25, 1, 'fleches'] }, // bas du clavier + flèches
  ];
  let c = zClavier + 0.002;
  for (const rg of rangees) {
    let xu = -largeurClavier / 2;
    const zc = c + rg.h / 2;
    for (const w of rg.largeurs) {
      if (w === 'fleches') {
        // ◀ ▲/▼ ▶ : la touche du haut et celle du bas ont chacune une demi-hauteur
        for (const k of [0, 1, 2]) {
          const xk = x + xu + (k + 0.5) * U;
          if (k === 1) {
            for (const dz of [-0.0045, 0.0045]) el.push(boite([U - 0.0025, 0.0012, 0.0078], m.noir, [xk, dessus(zc + dz) + 0.0003, zh + zc + dz], { r: 0.0008, rot: [ANG, 0, 0] }));
          } else {
            el.push(boite([U - 0.0025, 0.0012, 0.0078], m.noir, [xk, dessus(zc + 0.0045) + 0.0003, zh + zc + 0.0045], { r: 0.0008, rot: [ANG, 0, 0] }));
          }
        }
        xu += 3 * U;
        continue;
      }
      const lg = w * U - 0.0025;
      el.push(boite([lg, 0.0012, rg.h], m.noir, [x + xu + (w * U) / 2, dessus(zc) + 0.0003, zh + zc], { r: 0.0008, rot: [ANG, 0, 0] }));
      xu += w * U;
    }
    c += rg.h + 0.0025 + (rg === rangees[0] ? 0 : 0.0025);
  }
  // fente de ventilation sous la charnière
  el.push(boite([0.24, 0.0004, 0.0016], m.noirMat, [x, dessus(0.0105) + 0.0002, zh + 0.0105], { r: 0.0004, rot: [ANG, 0, 0] }));

  // — trackpad : large, avec un sillon sombre tout autour —
  const zt = 0.1385 + 0.034;
  el.push(boite([0.112, 0.0004, 0.072], m.noirMat, [x, dessus(zt) - 0.0001, zh + zt], { r: 0.003, rot: [ANG, 0, 0] }));
  el.push(boite([0.108, 0.0006, 0.068], m.metal, [x, dessus(zt) + 0.0001, zh + zt], { r: 0.003, rot: [ANG, 0, 0] }));

  // — pieds en caoutchouc —
  for (const sx of [-0.13, 0.13]) for (const sz of [0.025, 0.19]) el.push(cylindre(0.014, PIEDS, m.noirMat, [x + sx, y, zh + sz], { segments: 12 }));

  // — ports : deux USB-C et MagSafe à gauche, prise casque à droite —
  for (const dz of [0.04, 0.062, 0.084]) el.push(boite([0.0006, 0.0028, 0.009], m.noirMat, [x - L / 2 - 0.0002, base + 0.0042, zh + dz], { r: 0.0008 }));
  el.push(cylindre(0.0035, 0.0006, m.noirMat, [x + L / 2 + 0.0002, base + 0.0045, zh + 0.04], { rot: axeX, centre: true, segments: 10 }));

  // — charnière : un cylindre sombre entre la base et le capot —
  const yh = base + EP + biseau - 0.0018;
  el.push(cylindre(0.0075, 0.226, m.metalFonce, [x, yh, zh + 0.001], { rot: axeX, centre: true, segments: 14 }));

  // — capot et écran, groupés pour pivoter autour de la charnière —
  const couvercle = new THREE.Group();
  couvercle.position.set(x, yh + 0.0035, zh + 0.0015);
  couvercle.name = 'pivot_capot'; // le programme le fait pivoter (ouvert : -1,95 rad ; fermé : le dessus de la base, ~0,034)
  couvercle.rotation.x = -1.95; // ouvert à 112°
  const ep = 0.0045;
  const prof = 0.2115;
  couvercle.add(boite([L, ep, prof], m.metalClair, [0, 0, prof / 2], { r: 0.0022 })); // capot en aluminium
  couvercle.add(boite([0.298, 0.0007, prof - 0.006], m.noirMat, [0, -0.0007, prof / 2], { r: 0.0012 })); // cadre noir
  // dalle de l'écran : un plan (l'image du site est collée dessus par le programme, qui le repère par son nom)
  const dalle = new THREE.Mesh(new THREE.PlaneGeometry(0.289, 0.1885), m.ecran);
  dalle.rotation.x = Math.PI / 2; // la face regarde vers -y local, c'est-à-dire vers l'utilisateur
  dalle.position.set(0, -0.00165, prof / 2 + 0.002);
  dalle.name = 'ecran-mac';
  couvercle.add(dalle);
  couvercle.add(boite([0.056, 0.0007, 0.0085], m.noirMat, [0, -0.0014, prof - 0.0105], { r: 0.0025 })); // encoche
  couvercle.add(sphere(0.0034, m.uni('#2a3550'), [0, -0.0017, prof - 0.0105])); // objectif de la caméra
  // la pomme, au dos du capot : deux lobes, une feuille, et la « morsure » suggérée par un creux
  const cz = prof / 2 + 0.006;
  couvercle.add(sphere(0.0165, m.chrome, [-0.0042, ep + 0.0004, cz], { echelle: [1, 0.12, 1.02] }));
  couvercle.add(sphere(0.0165, m.chrome, [0.0042, ep + 0.0004, cz], { echelle: [1, 0.12, 1.02] }));
  couvercle.add(boite([0.0036, 0.0004, 0.0072], m.chrome, [0.0016, ep + 0.0004, cz - 0.0122], { r: 0.0009, rot: [0, 0.5, 0] }));
  el.push(couvercle);
  return [groupe('objet_mac', ...el)]; // tout le Mac forme un objet à part : on peut cliquer dessus
}

// --- Bureau en bouleau : deux flancs pleins, plateau et plaque de verre, retrait au dos ---
function bureau({ mac = true } = {}) {
  const m = creerMateriaux();
  // petits patins de protection aux quatre coins de la plaque de verre
  const patins = [-0.66, 0.66].flatMap((x) => [-0.26, 0.26].map((z) => cylindre(0.022, 0.004, m.metalClair, [x, 0.7585, z], { segments: 12 })));
  return groupe(
    'bureau',
    boite([1.4, 0.03, 0.6], m.bouleau, [0, 0.72, 0], { r: 0.006 }),
    boite([1.404, 0.012, 0.604], m.bouleauFonce, [0, 0.729, 0], { r: 0.004 }), // chant du plateau
    boite([1.38, 0.006, 0.58], m.verreBureau, [0, 0.75, 0], { r: 0.002 }),
    ...patins,
    // les deux flancs : de grands panneaux pleins sur toute la profondeur
    boite([0.025, 0.72, 0.6], m.bouleau, [-0.6875, 0, 0], { r: 0.005 }),
    boite([0.025, 0.72, 0.6], m.bouleau, [0.6875, 0, 0], { r: 0.005 }),
    // panneau de retrait blanc, en haut au fond, sans descendre jusqu'au sol
    boite([1.35, 0.17, 0.016], m.creme, [0, 0.55, -0.22], { r: 0.003 }),
    ...(mac ? macbook(m, 0.12, 0.756, 0.02) : []),
    ...boiteArchives(m, [-0.25, 0, -0.08]),
    ...panierFleuriste(m, [0.19, 0, -0.1]),
  );
}

// Sous le bureau, d'après ta photo : la boîte d'archives Lyreco, blanche à liseré bleu. Sur la face avant
// (qui regarde +z) : une rangée d'étiquettes bleues à bandeau blanc sous le couvercle et un cadre bleu
// imprimé. [x, y, z] = centre du dessous.
function boiteArchives(m, [x, y, z]) {
  const bleu = m.uni('#8aa6e4');
  const [L, H, P] = [0.5, 0.29, 0.36];
  const avant = z + P / 2 + 0.001;
  const etiquettes = [-0.18, -0.09, 0, 0.09, 0.18].flatMap((dx) => [
    boite([0.07, 0.035, 0.003], bleu, [x + dx, y + H - 0.075, avant], { r: 0.001 }),
    boite([0.044, 0.008, 0.002], m.blanc, [x + dx, y + H - 0.062, avant + 0.002], { r: 0.001 }), // « Lyreco »
  ]);
  // cadre imprimé : quatre filets bleus
  const cadre = [
    boite([L - 0.06, 0.004, 0.002], bleu, [x, y + 0.04, avant]),
    boite([L - 0.06, 0.004, 0.002], bleu, [x, y + H - 0.1, avant]),
    boite([0.004, H - 0.14, 0.002], bleu, [x - L / 2 + 0.03, y + 0.04, avant]),
    boite([0.004, H - 0.14, 0.002], bleu, [x + L / 2 - 0.03, y + 0.04, avant]),
  ];
  // poignées découpées dans les petits côtés
  const poignees = [x - L / 2 - 0.001, x + L / 2 + 0.001].map((px) => boite([0.002, 0.025, 0.09], m.noirMat, [px, y + H - 0.09, z], { r: 0.001 }));
  return [
    boite([L, H, P], m.blanc, [x, y, z], { r: 0.004 }),
    boite([L + 0.01, 0.035, P + 0.01], m.blanc, [x, y + H - 0.03, z], { r: 0.004 }), // couvercle
    boite([L + 0.002, 0.018, P + 0.002], bleu, [x, y + 0.008, z], { r: 0.002 }), // liseré bleu du bas
    ...etiquettes,
    ...cadre,
    ...poignees,
  ];
}

// Le panier « Flower Shop » : un coffre en osier tressé en forme de petite boutique, toit vert arrondi,
// deux fenêtres en arc et une porte rose sur la face avant (+z). [x, y, z] = centre du dessous.
function panierFleuriste(m, [x, y, z]) {
  const vert = m.uni('#7f9e83');
  const vertFonce = m.uni('#5f7f66');
  const rose = m.uni('#eeb2c2');
  const [L, H, P] = [0.32, 0.26, 0.24];
  const avant = z + P / 2 + 0.002;
  const rangs = [];
  for (let k = 0; k < 9; k++) rangs.push(boite([L + 0.004, 0.012, P + 0.004], k % 2 ? m.osierPaille : m.osierFonce, [x, y + 0.012 + k * 0.028, z], { r: 0.003 }));
  // une fenêtre en arc : cadre vert, carreaux clairs et croisillon
  const fenetre = (dx) => [
    boite([0.07, 0.07, 0.003], vert, [x + dx, y + 0.09, avant], { r: 0.002 }),
    cylindre(0.07, 0.003, vert, [x + dx, y + 0.16, avant + 0.0015], { rot: axeZ, centre: true, segments: 18 }), // l'arc
    boite([0.052, 0.06, 0.002], m.creme, [x + dx, y + 0.098, avant + 0.003]),
    cylindre(0.052, 0.002, m.creme, [x + dx, y + 0.158, avant + 0.0035], { rot: axeZ, centre: true, segments: 18 }),
    boite([0.004, 0.09, 0.002], vert, [x + dx, y + 0.098, avant + 0.005]),
    boite([0.052, 0.004, 0.002], vert, [x + dx, y + 0.13, avant + 0.005]),
  ];
  // le tressage du toit : des joncs plus foncés qui en font le tour
  const joncs = [-0.12, -0.06, 0, 0.06, 0.12].map((dx) => cylindre(P + 0.006, 0.01, vertFonce, [x + dx, y + H, z], { rot: axeX, centre: true, segments: 28 }));
  // du lierre peint qui grimpe aux coins de la façade
  const lierre = [-1, 1].flatMap((s) => [0.05, 0.1, 0.15, 0.2].map((h, i) => sphere(0.024 - i * 0.003, vertFonce, [x + s * (L / 2 - 0.02), y + h, avant + 0.004], { echelle: [1, 1, 0.3] })));
  // anses en jonc sur les petits côtés
  const anses = [x - L / 2 - 0.006, x + L / 2 + 0.006].map((px) => tore(0.07, 0.006, m.osierFonce, [px, y + H - 0.06, z], [0, PI / 2, 0]));
  return [
    boite([L, H, P], m.osierPaille, [x, y, z], { r: 0.006 }),
    ...rangs,
    // toit arrondi : un demi-cylindre vert couché le long du coffre, avec son rebord
    cylindre(P, L, vert, [x, y + H, z], { rot: axeX, centre: true, segments: 28 }),
    ...joncs,
    boite([L + 0.012, 0.014, P + 0.012], vertFonce, [x, y + H - 0.007, z], { r: 0.003 }),
    // l'enseigne « FLOWER SHOP » et son lettrage clair
    boite([0.2, 0.026, 0.003], vertFonce, [x, y + H - 0.045, avant], { r: 0.002 }),
    boite([0.15, 0.008, 0.002], m.creme, [x, y + H - 0.036, avant + 0.002]),
    ...fenetre(-0.1),
    ...fenetre(0.1),
    boite([0.06, 0.12, 0.004], rose, [x, y + 0.02, avant + 0.001], { r: 0.003 }), // la porte
    sphere(0.008, m.laiton, [x + 0.018, y + 0.08, avant + 0.004]), // sa poignée
    ...lierre,
    ...anses,
  ];
}

// --- Chaise « luge » : assise en hêtre, tube gris continu de chaque côté, dossier gris ---
// Sur chaque côté un seul tube plie : il monte jusqu'au haut du dossier, descend, court sur
// le sol vers l'avant, puis remonte sous l'assise. Le dossier est un large panneau gris,
// à l'arc concave en bas et au haut légèrement bombé, percé de trois trous empilés.
// Elle regarde vers -z (le bureau) : le dossier est du côté +z.
function chaise() {
  const m = creerMateriaux();
  const hetre = m.uni('#efc58d');
  const R = 0.0125; // rayon des tubes

  // assise : trapèze aux coins arrondis, plus large devant, 2 cm de contreplaqué
  const f = new THREE.Shape();
  f.moveTo(-0.205, -0.18);
  f.quadraticCurveTo(-0.22, -0.215, -0.17, -0.215);
  f.lineTo(0.17, -0.215);
  f.quadraticCurveTo(0.22, -0.215, 0.205, -0.18);
  f.lineTo(0.17, 0.2);
  f.quadraticCurveTo(0.165, 0.215, 0.14, 0.215);
  f.lineTo(-0.14, 0.215);
  f.quadraticCurveTo(-0.165, 0.215, -0.17, 0.2);
  f.closePath();
  const couche = new THREE.Matrix4().makeRotationX(PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, 0.466, 0));
  const assise = extrusion(f, 0.02, hetre, couche);

  // dossier : panneau gris dont le bas est une encoche en arc, légèrement courbé vers l'assise
  const d = new THREE.Shape();
  d.moveTo(-0.205, 0.62);
  d.quadraticCurveTo(0, 0.7, 0.205, 0.62); // encoche concave : plus haut au milieu
  d.lineTo(0.205, 0.795);
  d.quadraticCurveTo(0, 0.815, -0.205, 0.795); // haut légèrement bombé
  d.closePath();
  const geoDos = new THREE.ExtrudeGeometry(d, { depth: 0.012, bevelEnabled: false, curveSegments: 16 });
  const pDos = geoDos.attributes.position;
  for (let i = 0; i < pDos.count; i++) pDos.setZ(i, pDos.getZ(i) - 0.35 * pDos.getX(i) ** 2 + 0.215); // les bouts reviennent vers l'assise
  geoDos.computeVertexNormals();
  const dossier = new THREE.Mesh(geoDos, m.gris);
  dossier.castShadow = true;
  dossier.receiveShadow = true;
  // trois trous empilés, bouchés par du bois
  const trous = [0.775, 0.725, 0.675].map((y) => cylindre(0.034, 0.004, hetre, [0, y, 0.2105], { rot: axeZ, centre: true, segments: 16 }));

  // un tube par côté : dossier -> arrière -> sol -> avant -> assise
  const cote = (s) => {
    const x = 0.205 * s;
    const chemin = [
      [x, 0.8, 0.2],
      [x, 0.47, 0.215],
      [x * 1.02, 0.014, 0.27],
      [x * 1.02, 0.014, -0.19],
      [x, 0.45, -0.19],
    ];
    const morceaux = [];
    for (let i = 0; i < chemin.length - 1; i++) morceaux.push(barre(chemin[i], chemin[i + 1], R, m.gris, 10));
    for (const pt of chemin) morceaux.push(sphere(R * 2, m.gris, pt));
    return morceaux;
  };

  return groupe(
    'chaise',
    assise,
    dossier,
    ...trous,
    ...cote(1),
    ...cote(-1),
    // traverse sous l'assise, entre les deux pieds avant
    barre([-0.2, 0.42, -0.19], [0.2, 0.42, -0.19], 0.008, m.gris, 8),
    // les pieds de caoutchouc sous la barre au sol, à l'arrière
    ...[1, -1].map((s) => cylindre(0.03, 0.01, m.noirMat, [0.209 * s, 0, 0.27])),
  );
}

// --- Vitrine à 4 étagères de verre, tout en verre sur les côtés (43 × 163 cm) ---
function vitrine() {
  const m = creerMateriaux();
  const pieds = [0.18, -0.18].flatMap((x) => [0.14, -0.14].map((z) => cylindre(0.03, 0.03, m.noirMat, [x, 0, z])));
  const montants = [0.205, -0.205].flatMap((x) => [0.155, -0.155].map((z) => boite([0.02, 1.53, 0.02], m.bouleauClair, [x, 0.07, z], { r: 0.003 })));
  // étagères de verre sur quatre taquets chacune
  const etageres = [0.33, 0.66, 0.99, 1.32].flatMap((y) => [
    boite([0.39, 0.008, 0.32], m.verre, [0, y, 0], { r: 0.002 }),
    ...[0.175, -0.175].flatMap((x) => [0.13, -0.13].map((z) => boite([0.014, 0.012, 0.014], m.metal, [x, y - 0.011, z], { r: 0.002 }))),
  ]);
  const charnieres = [0.2, 0.8, 1.4].map((y) => cylindre(0.012, 0.06, m.metalClair, [-0.208, y, 0.178], { segments: 10 }));
  // porte vitrée : verre, cadre, poignée sur deux supports, serrure. Elle pivote autour de ses charnières
  // (axe vertical, côté gauche) et s'ouvre vers la pièce (rotation y négative).
  const porteVitree = groupe(
    'pivot_porte',
    groupe(
      '',
      boite([0.39, 1.5, 0.006], m.verre, [0, 0.085, 0.172], { r: 0.001 }),
      boite([0.018, 1.53, 0.014], m.bouleauClair, [-0.2, 0.07, 0.175], { r: 0.003 }),
      boite([0.018, 1.53, 0.014], m.bouleauClair, [0.2, 0.07, 0.175], { r: 0.003 }),
      boite([0.4, 0.018, 0.014], m.bouleauClair, [0, 0.07, 0.175], { r: 0.003 }),
      boite([0.4, 0.018, 0.014], m.bouleauClair, [0, 1.582, 0.175], { r: 0.003 }),
      boite([0.012, 0.14, 0.012], m.metal, [0.16, 0.72, 0.203], { r: 0.004 }),
      barre([0.16, 0.76, 0.183], [0.16, 0.76, 0.203], 0.004, m.metal, 8),
      barre([0.16, 0.8, 0.183], [0.16, 0.8, 0.203], 0.004, m.metal, 8),
      cylindre(0.014, 0.01, m.metalFonce, [0.178, 0.9, 0.18], { rot: axeZ, centre: true, segments: 10 }),
    ),
  );
  porteVitree.position.set(-0.205, 0, 0.175);
  porteVitree.children[0].position.set(0.205, 0, -0.175);
  return groupe(
    'vitrine',
    ...pieds,
    boite([0.43, 0.04, 0.35], m.bouleauClair, [0, 0.03, 0], { r: 0.004 }),
    boite([0.43, 0.025, 0.35], m.bouleauClair, [0, 1.605, 0], { r: 0.004 }),
    ...montants,
    boite([0.4, 1.53, 0.01], m.creme, [0, 0.07, -0.165], { r: 0.002 }), // fond
    boite([0.006, 1.53, 0.31], m.verre, [0.2, 0.07, 0], { r: 0.001 }),
    boite([0.006, 1.53, 0.31], m.verre, [-0.2, 0.07, 0], { r: 0.001 }),
    ...etageres,
    ...charnieres,
    porteVitree,
  );
}

// --- Le coffre en osier blanc (84 × 44 × 45) et la TV Brandt posée dessus. La face avant regarde +x (le lit). ---
// Le coffre est vraiment tressé : des montants ronds tout autour (un rectangle aux coins arrondis), et des brins
// qui passent un coup devant, un coup derrière eux, en alternance d'un rang à l'autre. Les losanges de la face avant
// sont tissés dans les brins (un brin couleur rotin là où passe un losange). Sur les petits côtés, les
// poignées sont des jours dans le tressage, sous une barre gainée d'un brin enroulé. Des bordures tressées (deux
// brins torsadés) en bas, en haut et autour du couvercle, dont le dessus est un tressage serré (la texture
// « osier-couvercle », dessinée par le programme), quatre petits pieds.
// La TV : la dalle au cadre noir laqué, la bande argentée et le logo Brandt (« marque-tv ») en bas, le récepteur de la
// télécommande et son témoin de veille rouge ; derrière, la coque bombée aux ouïes, les quatre inserts VESA, les
// prises (HDMI, USB, antenne, optique) et le cordon d'alimentation, qui descend derrière le coffre jusqu'au sol (dans
// la chambre de rêve, il rejoint sa prise : voir branchements) ; le pied central (pas de télécommande : tu n'en as pas).
// L'écran est le plan « ecran » : le programme y affiche l'image quand la TV est allumée.
function tv() {
  const m = creerMateriaux();
  const el = [];
  const DX = 0.44; // profondeur (x)
  const DZ = 0.84; // longueur (z)
  const HB = 0.415; // le haut du corps tressé

  // — le tressage —
  const osier = m.osier;
  const osierOmbre = m.uni('#e9e2d2');
  const motif = m.uni('#d8c9a6');
  // le contour des montants : un rectangle aux coins arrondis (demi-côtés a, b, rayon r) ; `point(s)` donne le
  // point et la normale extérieure à l'abscisse s, en partant du milieu de la face avant et en tournant vers +z
  const contour = (a, b, r) => {
    const [lz, lx, q] = [2 * (b - r), 2 * (a - r), (PI * r) / 2];
    const morceaux = [
      [lz / 2, (t) => [a, t, 1, 0]],
      [q, (t) => { const u = t / r; return [a - r + r * Math.cos(u), b - r + r * Math.sin(u), Math.cos(u), Math.sin(u)]; }],
      [lx, (t) => [a - r - t, b, 0, 1]],
      [q, (t) => { const u = PI / 2 + t / r; return [-a + r + r * Math.cos(u), b - r + r * Math.sin(u), Math.cos(u), Math.sin(u)]; }],
      [lz, (t) => [-a, b - r - t, -1, 0]],
      [q, (t) => { const u = PI + t / r; return [-a + r + r * Math.cos(u), -b + r + r * Math.sin(u), Math.cos(u), Math.sin(u)]; }],
      [lx, (t) => [-a + r + t, -b, 0, -1]],
      [q, (t) => { const u = (3 * PI) / 2 + t / r; return [a - r + r * Math.cos(u), -b + r + r * Math.sin(u), Math.cos(u), Math.sin(u)]; }],
      [lz / 2, (t) => [a, -b + r + t, 1, 0]],
    ];
    const L = morceaux.reduce((s, [l]) => s + l, 0);
    const point = (s) => {
      let t = ((s % L) + L) % L;
      for (const [l, f] of morceaux) {
        if (t <= l) return f(t);
        t -= l;
      }
      return morceaux[0][1](0);
    };
    return { L, point };
  };
  const [aM, bM, rM] = [DX / 2 - 0.008, DZ / 2 - 0.008, 0.03];
  const { L, point } = contour(aM, bM, rM);
  const NM = 56; // les montants (un nombre pair : le tressage se referme juste)
  const pas = L / NM;
  // le cœur du coffre, un peu plus sombre (on l'aperçoit entre les brins et par les poignées)
  el.push(boite([2 * aM - 0.006, HB - 0.03, 2 * bM - 0.006], m.uni('#d4c9b1'), [0, 0.03, 0], { r: 0.02 }));
  for (const sz of [-1, 1]) el.push(boite([0.15, 0.06, 0.004], m.noirMat, [0, 0.292, sz * (bM - 0.004)], { r: 0.002 })); // le fond des poignées
  for (let k = 0; k < NM; k++) {
    const [x, z] = point(k * pas);
    el.push(cylindre(0.007, HB - 0.026, osierOmbre, [x, 0.026, z], { segments: 7 }));
  }
  // les rangs : un brin par rang, qui ondule autour des montants ; découpé en tronçons de couleur (le fond, les
  // losanges) et interrompu aux poignées
  const losanges = [-0.3, -0.15, 0, 0.15, 0.3].map((zc, i) => [zc, 0.215, i % 2 ? 0.05 : 0.064]);
  const classe = (x, y, z, nx, nz) => {
    if (Math.abs(nz) > 0.9 && Math.abs(x) < 0.07 && y > 0.293 && y < 0.35) return -1; // le jour de la poignée
    if (nx > 0.9) {
      for (const [zc, yc, d] of losanges) {
        const q = (Math.abs(z - zc) + Math.abs(y - yc)) / d;
        if (q <= 1) return 1;
      }
    }
    return 0;
  };
  const AMP = 0.0045;
  const RB = 0.0075;
  const N_ECH = 4; // points par intervalle entre deux montants
  const brin = (pts, materiau) => {
    if (pts.length < 2) return;
    el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length - 1, RB, 4, false), materiau)));
  };
  const materiaux = { 0: osier, 1: motif };
  for (let j = 0, y = 0.041; y < HB - 0.008; j++, y += 0.0158) {
    const phase = j % 2 ? PI : 0;
    const n = NM * N_ECH;
    let courant = null;
    let tronc = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * L;
      const [x, z, nx, nz] = point(s);
      const off = AMP * Math.cos((PI * s) / pas + phase);
      const p = new THREE.Vector3(x + nx * off, y + 0.0012 * Math.sin((PI * s) / pas + phase), z + nz * off);
      const c = classe(x, y, z, nx, nz);
      if (c !== courant) {
        if (courant !== null && courant >= 0) {
          tronc.push(p);
          brin(tronc, materiaux[courant]);
        }
        tronc = courant !== null && courant >= 0 && c >= 0 ? [tronc.at(-2) ?? p] : [];
        courant = c;
      }
      if (c >= 0) tronc.push(p);
    }
    if (courant >= 0) brin(tronc, materiaux[courant]);
  }
  // les barres des poignées, gainées d'un brin enroulé
  for (const sz of [-1, 1]) {
    const zb = sz * (bM + 0.002);
    el.push(barre([-0.075, 0.356, zb], [0.075, 0.356, zb], 0.0075, osier, 8));
    const spirale = [];
    for (let t = 0; t <= 1; t += 1 / 112) {
      const a = t * 2 * PI * 14;
      spirale.push(new THREE.Vector3(-0.07 + 0.14 * t, 0.356 + 0.0085 * Math.cos(a), zb + 0.0085 * Math.sin(a)));
    }
    el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spirale), 112, 0.0022, 4), osierOmbre)));
  }
  // les bordures tressées : deux brins torsadés autour du contour (décalé de `ecart`), à la hauteur y
  const bordure = (ecart, y, rayon, contourB = null) => {
    const { L: Lb, point: pb } = contourB ?? contour(aM + ecart, bM + ecart, rM + ecart);
    const lam = 0.026;
    const nb = Math.round((Lb / lam) * 4);
    for (const ph of [0, PI]) {
      const pts = [];
      for (let i = 0; i <= nb; i++) {
        const s = (i / nb) * Lb;
        const [x, z, nx, nz] = pb(s);
        const a = (2 * PI * s) / lam + ph;
        const o = rayon * 0.85 * Math.sin(a);
        pts.push(new THREE.Vector3(x + nx * o, y + rayon * 0.85 * Math.cos(a), z + nz * o));
      }
      el.push(ombres(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), nb, rayon, 4, true), osier)));
    }
  };
  bordure(0.004, 0.028, 0.0075);
  bordure(0.004, HB + 0.004, 0.0075);
  // quatre petits pieds
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) el.push(cylindre(0.034, 0.02, m.uni('#cdbf9f'), [sx * (aM - 0.04), 0, sz * (bM - 0.05)], { segments: 14 }));

  // — le couvercle : son dessus tressé serré, son épaisseur, sa bordure torsadée —
  const [aC, bC] = [DX / 2 + 0.01, DZ / 2 + 0.01];
  const YC = 0.446; // le dessus du couvercle
  el.push(boite([2 * aC - 0.02, 0.02, 2 * bC - 0.02], osierOmbre, [0, YC - 0.022, 0], { r: 0.008 }));
  {
    const dessus = new THREE.Mesh(new THREE.PlaneGeometry(2 * bC - 0.004, 2 * aC - 0.004), m.uni('#f2ece0'));
    dessus.rotation.set(-PI / 2, 0, PI / 2); // la longueur du tressage suit z
    dessus.position.y = YC;
    dessus.name = 'osier-couvercle';
    dessus.receiveShadow = true;
    el.push(dessus);
  }
  bordure(0, YC - 0.006, 0.0085, contour(aC - 0.004, bC - 0.004, 0.03));

  // — la TV —
  const laque = m.uni('#18181d');
  const coque = m.uni('#26262d');
  const sombre = m.uni('#0e0e12');
  const YT = 0.5; // le bas de la TV
  const [HT, LT] = [0.55, 0.95];
  // le pied : une semelle aux bords arrondis, une colonne qui monte se loger dans la coque
  {
    const forme = new THREE.Shape();
    const [ax, bz, r] = [0.1, 0.2, 0.07];
    forme.moveTo(-ax + r, -bz);
    forme.lineTo(ax - r, -bz);
    forme.quadraticCurveTo(ax, -bz, ax, -bz + r);
    forme.lineTo(ax, bz - r);
    forme.quadraticCurveTo(ax, bz, ax - r, bz);
    forme.lineTo(-ax + r, bz);
    forme.quadraticCurveTo(-ax, bz, -ax, bz - r);
    forme.lineTo(-ax, -bz + r);
    forme.quadraticCurveTo(-ax, -bz, -ax + r, -bz);
    const g = new THREE.ExtrudeGeometry(forme, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 3, curveSegments: 10 });
    g.rotateX(-PI / 2);
    g.translate(-0.02, YC + 0.0035, 0);
    el.push(ombres(new THREE.Mesh(g, laque)));
    el.push(boite([0.034, 0.075, 0.11], laque, [-0.032, YC + 0.012, 0], { r: 0.008, rot: [0, 0, 0.12] }));
    el.push(boite([0.05, 0.06, 0.15], coque, [-0.034, YT + 0.04, 0], { r: 0.01 }));
  }
  // la dalle et son cadre laqué ; la bande argentée et le logo en bas, le récepteur et son témoin
  el.push(boite([0.028, HT, LT], coque, [0, YT, 0], { r: 0.008 }));
  el.push(boite([0.0035, 0.03, LT], laque, [0.0155, YT, 0], { r: 0.001 })); // le bas du cadre
  el.push(boite([0.0035, 0.03, LT], laque, [0.0155, YT + HT - 0.03, 0], { r: 0.001 })); // le haut
  for (const s of [-1, 1]) el.push(boite([0.0035, HT - 0.06, 0.025], laque, [0.0155, YT + 0.03, s * (LT / 2 - 0.0125)], { r: 0.001 }));
  el.push(boite([0.0036, 0.011, LT - 0.006], m.metalClair, [0.0158, YT + 0.0005, 0], { r: 0.001 })); // la bande argentée
  {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.012), m.uni('#c9ccd2'));
    logo.rotation.y = PI / 2;
    logo.position.set(0.0177, YT + 0.019, 0);
    logo.name = 'marque-tv';
    el.push(logo);
  }
  el.push(boite([0.0015, 0.009, 0.026], m.uni('#2a1d22'), [0.0175, YT + 0.0135, -0.4], { r: 0.0008 })); // le récepteur
  el.push(sphere(0.0045, m.uni('#ff4a55'), [0.0182, YT + 0.018, -0.4]));
  el.push(plan(0.9, 0.49, m.ecran, [0.0165, 0.775, 0], { nom: 'ecran' }));
  // dessous : la grille des haut-parleurs (vers le bas), le petit bouton de commande
  for (const s of [-1, 1]) el.push(boite([0.016, 0.0008, 0.2], sombre, [-0.002, YT - 0.0004, s * 0.27], { r: 0 }));
  el.push(boite([0.008, 0.006, 0.012], sombre, [0.004, YT - 0.005, 0.05], { r: 0.002 }));
  // derrière : la coque bombée, ses ouïes, les inserts VESA, le panneau des prises
  const xD = -0.014;
  el.push(boite([0.044, 0.36, 0.62], coque, [xD - 0.022, 0.58, 0], { r: 0.012 }));
  for (let k = 0; k < 9; k++) el.push(boite([0.0012, 0.006, 0.36], sombre, [xD - 0.0445, 0.88 - k * 0.012, 0], { r: 0.001 }));
  for (let k = 0; k < 14; k++) el.push(boite([0.03, 0.0012, 0.006], sombre, [xD - 0.022, 0.9405, -0.2 + k * 0.03], { r: 0 })); // sur le dessus
  for (const [dy, dz] of [[-0.1, -0.1], [-0.1, 0.1], [0.1, -0.1], [0.1, 0.1]]) el.push(cylindre(0.012, 0.0015, sombre, [xD - 0.0445, 0.73 + dy, dz], { rot: [0, 0, PI / 2], centre: true, segments: 12 }));
  el.push(boite([0.002, 0.11, 0.09], sombre, [xD - 0.045, 0.6, 0.22], { r: 0.002 }));
  for (let k = 0; k < 3; k++) el.push(boite([0.003, 0.008, 0.016], m.metalFonce, [xD - 0.0465, 0.69 - k * 0.022, 0.2], { r: 0.0008 })); // les HDMI
  el.push(boite([0.003, 0.006, 0.011], m.metalFonce, [xD - 0.0465, 0.62, 0.2], { r: 0.0008 })); // l'USB
  el.push(cylindre(0.012, 0.004, m.metalFonce, [xD - 0.047, 0.625, 0.245], { rot: [0, 0, PI / 2], centre: true, segments: 14 })); // l'antenne
  el.push(boite([0.003, 0.008, 0.008], m.uni('#2b2b33'), [xD - 0.0465, 0.66, 0.245], { r: 0.001 })); // l'optique
  // le cordon d'alimentation : sa fiche dans la coque, il descend sur le couvercle, file vers l'arrière et tombe
  // derrière le coffre jusqu'au sol
  el.push(boite([0.016, 0.014, 0.022], coque, [xD - 0.052, 0.608, 0.28], { r: 0.003 }));
  el.push(tube([[xD - 0.06, 0.615, 0.28], [xD - 0.075, 0.6, 0.285], [-0.1, 0.52, 0.29], [-0.12, YC + 0.004, 0.295], [-0.2, YC + 0.0035, 0.3], [-0.235, YC - 0.004, 0.3], [-0.244, YC - 0.03, 0.302], [-0.242, 0.3, 0.304], [-0.24, 0.05, 0.306], [-0.241, 0.012, 0.308], [-0.244, 0.004, 0.312]], 0.0032, m.noirMat, 60));

  return groupe('tv', ...el);
}

// --- Tête de ventilateur : moteur à ailettes, pales, grilles avant et arrière ---
// L'axe est x, la face avant regarde vers +x.
function teteVentilateur({ rayon: r, corps, lames, treillis, y, x = 0, z = 0, nb = 3 }) {
  return groupe(
    'tete',
    cylindre(r * 0.62, r * 0.55, corps, [x - r * 0.1, y, z], { rot: axeX, centre: true }), // moteur
    ...[-0.26, -0.14, -0.02].map((k) => tore(r * 0.64, 0.004, corps, [x + k * r, y, z], [0, PI / 2, 0])), // ailettes
    sphere(r * 0.55, corps, [x - r * 0.4, y, z], { echelle: [0.6, 1, 1] }), // capot arrière
    cylindre(r * 0.22, r * 0.2, corps, [x + r * 0.26, y, z], { rot: axeX, centre: true }), // axe
    sphere(r * 0.36, corps, [x + r * 0.42, y, z], { echelle: [0.8, 1, 1] }), // ogive
    pales(nb, r * 0.8, lames, [x + r * 0.34, y, z]),
    grille(r, treillis, [x + r * 0.62, y, z], { anneaux: [1, 0.78, 0.56, 0.34, 0.14], rayons: 12 }), // grille avant
    grille(r * 0.95, treillis, [x - r * 0.12, y, z], { anneaux: [1, 0.66, 0.33], rayons: 8 }), // grille arrière
    tore(r * 2, 0.008, treillis, [x + r * 0.25, y, z], [0, PI / 2, 0]), // jonc entre les deux grilles
    ...[0, 120, 240].map((deg) => {
      const a = (deg * PI) / 180;
      return boite([r * 0.14, 0.02, 0.014], treillis, [x + r * 0.25, y + r * Math.cos(a) - 0.01, z + r * Math.sin(a) - 0.007], { r: 0.003 }); // agrafes
    }),
  );
}

// --- Grand ventilateur sur pied : base et colonne chromées, grille en treillis argenté ---
function ventilateur() {
  const m = creerMateriaux();
  return groupe(
    'ventilateur',
    // pied rond bombé et chromé, colonne télescopique avec son collier de serrage et sa molette
    tourne([[0, 0], [0.2, 0], [0.2, 0.012], [0.19, 0.02], [0.1, 0.03], [0.06, 0.045], [0.04, 0.06], [0.02, 0.065]], m.chrome, [0, 0, 0]),
    cylindre(0.04, 0.5, m.chrome, [0, 0.06, 0]),
    cylindre(0.06, 0.05, m.plastique, [0, 0.55, 0]),
    cylindre(0.022, 0.03, m.plastique, [0, 0.575, 0.04], { rot: axeZ, centre: true }),
    sphere(0.034, m.plastique, [0, 0.575, 0.062]),
    cylindre(0.03, 0.52, m.chrome, [0, 0.6, 0]),
    // fourche d'inclinaison, vis de réglage et molette d'oscillation
    boite([0.03, 0.03, 0.22], m.plastique, [0.0, 1.1, 0], { r: 0.008 }),
    boite([0.026, 0.12, 0.018], m.plastique, [0, 1.13, 0.11], { r: 0.006 }),
    boite([0.026, 0.12, 0.018], m.plastique, [0, 1.13, -0.11], { r: 0.006 }),
    cylindre(0.024, 0.012, m.metalFonce, [0, 1.2, 0.125], { rot: axeZ, centre: true }),
    cylindre(0.024, 0.012, m.metalFonce, [0, 1.2, -0.125], { rot: axeZ, centre: true }),
    cylindre(0.026, 0.03, m.plastique, [-0.02, 1.272, 0]),
    teteVentilateur({ rayon: 0.21, corps: m.plastique, lames: m.pale, treillis: m.grillage, y: 1.2, x: 0.03, nb: 5 }),
    // câble qui sort de derrière le moteur, longe la colonne par l'arrière, passe par-dessus le pied et traîne au sol
    cableSurPied(
      [[-0.1, 1.17, 0], [-0.06, 1.0, 0.01], [-0.036, 0.62, 0.011], [-0.036, 0.3, 0.011], [-0.036, 0.11, 0.011]],
      [[0.2, 0.012], [0.19, 0.02], [0.1, 0.03], [0.06, 0.045], [0.04, 0.06], [0.02, 0.065]],
      [[-0.23, 0.005, 0.07], [-0.245, 0.006, 0.075]],
      0.004,
      m.noirMat,
    ),
  );
}

// --- Étagère murale nue : deux montants gris-vert qui s'arrondissent, trois planches courbes ---
// Le mur est en x = -0.09 ; les objets sont posés sur les planches.
function etagere() {
  const m = creerMateriaux();
  const W = 0.56; // largeur (z)
  const niveaux = [1.12, 1.36, 1.6];

  // planche : fond droit contre le mur, bord avant en arc (plus avancé au milieu)
  const forme = new THREE.Shape();
  forme.moveTo(-W / 2, 0);
  forme.lineTo(W / 2, 0);
  forme.lineTo(W / 2, 0.15);
  forme.quadraticCurveTo(0, 0.22, -W / 2, 0.15);
  forme.closePath();
  // (X forme, Y forme, profondeur) -> (x = Y, y = profondeur, z = X), puis décalage vers le mur
  const versMeuble = new THREE.Matrix4().set(0, 1, 0, -0.085, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  const planches = niveaux.map((y) => extrusion(forme, 0.016, m.cheneClair, new THREE.Matrix4().makeTranslation(0, y, 0).multiply(versMeuble)));
  // petite butée à l'arrière de chaque planche
  const butees = niveaux.map((y) => boite([0.012, 0.03, W - 0.02], m.cheneFonce, [-0.075, y + 0.016, 0], { r: 0.003 }));

  // montants : une bande de 4 cm qui s'arrondit vers l'extérieur, du bas de la planche basse
  // jusqu'un peu au-dessus de la haute
  const arc = (t) => 0.285 + 0.035 * Math.sin(PI * t);
  const profil = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return [1.07 + t * 0.64, arc(t)];
  });
  const montants = [1, -1].flatMap((s) => [
    ...bande(profil.map(([y, z]) => [y, z * s]), -0.083, 0.012, 0.04, m.grisVert),
    ...niveaux.map((y) => cylindre(0.014, 0.006, m.metalFonce, [-0.074, y + 0.008, arc((y + 0.008 - 1.07) / 0.64) * s], { rot: axeX, centre: true, segments: 10 })),
  ]);

  return groupe(
    'etagere',
    ...planches,
    ...butees,
    ...montants,
  );
}

// --- Table de chevet verte (55 × 55 × 45) : plateau épais, quatre pieds carrés ---
// Dessus : seulement le petit ventilateur blanc, tourné vers le lit.
function tableChevet() {
  const m = creerMateriaux();
  const pieds = [0.235, -0.235].flatMap((x) => [0.235, -0.235].map((z) => boite([0.05, 0.4, 0.05], m.vert, [x, 0, z], { r: 0.004 })));
  const petit = groupe(
    'petit-ventilateur',
    cylindre(0.14, 0.02, m.blanc, [0, 0, 0], { dBas: 0.13 }),
    cylindre(0.02, 0.1, m.blanc, [0, 0.02, 0]),
    cylindre(0.034, 0.04, m.blanc, [0, 0.1, 0]),
    teteVentilateur({ rayon: 0.15, corps: m.blanc, lames: m.blanc, treillis: m.blanc, y: 0.29, x: 0.0, nb: 5 }),
  );
  petit.rotation.y = PI / 2; // regarde vers -z, c'est-à-dire vers le lit (au nord de la table)
  petit.position.set(0.0, 0.45, 0.0);

  return groupe(
    'table-chevet',
    boite([0.55, 0.05, 0.55], m.vert, [0, 0.4, 0], { r: 0.008 }),
    boite([0.5, 0.012, 0.5], m.vertFonce, [0, 0.388, 0], { r: 0.003 }), // sous-face en retrait
    ...pieds,
    petit,
  );
}

// --- Porte : vantail en acajou à trois panneaux moulurés, chambranle, charnières, poignée ---
// L'origine est le centre de la porte, sur le plan du mur ; la pièce est du côté +z.
// Les panneaux sont mesurés sur ta photo (du haut vers le bas) : un grand, un petit au milieu,
// un grand en bas, avec la poignée sur le traverse du milieu.
function porte() {
  const m = creerMateriaux();
  const haut = 1.02;
  // [début depuis le haut, fin depuis le haut] en mètres
  const panneaux = [
    [0.18, 1.06],
    [1.14, 1.35],
    [1.41, 1.88],
  ].flatMap(([a, b]) => {
    const h = b - a;
    const yc = haut - (a + b) / 2;
    return [
      boite([0.6, h, 0.014], m.acajouFonce, [0, yc - h / 2, 0.047], { r: 0.008 }), // moulure
      boite([0.54, h - 0.08, 0.016], m.acajou, [0, yc - (h - 0.08) / 2, 0.052], { r: 0.008 }), // panneau en relief
    ];
  });
  // trois charnières en laiton côté pignon : en haut, au milieu, en bas
  const charnieres = [haut - 0.22, 0.04, -haut + 0.27].flatMap((y) => [
    cylindre(0.014, 0.1, m.laiton, [0.425, y - 0.05, 0.03], { segments: 10 }),
    boite([0.014, 0.1, 0.006], m.laiton, [0.415, y - 0.05, 0.043], { r: 0.002 }),
  ]);
  // le vantail (planche, panneaux, poignée) pivote autour des charnières, côté +x, et s'ouvre vers la pièce
  // (+z) ; derrière lui, un fond sombre figure le couloir
  const vantail = groupe(
    'pivot_vantail',
    groupe(
      '',
      boite([0.83, 2.04, 0.04], m.acajou, [0, -1.02, 0], { r: 0.005 }),
      ...panneaux,
      // poignée à hauteur du traverse du milieu : plaque en acier brossé, levier en équerre, serrure
      boite([0.045, 0.24, 0.006], m.metal, [-0.335, -0.21, 0.043], { r: 0.003 }),
      boite([0.014, 0.05, 0.02], m.metal, [-0.335, -0.02, 0.058], { r: 0.003 }),
      boite([0.14, 0.018, 0.016], m.metal, [-0.27, -0.045, 0.074], { r: 0.006 }),
      boite([0.018, 0.075, 0.016], m.metal, [-0.205, -0.075, 0.074], { r: 0.006 }),
      boite([0.01, 0.026, 0.004], m.noirMat, [-0.335, -0.2, 0.0475], { r: 0.001 }),
    ),
  );
  vantail.position.set(0.415, 0, 0);
  vantail.children[0].position.set(-0.415, 0, 0);
  return groupe(
    'porte',
    boite([0.83, 2.04, 0.01], m.uni('#241d2b'), [0, -1.02, 0.006], { r: 0.001 }), // le couloir, vu porte ouverte
    vantail,
    // chambranle : trois montants plus larges, un peu en saillie
    boite([0.07, 2.11, 0.02], m.acajouFonce, [-0.45, -1.02, 0.02], { r: 0.004 }),
    boite([0.07, 2.11, 0.02], m.acajouFonce, [0.45, -1.02, 0.02], { r: 0.004 }),
    boite([0.97, 0.07, 0.02], m.acajouFonce, [0, 1.02, 0.02], { r: 0.004 }),
    boite([0.83, 0.018, 0.045], m.metalFonce, [0, -1.02, 0.02], { r: 0.003 }), // seuil
    ...charnieres,
  );
}

// --- Interrupteur mural : plaque blanche, bascule, filet bleu ---
function interrupteur() {
  const m = creerMateriaux();
  return groupe(
    'interrupteur',
    boite([0.085, 0.085, 0.008], m.blanc, [0, -0.0425, 0], { r: 0.006 }),
    boite([0.07, 0.014, 0.0095], m.uni('#6f93d6'), [0, -0.012, 0.0002], { r: 0.003 }),
    boite([0.042, 0.052, 0.008], m.creme, [0, -0.0475, 0.007], { r: 0.005, rot: [0.12, 0, 0] }),
    cylindre(0.008, 0.004, m.metalClair, [0, -0.07, 0.007], { rot: axeZ, centre: true, segments: 8 }),
  );
}

// le même bureau, sans le MacBook (la chambre de rêve pose le sien sur un support : voir bureauStudio, reve.js)
export const bureauNu = () => bureau({ mac: false });

// nom du fichier -> fonction qui construit le modèle (fusionné : un maillage par matériau)
const fabrique = (f) => () => fusionner(veinerBois(f())); // les pièces en bois reçoivent leurs veines
export const modeles = {
  lit: fabrique(lit),
  commode: fabrique(commode),
  lampadaire: fabrique(lampadaire),
  bureau: fabrique(bureau),
  chaise: fabrique(chaise),
  vitrine: fabrique(vitrine),
  tv: fabrique(tv),
  ventilateur: fabrique(ventilateur),
  etagere: fabrique(etagere),
  'table-chevet': fabrique(tableChevet),
  porte: fabrique(porte),
  interrupteur: fabrique(interrupteur),
};
