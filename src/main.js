import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  piece,
  renfoncement,
  colonne,
  velux,
  poutre,
  decors,
  meubles,
  lumieres,
  interrupteurs,
  vues,
  palette,
  photosMur,
  objetsVitrine,
} from './chambre.js';
import { initialiserInteractions } from './interactions.js';
import * as textures from './textures.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // le fond dégradé est dessiné en CSS (voir style.css)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();

const { largeur: W, profondeur: D, hauteur: H, hauteurMurBas: K, penteProfondeur: R } = piece;
const LP = Math.hypot(H - K, R); // longueur de la pente
const { P1, P2, P3 } = renfoncement; // points du renfoncement de la porte

// Le centre de la pièce est à l'origine pour que la caméra tourne autour.
const racine = new THREE.Group();
racine.position.set(-W / 2, 0, -D / 2);
scene.add(racine);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(-4.6, 7.6, -6.2); // depuis le nord-ouest : on voit le mur est et le toit

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.minDistance = 1.2;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // pas de vue par en dessous
controls.update();

const mat =(couleur, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, metalness: 0, ...extra });

// Les murs, le plafond et la pente sont des surfaces simples dont seule la face
// intérieure se voit : quand la caméra passe derrière, ils disparaissent
// tout seuls et on regarde dans la pièce comme dans un diorama.
const interieur = (extra) =>
  new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.BackSide, ...extra });

function surface(points, materiau) {
  const forme = new THREE.Shape();
  points.forEach(([u, v], i) => (i ? forme.lineTo(u, v) : forme.moveTo(u, v)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(forme), materiau);
  m.receiveShadow = true;
  return m;
}

// --- Sol et dalle ---
// Contour du sol dans le plan (x, z) : le coin nord-ouest est remplacé par le
// renfoncement de la porte (triangle P1, P2, P3).
const { largeur: CL, profondeur: CP } = colonne; // colonne de l'angle nord-est
const contour = [P3, [W - CL, 0], [W - CL, CP], [W, CP], [W, D], [0, D], P1, P2];
// Les formes sont dessinées en (x, -z) puis couchées à plat avec rotation.x.
const versPlan = (pts) => pts.map(([x, z]) => new THREE.Vector2(x, -z));
const formeSol = new THREE.Shape(versPlan(contour));

const sol = new THREE.Mesh(
  new THREE.ShapeGeometry(formeSol),
  new THREE.MeshStandardMaterial({ map: textures.sol(palette.sol, palette.solLigne), roughness: 0.9 }),
);
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
racine.add(sol);

// Contour décalé vers l'extérieur de `d` mètres (angles vifs conservés, comme un « miter »).
function decaler(points, d) {
  const n = points.length;
  let aire = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = points[i];
    const [x1, z1] = points[(i + 1) % n];
    aire += x0 * z1 - x1 * z0;
  }
  const signe = aire > 0 ? 1 : -1; // le sens du contour décide de quel côté est « dehors »
  const normale = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz);
    return [(signe * dz) / l, (-signe * dx) / l];
  };
  return points.map((q, i) => {
    const n0 = normale(points[(i - 1 + n) % n], q);
    const n1 = normale(q, points[(i + 1) % n]);
    const k = 1 + n0[0] * n1[0] + n0[1] * n1[1];
    return [q[0] + ((n0[0] + n1[0]) / k) * d, q[1] + ((n0[1] + n1[1]) / k) * d];
  });
}

// Le socle violet foncé sur lequel la pièce est posée : épais et débordant largement.
const SOCLE_EPAISSEUR = 0.6;
const SOCLE_DEBORD = 0.5;
const socle = new THREE.Mesh(
  new THREE.ExtrudeGeometry(new THREE.Shape(versPlan(decaler(contour, SOCLE_DEBORD))), { depth: SOCLE_EPAISSEUR, bevelEnabled: false }),
  new THREE.MeshStandardMaterial({ color: palette.socle, roughness: 0.95 }),
);
socle.rotation.x = -Math.PI / 2;
socle.position.y = -SOCLE_EPAISSEUR - 0.004;
socle.receiveShadow = true;
socle.castShadow = true;
racine.add(socle);

// --- Murs qui s'abaissent ---
// Même principe que le site de référence : chaque mur est découpé en tuiles
// qui descendent en vague jusqu'à une bordure quand la caméra passe de leur
// côté extérieur, et remontent quand elle revient. La hauteur de chaque tuile
// suit un ressort amorti, avec un petit coup de pouce au départ (ça rebondit).
// Les décors accrochés au mur (porte, affiches, étagère…) s'écrasent avec la
// tuile qui les porte et s'effacent près de la bordure.
const HAUTEUR_MUR = H; // hauteur d'un mur debout
const HAUTEUR_BORDURE = 0.2; // ce qui reste d'un mur abaissé
const LONGUEUR_TUILE = 0.34; // largeur visée pour une tuile
const RETARD_PAR_METRE = 0.14; // décalage de la vague (s par mètre de mur)
const SEUIL_CAMERA = 0.08; // zone morte autour du plan du mur
const EPAISSEUR_MUR = 0.1; // les murs épaississent vers l'extérieur
const HAUTEUR_MIN = 0.04; // hauteur minimale d'une tuile

const papierUni = new THREE.MeshStandardMaterial({ color: palette.mur, roughness: 0.9 });
const papierAlt = new THREE.MeshStandardMaterial({ color: palette.murAlt, roughness: 0.9 });
const papierMarques = papierUni; // (ancien nom, tous les murs sont désormais unis)
const tranche = new THREE.MeshStandardMaterial({ color: palette.murBord, roughness: 0.9 }); // dessus et côtés des murs

const murs = {};

// Hauteur du profil `haut` (liste de [u, hauteur] triée) à l'abscisse u.
function hauteurProfil(haut, u) {
  if (u <= haut[0][0]) return haut[0][1];
  for (let i = 1; i < haut.length; i++) {
    if (u <= haut[i][0]) {
      const [u0, h0] = haut[i - 1];
      const [u1, h1] = haut[i];
      return h0 + ((h1 - h0) * (u - u0)) / (u1 - u0);
    }
  }
  return haut[haut.length - 1][1];
}

// `pos` = [x, z] du pied du mur (u = 0), `angle` = angle autour de y de la
// direction qui sort de la pièce, `haut` = profil du haut du mur : [u, hauteur].
// `regle(cam)` : condition en plus pour abaisser le mur.
// `angles` = angle intérieur de la pièce au début et à la fin du mur (90° par défaut) : le bout
// du mur est biseauté pour que les deux murs voisins se rejoignent sans trou ni recouvrement.
function creerMur(nom, { pos, angle, haut, materiau, regle, angles = [Math.PI / 2, Math.PI / 2] }) {
  const groupe = new THREE.Group();
  groupe.position.set(pos[0], 0, pos[1]);
  groupe.rotation.y = angle;
  racine.add(groupe);

  const u0 = haut[0][0];
  const u1 = haut[haut.length - 1][0];
  const longueur = u1 - u0;
  const nb = Math.max(1, Math.round(longueur / LONGUEUR_TUILE));
  const tuiles = [];
  for (let i = 0; i < nb; i++) {
    const ua = u0 + (longueur * i) / nb;
    const ub = u0 + (longueur * (i + 1)) / nb;
    // contour de la tuile : bas plat, haut qui suit le profil (avec ses cassures)
    const pts = [[ua, 0], [ub, 0], [ub, hauteurProfil(haut, ub)]];
    for (let j = haut.length - 1; j >= 0; j--) if (haut[j][0] > ua && haut[j][0] < ub) pts.push(haut[j]);
    pts.push([ua, hauteurProfil(haut, ua)]);
    const forme = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const geo = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR_MUR, bevelEnabled: false });
    // biseau des bouts : la face extérieure avance (coin saillant) ou recule (coin rentrant)
    const gp = geo.attributes.position;
    for (let k = 0; k < gp.count; k++) {
      if (gp.getZ(k) < EPAISSEUR_MUR / 2) continue;
      if (i === 0 && Math.abs(gp.getX(k) - ua) < 1e-5) gp.setX(k, ua - EPAISSEUR_MUR / Math.tan(angles[0] / 2));
      if (i === nb - 1 && Math.abs(gp.getX(k) - ub) < 1e-5) gp.setX(k, ub + EPAISSEUR_MUR / Math.tan(angles[1] / 2));
    }
    gp.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, [i % 2 ? papierAlt : materiau, tranche]);
    mesh.receiveShadow = true;
    mesh.castShadow = nom !== 'sud'; // comme dans la référence, les murs portent des ombres dans la pièce
    groupe.add(mesh);
    const tuile = { mesh, u: (ua + ub) / 2, h: HAUTEUR_MUR, v: 0, cible: HAUTEUR_MUR };
    mesh.userData.tuile = tuile;
    tuiles.push(tuile);
  }

  const axe = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)); // sens de u
  const normale = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)); // vers l'extérieur
  const pied = new THREE.Vector3(pos[0], 0, pos[1]);
  murs[nom] = {
    tuiles,
    u0,
    u1,
    axe,
    normale,
    pied,
    centre: pied.clone().addScaledVector(axe, (u0 + u1) / 2),
    debut: pied.clone().addScaledVector(axe, u0),
    fin: pied.clone().addScaledVector(axe, u1),
    regle,
    cible: HAUTEUR_MUR,
    changement: -999,
    depuisDebut: true,
    init: false,
  };
}

// Mur ouest (TV) : pignon dont le haut suit la pente. u = z.
// Il commence où le « retour » du renfoncement le quitte (z = P1[1]).
creerMur('ouest', {
  angles: [(5 * Math.PI) / 4, Math.PI / 2],
  pos: [0, 0],
  angle: -Math.PI / 2,
  haut: [[P1[1], H], [D - R, H], [D, K]],
  materiau: papierMarques,
});

// Retour du renfoncement : de P2 vers P1, sortie vers le sud-ouest. Vu depuis
// l'ouest il cacherait la TV, donc il s'abaisse aussi dans ce cas.
creerMur('retour', {
  angles: [Math.PI / 2, (5 * Math.PI) / 4],
  pos: P2,
  angle: -Math.PI / 4,
  haut: [[0, H], [renfoncement.retour, H]],
  materiau: papierMarques,
  regle: (cam) => cam.x < 0,
});

// Pan de la porte : de P3 vers P2, sortie vers le nord-ouest.
creerMur('pan', {
  angles: [(3 * Math.PI) / 4, Math.PI / 2],
  pos: P3,
  angle: (-3 * Math.PI) / 4,
  haut: [[0, H], [renfoncement.pan, H]],
  materiau: papierMarques,
});

// Mur est (lit, commode) : u = D - z. Il commence après la colonne (z = profondeur).
creerMur('est', {
  pos: [W, D],
  angle: Math.PI / 2,
  haut: [[0, K], [R, H], [D - colonne.profondeur, H]],
  materiau: papierUni,
});

// Mur nord (bureau, vitrine) : u = (W - largeur de la colonne) - x. Il va de la
// colonne au début du pan de la porte.
creerMur('nord', {
  angles: [Math.PI / 2, (3 * Math.PI) / 4],
  pos: [W - colonne.largeur, 0],
  angle: Math.PI,
  haut: [[0, H], [W - colonne.largeur - P3[0], H]],
  materiau: papierMarques,
});

// Mur bas au sud, sous la pente.
creerMur('sud', { pos: [0, D], angle: 0, haut: [[0, K], [W, K]], materiau: papierMarques });

// La colonne de l'angle nord-est fait partie des murs : deux faces tournées
// vers la pièce, qui s'abaissent comme les autres.
creerMur('colonneSud', {
  angles: [Math.PI / 2, (3 * Math.PI) / 2],
  pos: [W, colonne.profondeur],
  angle: Math.PI,
  haut: [[0, H], [colonne.largeur, H]],
  materiau: papierMarques,
});
creerMur('colonneOuest', {
  angles: [(3 * Math.PI) / 2, Math.PI / 2],
  pos: [W - colonne.largeur, colonne.profondeur],
  angle: Math.PI / 2,
  haut: [[0, H], [colonne.profondeur, H]],
  materiau: papierMarques,
});

// Tout ce qui est accroché à un ou plusieurs murs : décors, ampoules, mais aussi
// les éléments « permanents » (poutre, toit, plafond) qui n'ont pas de sens sans
// leurs murs. Ils suivent la hauteur de leurs murs : écrasés ou non, puis
// effacés quand les murs sont abaissés.
const accroches = [];

// `noms` = un mur ou une liste de murs qui portent l'objet (déjà enfant de
// `racine`, position en repère de la pièce).
//   ecraser : l'objet s'écrase vers le sol avec le mur (décors)
//   fondu : [hauteur où il a disparu, hauteur où il est entièrement visible]
//   large : l'objet s'étend sur tout le mur, on prend la hauteur moyenne des tuiles
function accrocher(noms, objet, { ecraser = true, fondu = [HAUTEUR_BORDURE, HAUTEUR_BORDURE + 0.65], large = false, facteur = null } = {}) {
  // l'enveloppe est à l'origine du sol : son échelle en y écrase l'objet vers le sol
  const enveloppe = new THREE.Group();
  racine.add(enveloppe);
  enveloppe.add(objet);
  const supports = [].concat(noms).map((nom) => {
    const mur = murs[nom];
    const u = large
      ? null
      : (objet.position.x - mur.pied.x) * mur.axe.x + (objet.position.z - mur.pied.z) * mur.axe.z;
    return { mur, u };
  });
  accroches.push({ enveloppe, supports, ecraser, fondu, facteur, materiaux: [] });
}

// Hauteur actuelle d'un mur à l'endroit où l'objet est accroché.
function hauteurSupport({ mur, u }) {
  if (u === null) return mur.tuiles.reduce((somme, t) => somme + t.h, 0) / mur.tuiles.length;
  let proche = mur.tuiles[0];
  for (const t of mur.tuiles) if (Math.abs(t.u - u) < Math.abs(proche.u - u)) proche = t;
  return proche.h;
}

// À appeler une fois tout accroché : repère les matériaux à faire s'effacer.
function preparerMurs() {
  for (const accroche of accroches) {
    accroche.vus ??= new Set();
    const vus = accroche.vus;
    accroche.enveloppe.traverse((o) => {
      if (!o.isMesh || vus.has(o.material)) return;
      vus.add(o.material);
      o.material.transparent = true;
      accroche.materiaux.push({ materiau: o.material, opacite: o.material.opacity });
    });
  }
}

// Ressort amorti de la hauteur d'une tuile (solution exacte de
// x'' = -10 x' - 120 x), avec un rebond si elle touche le bas.
function ressort(t, dt) {
  const w = Math.sqrt(95);
  const x = t.h - t.cible;
  const amorti = Math.exp(-5 * dt);
  const c = Math.cos(w * dt);
  const s = Math.sin(w * dt);
  const k = (t.v + 5 * x) / w;
  t.h = t.cible + amorti * (x * c + k * s);
  t.v = amorti * (t.v * c - (5 * k + w * x) * s);
  if (Math.abs(t.h - t.cible) < 1e-4 && Math.abs(t.v) < 1e-4) {
    t.h = t.cible;
    t.v = 0;
  }
  if (t.h < HAUTEUR_MIN) {
    t.h = HAUTEUR_MIN;
    t.v = Math.abs(t.v) * 0.3;
  }
}

let temps = 0;
const cam = new THREE.Vector3();

function animerMurs(dt) {
  temps += dt;
  cam.copy(camera.position).sub(racine.position);

  for (const mur of Object.values(murs)) {
    // la caméra est-elle du côté extérieur du mur ? (cosinus dans le plan du sol)
    const dx = cam.x - mur.centre.x;
    const dz = cam.z - mur.centre.z;
    const d = (mur.normale.x * dx + mur.normale.z * dz) / (Math.hypot(dx, dz) || 1);

    let cible = mur.cible;
    if (d > SEUIL_CAMERA) cible = HAUTEUR_BORDURE;
    else if (d < -SEUIL_CAMERA) cible = HAUTEUR_MUR;
    if (mur.regle?.(cam)) cible = HAUTEUR_BORDURE;

    if (!mur.init) {
      // au chargement : pas d'animation, les murs prennent directement leur place
      mur.init = true;
      mur.cible = cible;
      for (const t of mur.tuiles) t.h = t.cible = cible;
    } else if (cible !== mur.cible) {
      mur.cible = cible;
      mur.changement = temps;
      // la vague part du bout du mur le plus proche de la caméra
      mur.depuisDebut = cam.distanceToSquared(mur.debut) <= cam.distanceToSquared(mur.fin);
    }

    for (const t of mur.tuiles) {
      const distance = mur.depuisDebut ? t.u - mur.u0 : mur.u1 - t.u;
      if (temps >= mur.changement + distance * RETARD_PAR_METRE && t.cible !== mur.cible) {
        t.v += mur.cible < t.h ? 2.6 : 1.4; // petit rebond avant de descendre / dépassement en remontant
        t.cible = mur.cible;
      }
      ressort(t, Math.min(dt, 1));
      t.mesh.scale.y = t.h / HAUTEUR_MUR;
    }

  }

  // décors et éléments permanents : hauteur du mur qui les porte (le plus bas s'il y en a plusieurs)
  for (const a of accroches) {
    const h = Math.min(...a.supports.map(hauteurSupport));
    if (a.ecraser) a.enveloppe.scale.y = Math.max(h / HAUTEUR_MUR, 0.001);
    const [bas, haut] = a.fondu;
    const fondu = THREE.MathUtils.clamp((h - bas) / (haut - bas), 0, 1) * (a.facteur ? a.facteur(dt) : 1);
    for (const { materiau, opacite } of a.materiaux) materiau.opacity = opacite * fondu;
    a.enveloppe.visible = fondu > 0.001;
  }
}

// Plafond plat, du mur nord jusqu'au début de la pente.
const plafond = new THREE.Mesh(
  new THREE.ShapeGeometry(new THREE.Shape(versPlan([P3, [W - CL, 0], [W - CL, CP], [W, CP], [W, D - R], [0, D - R], P1, P2]))),
  interieur({ color: palette.plafond }),
);
plafond.rotation.x = -Math.PI / 2;
plafond.position.y = H;
plafond.receiveShadow = true;
racine.add(plafond);

// --- Pente du toit, avec le Velux ---
// Repère local : x = est, y = vers le haut de la pente, z = vers l'extérieur.
const pente = new THREE.Group();
pente.position.set(0, K, D);
pente.rotation.x = -Math.atan2(R, H - K);
racine.add(pente);

const formePente = new THREE.Shape();
formePente.moveTo(0, 0);
formePente.lineTo(W, 0);
formePente.lineTo(W, LP);
formePente.lineTo(0, LP);
formePente.closePath();
const trou = new THREE.Path();
const [vx0, vx1] = [velux.x - velux.largeur / 2, velux.x + velux.largeur / 2];
const [vy0, vy1] = [velux.v - velux.longueur / 2, velux.v + velux.longueur / 2];
trou.moveTo(vx0, vy0);
trou.lineTo(vx1, vy0);
trou.lineTo(vx1, vy1);
trou.lineTo(vx0, vy1);
trou.closePath();
formePente.holes.push(trou);

const texPente = textures.etoiles();
texPente.repeat.set(1 / W, 1 / LP);
const surfacePente = new THREE.Mesh(
  new THREE.ShapeGeometry(formePente),
  interieur({ map: texPente, roughness: 0.9 }),
);
surfacePente.receiveShadow = true;
pente.add(surfacePente);

// Le Velux est encastré dans l'épaisseur du toit : un tableau (les quatre côtés du trou)
// en plâtre clair, avec le cadre en bois et la vitre à l'extérieur.
const PROFONDEUR_TABLEAU = 0.22;
const platre = new THREE.MeshStandardMaterial({ color: '#fbf2f0', roughness: 0.95, side: THREE.DoubleSide });
const largV = velux.largeur;
const longV = velux.longueur;
const tableau = [
  [[0.012, longV, PROFONDEUR_TABLEAU], [velux.x - largV / 2, velux.v, PROFONDEUR_TABLEAU / 2]],
  [[0.012, longV, PROFONDEUR_TABLEAU], [velux.x + largV / 2, velux.v, PROFONDEUR_TABLEAU / 2]],
  [[largV, 0.012, PROFONDEUR_TABLEAU], [velux.x, velux.v - longV / 2, PROFONDEUR_TABLEAU / 2]],
  [[largV, 0.012, PROFONDEUR_TABLEAU], [velux.x, velux.v + longV / 2, PROFONDEUR_TABLEAU / 2]],
];
for (const [taille, pos] of tableau) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(...taille), platre);
  b.position.set(...pos);
  b.castShadow = true;
  b.receiveShadow = true;
  pente.add(b);
}
const boisVelux = new THREE.MeshStandardMaterial({ color: '#c28a58', roughness: 0.85 });
const e = 0.05;
const zCadre = PROFONDEUR_TABLEAU;
for (const [taille, [x, y]] of [
  [[largV + 2 * e, e], [velux.x, velux.v + longV / 2 - e / 2]],
  [[largV + 2 * e, e], [velux.x, velux.v - longV / 2 + e / 2]],
  [[e, longV], [velux.x - largV / 2 + e / 2, velux.v]],
  [[e, longV], [velux.x + largV / 2 - e / 2, velux.v]],
]) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(taille[0], taille[1], 0.04), boisVelux);
  b.position.set(x, y, zCadre);
  b.castShadow = true;
  pente.add(b);
}

// --- Charpente contre le mur ouest : chevron + poteau + entrait, comme sur ta photo ---
const charpente = new THREE.Group();
charpente.name = 'charpente';
const boisPoutre = new THREE.MeshStandardMaterial({ color: poutre.couleur, roughness: 0.85 });
const veinePoutre = new THREE.MeshStandardMaterial({ color: new THREE.Color(poutre.couleur).multiplyScalar(0.72), roughness: 0.9 });
const metalPoutre = new THREE.MeshStandardMaterial({ color: '#cfc8c0', roughness: 0.5, metalness: 0.2 });
const D2 = poutre.profondeur;

function morceau(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
// quelques veines : de fines lignes plus foncées sur la grande face, dans le sens du bois
function veines(parent, longueur, nb, ecart, place) {
  for (let i = 0; i < nb; i++) {
    const v = morceau(new THREE.BoxGeometry(0.002, longueur * (0.55 + 0.4 * ((i * 37) % 10) / 10), 0.004), veinePoutre, 0, 0, 0);
    v.castShadow = false;
    place(v, (i - (nb - 1) / 2) * ecart, ((i * 13) % 7) / 7 - 0.5);
    parent.add(v);
  }
}

// chevron : sous la pente, plaqué au mur
const chevron = morceau(new THREE.BoxGeometry(D2, LP + 0.1, poutre.epaisseur), boisPoutre, D2 / 2 + 0.002, LP / 2 + 0.03, -poutre.epaisseur / 2);
veines(chevron, LP, 3, poutre.epaisseur / 4, (v, dz, dy) => v.position.set(D2 / 2 + 0.001, dy * LP * 0.5, dz));
pente.add(chevron);

// poteau : du sol jusqu'sous le chevron
const hauteurPoteau = 4.418 - poutre.poteau.z + 0.04; // dessous du chevron à cette position, + un peu pour s'y caler
const poteau = morceau(new THREE.BoxGeometry(D2, hauteurPoteau, poutre.poteau.largeur), boisPoutre, D2 / 2 + 0.002, hauteurPoteau / 2, poutre.poteau.z);
veines(poteau, hauteurPoteau, 3, poutre.poteau.largeur / 4, (v, dz, dy) => v.position.set(D2 / 2 + 0.001, dy * hauteurPoteau * 0.6, dz));
// le petit bouchon rond au pied du poteau
const bouchon = morceau(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 14), new THREE.MeshStandardMaterial({ color: '#4a3326', roughness: 0.9 }), D2 + 0.006, 0.09, poutre.poteau.z);
bouchon.rotation.z = Math.PI / 2;
charpente.add(poteau, bouchon);

// entrait : horizontal, du poteau jusqu'au coin du mur bas, avec son boulon
const zDebut = poutre.poteau.z + poutre.poteau.largeur / 2 - 0.01;
const longueurEntrait = poutre.entrait.zFin - zDebut;
const entrait = morceau(new THREE.BoxGeometry(D2, poutre.entrait.hauteur, longueurEntrait), boisPoutre, D2 / 2 + 0.002, poutre.entrait.y, (zDebut + poutre.entrait.zFin) / 2);
veines(entrait, longueurEntrait, 3, poutre.entrait.hauteur / 4, (v, dy, dz) => {
  v.rotation.x = Math.PI / 2; // la veine suit la longueur de l'entrait (axe z)
  v.position.set(D2 / 2 + 0.001, dy, dz * longueurEntrait * 0.3);
});
const boulon = morceau(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 14), metalPoutre, D2 + 0.008, poutre.entrait.y, poutre.entrait.zFin - 0.07);
boulon.rotation.z = Math.PI / 2;
charpente.add(entrait, boulon);

racine.add(charpente);
racine.updateMatrixWorld(true);
charpente.attach(chevron); // sort du repère de la pente, en gardant sa place

const veluxMat = new THREE.MeshStandardMaterial({
  color: '#bfe3ff',
  emissive: '#bfe3ff',
  emissiveIntensity: 0.8,
  roughness: 0.2,
  side: THREE.BackSide,
});
const vitre = new THREE.Mesh(new THREE.PlaneGeometry(velux.largeur, velux.longueur), veluxMat);
vitre.position.set(velux.x, velux.v, PROFONDEUR_TABLEAU + 0.012);
pente.add(vitre);

// Éléments permanents : sans leurs murs ils flottent, donc ils s'effacent avec eux
// (avant les décors : ils disparaissent dès que le mur commence à descendre).
const FONDU_PERMANENT = [HAUTEUR_MUR * 0.55, HAUTEUR_MUR * 0.9];
racine.updateMatrixWorld(true);
accrocher('ouest', charpente, { ecraser: false, fondu: FONDU_PERMANENT, large: true });
// Le toit n'existe que vu de l'intérieur : du dessus, on regarde dans la pièce. Le Velux, qui est
// dans le toit, disparaît donc avec lui dès que la caméra passe de l'autre côté de la pente.
const toit = { n: new THREE.Vector3(0, R, H - K).normalize(), p: new THREE.Vector3(0, K, D), visible: 1, cible: 1 };
const versToit = new THREE.Vector3();
function facteurToit(dt) {
  const d = toit.n.dot(versToit.copy(cam).sub(toit.p));
  if (d > 0.1) toit.cible = 0;
  else if (d < -0.1) toit.cible = 1;
  toit.visible += (toit.cible - toit.visible) * Math.min(1, dt * 8);
  return toit.visible;
}
accrocher('sud', pente, { ecraser: false, fondu: FONDU_PERMANENT, large: true, facteur: facteurToit });
accrocher(['nord', 'est', 'ouest', 'sud'], plafond, { ecraser: false, fondu: FONDU_PERMANENT, large: true });

// --- Décors plaqués sur les murs (affiches, porte) ---
const texturesNommees = {
  couette: textures.couette(),
  iron: textures.affiche('iron'),
  mando: textures.affiche('mando'),
  calendrier: textures.image('/textures/calendrier.jpg'),
};

// Les modèles .glb peuvent être compressés (Draco ou Meshopt) : c'est ce que
// produisent la plupart des outils d'optimisation, ça divise le poids par 5 à 10.
const chargeur = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(textures.chemin('/draco/'));
chargeur.setDRACOLoader(draco);
chargeur.setMeshoptDecoder(MeshoptDecoder);

// Ce sur quoi on peut cliquer : meubles et décors, avec leur nom, leur description
// et l'éventuel interrupteur qu'ils commandent.
const cliquables = [];
const calendriers = []; // animations des calendriers à pages (appelées à chaque image)
const infoCal = {};
const promessesDecors = [];

// Écran de la TV : une image animée qui ne s'affiche que quand elle est allumée.
const ecranCanvas = document.createElement('canvas');
ecranCanvas.width = 160;
ecranCanvas.height = 90;
const ecranTex = new THREE.CanvasTexture(ecranCanvas);
ecranTex.colorSpace = THREE.SRGBColorSpace;
const matEcran = new THREE.MeshStandardMaterial({
  color: '#050507',
  emissive: '#ffffff',
  emissiveMap: ecranTex,
  emissiveIntensity: 0,
  roughness: 0.25,
});
matEcran.userData.sansSurbrillance = true; // son éclat est géré par l'interrupteur
const matCoqueTV = mat('#15151a');

function dessinerEcran(t) {
  const g = ecranCanvas.getContext('2d');
  const { width: w, height: h } = ecranCanvas;
  const fond = g.createLinearGradient(0, 0, w, h);
  fond.addColorStop(0, `hsl(${(t * 25) % 360}, 65%, 42%)`);
  fond.addColorStop(1, `hsl(${(t * 25 + 120) % 360}, 65%, 26%)`);
  g.fillStyle = fond;
  g.fillRect(0, 0, w, h);
  // une barre de lecture qui avance
  g.fillStyle = '#ffffff30';
  g.fillRect(12, h - 16, w - 24, 4);
  g.fillStyle = '#ffffffcc';
  g.fillRect(12, h - 16, (w - 24) * ((t * 0.05) % 1), 4);
  ecranTex.needsUpdate = true;
}
dessinerEcran(0);

// `retrait` : de combien le décor recule derrière le plan du mur (renfoncement).
const poseMur = {
  ouest: (s, y, o) => ({ p: [0.004 - o, y, s], r: Math.PI / 2 }),
  nord: (s, y, o) => ({ p: [s, y, 0.004 - o], r: 0 }),
  est: (s, y, o) => ({ p: [W - 0.004 + o, y, s], r: -Math.PI / 2 }),
  sud: (s, y, o) => ({ p: [s, y, D - 0.004 + o], r: Math.PI }),
};

function rectangle([w, h], couleur, texture, dx = 0, dy = 0, dz = 0) {
  const materiau = new THREE.MeshStandardMaterial(
    texture ? { map: texture, roughness: 0.7 } : { color: couleur, roughness: 0.8 },
  );
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), materiau);
  m.position.set(dx, dy, dz);
  m.receiveShadow = true;
  return m;
}

for (const d of decors) {
  const g = new THREE.Group();
  let p;
  let r;
  if (d.libre) {
    // Mur en biais : on décolle légèrement le décor le long de sa normale.
    r = d.libre.rotation;
    p = [d.libre.pos[0] + 0.004 * Math.sin(r), d.y, d.libre.pos[1] + 0.004 * Math.cos(r)];
  } else {
    ({ p, r } = poseMur[d.mur](d.s, d.y, d.retrait ?? 0));
  }
  g.position.set(...p);
  g.rotation.y = r;
  if (d.glb) {
    // modèle 3D : il remplace le rectangle ; les matériaux sont préparés une fois chargé
    promessesDecors.push(
      chargeur
        .loadAsync(textures.chemin(d.glb))
        .then((gltf) => {
          gltf.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = !o.material.transparent;
            o.receiveShadow = true;
          });
          g.add(gltf.scene);
          preparerMurs();
        })
        .catch((err) => console.warn(`Modèle introuvable pour « ${d.nom} » :`, err.message)),
    );
  } else if (d.pages) {
    // calendrier à pages : la page du dessous est fixe, la page du dessus se tourne vers le haut
    // autour de sa charnière et glisse derrière
    const [w, h] = d.taille;
    const e = d.epaisseur;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h, e), mat('#ece6e2'));
    chassis.position.z = e / 2;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    g.add(chassis);

    const textes = d.pages.map((u) => textures.image(u));
    const matDessous = new THREE.MeshStandardMaterial({ map: textes[1 % textes.length], roughness: 0.8 });
    const matDessus = new THREE.MeshStandardMaterial({ map: textes[0], roughness: 0.8 });
    const matDos = new THREE.MeshStandardMaterial({ color: '#d8d2c8', roughness: 0.9 });
    const dessous = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDessous);
    dessous.position.z = e + 0.0005;
    dessous.receiveShadow = true;
    g.add(dessous);

    const charniere = new THREE.Group();
    charniere.position.set(0, h / 2, e + 0.0015); // le haut de la page
    const devant = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDessus);
    devant.position.y = -h / 2;
    devant.castShadow = true;
    devant.receiveShadow = true;
    const dos = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDos);
    dos.position.set(0, -h / 2, -0.0004);
    dos.rotation.y = Math.PI;
    charniere.add(devant, dos);
    g.add(charniere);

    const cal = { i: 0, t: -1, n: textes.length };
    const tourner = () => {
      if (cal.t >= 0) return; // une page est déjà en train de tourner
      cal.t = 0;
    };
    calendriers.push((dt) => {
      if (cal.t < 0) return;
      cal.t = Math.min(1, cal.t + dt / 0.85);
      const k = cal.t;
      const lisse = k * k * (3 - 2 * k);
      charniere.rotation.x = -Math.PI * lisse; // vers l'avant puis par-dessus le haut
      // dans la dernière partie, la page s'aplatit contre le mur et disparaît
      charniere.scale.y = 1 - THREE.MathUtils.smoothstep(k, 0.72, 1);
      if (cal.t >= 1) {
        cal.i = (cal.i + 1) % cal.n;
        matDessus.map = textes[cal.i];
        matDessous.map = textes[(cal.i + 1) % cal.n];
        matDessus.needsUpdate = true;
        matDessous.needsUpdate = true;
        charniere.rotation.x = 0;
        charniere.scale.y = 1;
        cal.t = -1;
      }
    });
    infoCal.tourner = tourner;
  } else if (d.epaisseur) {
    // affiche : un châssis sombre derrière l'image
    const [w, h] = d.taille;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, h, d.epaisseur), mat('#ece6e2'));
    chassis.position.z = d.epaisseur / 2;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    g.add(chassis);
    g.add(rectangle(d.taille, d.couleur, texturesNommees[d.texture], 0, 0, d.epaisseur + 0.001));
  } else {
    g.add(rectangle(d.taille, d.couleur, texturesNommees[d.texture]));
  }
  (d.cadres ?? []).forEach((c, i) =>
    g.add(rectangle(c.taille, c.couleur, null, c.pos[0], c.pos[1], c.z ?? 0.003 * (i + 1))),
  );
  if (d.interrupteur) {
    // zone de clic plus large que la petite plaque
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ visible: false }));
    zone.position.z = 0.02;
    g.add(zone);
  }
  g.name = d.nom;
  racine.add(g);
  accrocher(d.sur ?? d.mur, g);

  if (d.description || d.interrupteur) {
    const info = {
      nom: d.nom,
      description: d.description,
      interrupteur: d.interrupteur,
      groupe: g,
      normale: new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), // côté pièce
    };
    if (d.pages) {
      info.auClic = () => infoCal.tourner();
      info.actions = [{ label: 'Page suivante', fn: () => infoCal.tourner() }];
    }
    g.userData.info = info;
    cliquables.push(info);
  }
}

// --- Murs de photos : des posters collés au mur, recadrés pour remplir leur cadre ---
const chargeurTex = new THREE.TextureLoader();
const papierPhoto = new THREE.MeshStandardMaterial({ color: '#faf7f2', roughness: 0.9 });
const adhesif = new THREE.MeshStandardMaterial({ color: '#efe3b8', roughness: 0.7, transparent: true, opacity: 0.8 });

// tous les posters à créer, grilles et placements à la main confondus
const posters = [];
for (const groupe of photosMur) {
  if (groupe.posters) {
    for (const q of groupe.posters) posters.push({ mur: groupe.mur, fichier: q.fichier, s: q.s, y: q.y, w: q.taille[0], h: q.taille[1] });
  } else {
    const [w, h] = groupe.cadre;
    groupe.fichiers.forEach((fichier, i) => {
      posters.push({
        mur: groupe.mur,
        fichier,
        s: groupe.s0 + (i % groupe.colonnes) * groupe.pas[0],
        y: groupe.yHaut - Math.floor(i / groupe.colonnes) * groupe.pas[1],
        w,
        h,
      });
    });
  }
}

posters.forEach((q, i) => {
  const { w, h } = q;
  const g = new THREE.Group();
  const { p, r } = poseMur[q.mur](q.s, q.y, 0);
  g.position.set(...p);
  g.rotation.y = r;
  g.rotation.z = (((i * 7919) % 11) - 5) * 0.004; // chaque affiche est légèrement de travers
  g.name = 'photo ' + (i + 1);

  const marge = 0.008 + 0.012 * Math.min(1, w); // les grands posters ont un bord un peu plus large
  const bord = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * marge, h + 2 * marge), papierPhoto);
  bord.receiveShadow = true;
  g.add(bord);
  const matPhoto = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.7 });
  const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matPhoto);
  image.position.z = 0.0015;
  g.add(image);
  // un bout d'adhésif à chaque coin du haut
  for (const sx of [-1, 1]) {
    const ruban = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.016), adhesif);
    ruban.position.set(sx * (w / 2 - 0.02), h / 2 + marge - 0.004, 0.003);
    ruban.rotation.z = sx * 0.6;
    g.add(ruban);
  }
  racine.add(g);
  accrocher(q.mur, g);

  chargeurTex.load(textures.chemin(q.fichier), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    // « cover » : la photo remplit le cadre, l'excédent est rogné au centre
    const ratioImage = t.image.width / t.image.height;
    const ratioCadre = w / h;
    if (ratioImage > ratioCadre) {
      t.repeat.set(ratioCadre / ratioImage, 1);
      t.offset.set((1 - t.repeat.x) / 2, 0);
    } else {
      t.repeat.set(1, ratioImage / ratioCadre);
      t.offset.set(0, (1 - t.repeat.y) / 2);
    }
    matPhoto.map = t;
    matPhoto.color.set('#ffffff');
    matPhoto.needsUpdate = true;
  });
});

// --- Objets dans la vitrine : coffret, livre, cartes… une boîte plate avec la bonne image devant ---
// Le fond de la vitrine (la face avant de son panneau arrière) est en z = 0,02. Un objet qui penche
// vers l'arrière pivote autour de sa base : on place sa base pour que le haut de son dos touche
// juste le fond, sans le traverser.
const Z_FOND = 0.02;
const baseZ = {}; // z de la base de chaque objet, pour poser les petits objets devant les grands
for (const o of objetsVitrine) {
  if (o.baton) {
    // light stick : corps fuselé (surface de révolution) argenté-bleuté, tête ajourée au logo qui s'illumine
    const { longueur: L, z, angle } = o.baton;
    const profil = [[0, 0], [0.011, 0], [0.0125, 0.006], [0.0125, 0.07], [0.0155, 0.09], [0.0195, 0.11], [0.0215, 0.13], [0.0225, 0.2], [0.0215, 0.25], [0.017, 0.258], [0.01, 0.262], [0, 0.263]]
      .map(([r, y]) => new THREE.Vector2(r, (y / 0.263) * L));
    const corps = new THREE.Mesh(
      new THREE.LatheGeometry(profil, 40),
      new THREE.MeshStandardMaterial({ color: '#8e9bb0', metalness: 0.55, roughness: 0.4 }),
    );
    corps.castShadow = true;
    corps.receiveShadow = true;
    const bague = new THREE.Mesh(new THREE.TorusGeometry(0.0128, 0.002, 8, 32), new THREE.MeshStandardMaterial({ color: '#c8d0dc', metalness: 0.6, roughness: 0.35 }));
    bague.rotation.x = Math.PI / 2;
    bague.position.y = 0.075 * (L / 0.263);
    const fenetre = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0227, 0.0227, 0.14 * (L / 0.263), 32, 1, true, -0.62, 1.24),
      new THREE.MeshStandardMaterial({ color: '#0b0f14', emissive: '#ffffff', emissiveMap: textures.logoLightStick(), emissiveIntensity: 0.9, roughness: 0.3, side: THREE.DoubleSide }),
    );
    fenetre.position.y = 0.185 * (L / 0.263);
    const bras = new THREE.Group();
    bras.add(corps, bague, fenetre);
    bras.rotation.z = -Math.PI / 2; // couché, tête vers +x
    bras.position.set(-L / 2, 0.0225, 0);
    const g = new THREE.Group();
    g.name = o.nom;
    g.position.set(o.pos[0], o.pos[1], z);
    g.rotation.y = angle;
    g.add(bras);
    racine.add(g);
    const info = { nom: o.nom, description: o.description, groupe: g };
    g.userData.info = info;
    cliquables.push(info);
    continue;
  }
  if (o.pile) {
    // pile de boîtes rondes : un cylindre par version, légèrement tourné l'un par rapport à l'autre
    const { rayon, epaisseur, boites, couvercle } = o.pile;
    const g = new THREE.Group();
    g.name = o.nom;
    g.position.set(o.pos[0], o.pos[1], Z_FOND + rayon + 0.002);
    const n = boites.length;
    boites.forEach((b, i) => {
      const geo = new THREE.CylinderGeometry(rayon, rayon, epaisseur, 48);
      const tranche = new THREE.MeshStandardMaterial({ map: textures.pureflowTranche(b.couleur, b.fond, i + 1), roughness: 0.55 });
      const lid = new THREE.MeshStandardMaterial({ map: textures.image(couvercle), roughness: 0.5, color: new THREE.Color(b.couleur).lerp(new THREE.Color('#ffffff'), 0.35) });
      const dessous = new THREE.MeshStandardMaterial({ color: b.fond, roughness: 0.7 });
      const m = new THREE.Mesh(geo, [tranche, i === 0 ? lid : dessous, dessous]);
      m.position.y = epaisseur * (n - 1 - i) + epaisseur / 2; // la 1re version est en haut
      m.rotation.y = i * 0.35 + 0.2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    });
    racine.add(g);
    const info = { nom: o.nom, description: o.description, groupe: g };
    g.userData.info = info;
    cliquables.push(info);
    continue;
  }
  const [w, h, d] = o.taille;
  const incl = o.inclinaison ?? 0;
  const lacet = o.rotation ?? 0.02; // à peine de travers, comme posé à la main
  let z = 0.18;
  if (o.contreMur) {
    z = Z_FOND + h * Math.sin(incl) + (d / 2) * Math.cos(incl) + (w / 2) * Math.sin(Math.abs(lacet)) + 0.001 + (o.avance ?? 0);
  } else if (o.devant) {
    const support = objetsVitrine.find((x) => x.nom === o.devant);
    const dessous = baseZ[o.devant] + support.taille[2] / 2 + 0.002;
    z = dessous + h * Math.sin(incl) + (d / 2) * Math.cos(incl);
  }
  baseZ[o.nom] = z;

  const cote = new THREE.MeshStandardMaterial({ color: o.cote ?? '#f1ece2', roughness: 0.9 });
  const avant = new THREE.MeshStandardMaterial({ map: textures.image(o.texture), roughness: 0.85 });
  // ordre des faces d'une boîte : +x, -x, +y, -y, +z (avant), -z
  const boite = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [cote, cote, cote, cote, avant, cote]);
  boite.position.set(0, h / 2, 0);
  boite.castShadow = true;
  boite.receiveShadow = true;
  const g = new THREE.Group();
  g.name = o.nom;
  g.position.set(o.pos[0], o.pos[1], z);
  g.rotation.order = 'YXZ';
  g.rotation.y = lacet;
  g.rotation.x = -incl; // penche vers le fond de la vitrine
  g.add(boite);
  racine.add(g);
  const info = { nom: o.nom, description: o.description, groupe: g };
  g.userData.info = info;
  cliquables.push(info);
}

// --- Meubles : formes simples, remplacées par un .glb si `glb` est renseigné ---
function creerPartie(p) {
  let geo;
  let hauteur;
  if (p.forme === 'cylindre') {
    geo = new THREE.CylinderGeometry(p.taille[0] / 2, p.taille[0] / 2, p.taille[1], 24);
    hauteur = p.taille[1];
  } else if (p.forme === 'sphere') {
    geo = new THREE.SphereGeometry(p.taille[0] / 2, 16, 12);
    hauteur = p.taille[0];
  } else if (p.forme === 'tore') {
    geo = new THREE.TorusGeometry(p.taille[0] / 2, p.taille[1], 8, 40);
    hauteur = p.taille[0];
  } else {
    geo = new THREE.BoxGeometry(...p.taille);
    hauteur = p.taille[1];
  }

  let materiau;
  if (p.ecran) materiau = [matEcran, matCoqueTV, matCoqueTV, matCoqueTV, matCoqueTV, matCoqueTV]; // +x = écran
  else if (p.texture) materiau = mat('#ffffff', { map: texturesNommees[p.texture], roughness: 0.95 });
  else if (p.verre) materiau = mat(p.couleur, { transparent: true, opacity: 0.25, depthWrite: false });
  else if (p.metal) materiau = mat(p.couleur, { roughness: 0.35, metalness: 0.6 });
  else materiau = mat(p.couleur);

  const m = new THREE.Mesh(geo, materiau);
  m.position.set(p.pos[0], p.centre ? p.pos[1] : p.pos[1] + hauteur / 2, p.pos[2]);
  if (p.rot) m.rotation.set(...p.rot);
  if (p.echelle) m.scale.set(...p.echelle);
  m.castShadow = !p.verre;
  m.receiveShadow = true;
  return m;
}

// Remplace les formes provisoires d'un meuble par son vrai modèle, qui est
// automatiquement mis à l'échelle et posé à la place des formes : même
// emprise, sol au même niveau, centré. Ça marche donc quelle que soit l'unité
// ou l'orientation d'origine du fichier (voir les options dans chambre.js).
const tailleModele = new THREE.Vector3();
const tailleVisee = new THREE.Vector3();
const centreModele = new THREE.Vector3();
const centreVise = new THREE.Vector3();

function remplacerParModele(groupe, modele, m) {
  if (m.ajuster === false) {
    // modèle fabriqué au bon repère : on le pose tel quel
    groupe.clear();
    groupe.add(modele);
    return;
  }

  // emprise visée = celle des formes provisoires, dans le repère du meuble
  const rotation = groupe.rotation.y;
  groupe.rotation.y = 0;
  groupe.updateWorldMatrix(true, true);
  const visee = new THREE.Box3().setFromObject(groupe);
  visee.translate(groupe.getWorldPosition(new THREE.Vector3()).negate());
  groupe.rotation.y = rotation;

  modele.rotation.y = m.orientation ?? 0; // pour tourner un modèle qui regarde du mauvais côté
  modele.updateMatrixWorld(true);
  let boite = new THREE.Box3().setFromObject(modele);
  boite.getSize(tailleModele);
  visee.getSize(tailleVisee);

  if (m.echelle) modele.scale.setScalar(m.echelle);
  else if (m.etirer) modele.scale.set(tailleVisee.x / tailleModele.x, tailleVisee.y / tailleModele.y, tailleVisee.z / tailleModele.z);
  else modele.scale.setScalar(Math.min(tailleVisee.x / tailleModele.x, tailleVisee.y / tailleModele.y, tailleVisee.z / tailleModele.z));

  modele.updateMatrixWorld(true);
  boite = new THREE.Box3().setFromObject(modele);
  boite.getCenter(centreModele);
  visee.getCenter(centreVise);
  const [dx, dy, dz] = m.decalage ?? [0, 0, 0];
  modele.position.set(centreVise.x - centreModele.x + dx, visee.min.y - boite.min.y + dy, centreVise.z - centreModele.z + dz);

  groupe.clear();
  groupe.add(modele);
}
const promesses = [];

for (const m of meubles) {
  const groupe = new THREE.Group();
  groupe.name = m.nom;
  groupe.position.set(m.pos[0], 0, m.pos[1]);
  groupe.rotation.y = m.rotation ?? 0;
  m.parties.forEach((p) => groupe.add(creerPartie(p)));
  racine.add(groupe);
  if (m.mur) accrocher(m.mur, groupe);
  const info = { nom: m.nom, description: m.description, interrupteur: m.interrupteur, groupe };
  groupe.userData.info = info;
  cliquables.push(info);

  if (m.glb) {
    promesses.push(
      chargeur
        .loadAsync(textures.chemin(m.glb))
        .then((gltf) => {
          gltf.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = !o.material.transparent;
            o.receiveShadow = true;
            // le modèle de TV contient un plan nommé « ecran » : on y branche l'image animée
            if (o.name === 'ecran') o.material = matEcran;
          });
          remplacerParModele(groupe, gltf.scene, m);
          preparerMurs(); // le modèle d'un meuble accroché à un mur doit s'effacer avec lui
        })
        .catch((err) => console.warn(`Modèle introuvable pour « ${m.nom} » :`, err.message)),
    );
  }
}

// --- Lumières ---
// Éclairage repris de la référence : un grand soleil doux qui porte des ombres, plus un
// remplissage rose (ambiant) et un dôme céleste. Ce fort remplissage est ce qui donne ce
// rendu propre et pastel : les ombres restent légères, les couleurs jamais écrasées.
const ambiante = new THREE.AmbientLight('#ffd9ea', 0.6);
scene.add(ambiante);
const hemi = new THREE.HemisphereLight('#f0efff', '#b4a6ba', 0.8);
scene.add(hemi);

const soleil = new THREE.DirectionalLight('#fff3e6', 1.2);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 64 });
soleil.shadow.radius = 1.8;
soleil.shadow.bias = -0.00015;
soleil.shadow.normalBias = 0.018;
scene.add(soleil);
scene.add(soleil.target);
soleil.target.position.set(0, 0.5, 0);

const geoAmpoule = new THREE.SphereGeometry(0.05, 12, 12);

// Un spot mural : platine ronde contre le mur, bras, douille et ampoule de verre en poire.
// Tout est tourné vers +x (vers l'intérieur de la pièce, pour le mur ouest).
const matSpot = new THREE.MeshStandardMaterial({ color: '#e4e9ec', roughness: 0.5, metalness: 0.2 });
const matDouille = new THREE.MeshStandardMaterial({ color: '#c4ccd1', roughness: 0.45, metalness: 0.3 });
const geoPoire = new THREE.LatheGeometry(
  [[0.0, 0.0], [0.012, 0.0], [0.016, 0.014], [0.026, 0.03], [0.034, 0.05], [0.035, 0.068], [0.028, 0.088], [0.014, 0.102], [0.0, 0.106]].map(([rr, y]) => new THREE.Vector2(rr, y)),
  24,
);
geoPoire.rotateZ(-Math.PI / 2); // la pointe de l'ampoule regarde vers +x
function creerSpot(y, z, matAmpoule) {
  const g = new THREE.Group();
  g.position.set(0, y, z);
  const piece = (geo, mat, x) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.x = x;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const plaque = new THREE.CylinderGeometry(0.048, 0.05, 0.014, 24);
  plaque.rotateZ(Math.PI / 2);
  piece(plaque, matSpot, 0.007);
  const bras = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 12);
  bras.rotateZ(Math.PI / 2);
  piece(bras, matSpot, 0.039);
  const douille = new THREE.CylinderGeometry(0.021, 0.02, 0.05, 18);
  douille.rotateZ(Math.PI / 2);
  piece(douille, matDouille, 0.088);
  const bague = new THREE.TorusGeometry(0.021, 0.004, 8, 18);
  bague.rotateY(Math.PI / 2);
  piece(bague, matDouille, 0.113);
  const ampoule = piece(geoPoire, matAmpoule, 0.113);
  ampoule.castShadow = false;
  return g;
}

const lampes = lumieres.map((l) => {
  const materiauAmpoule = new THREE.MeshStandardMaterial({
    color: l.couleur,
    emissive: l.couleur,
    emissiveIntensity: 0,
    roughness: 0.3,
  });
  const lights = [];
  const nouvelleLumiere = (pos, ombres) => {
    const lumiere = new THREE.PointLight(l.couleur, 0, l.portee ?? 6, 1.5);
    lumiere.position.set(...pos);
    lumiere.castShadow = ombres;
    if (ombres) lumiere.shadow.mapSize.set(1024, 1024);
    racine.add(lumiere);
    lights.push(lumiere);
  };

  if (l.spots) {
    // un spot par ampoule : sa lumière est un peu en avant de l'ampoule pour éclairer la pièce sans cramer le mur
    l.ampoules.forEach(([, y, z], i) => {
      const spot = creerSpot(y, z, materiauAmpoule);
      racine.add(spot);
      if (l.mur) accrocher(l.mur, spot);
      nouvelleLumiere([0.34, y - 0.08, z], !!l.ombres && i === 1);
    });
  } else {
    nouvelleLumiere(l.pos, !!l.ombres);
    for (const p of l.ampoules ?? [l.pos]) {
      const a = new THREE.Mesh(geoAmpoule, materiauAmpoule);
      a.position.set(...p);
      racine.add(a);
      if (l.mur) accrocher(l.mur, a);
    }
  }
  return { nom: l.nom, lumieres: lights, materiauAmpoule, intensite: l.intensite };
});

// Lueur bleutée de la TV allumée. Un écran n'éclaire que devant lui : c'est un projecteur
// placé dans le plan de l'écran et tourné vers le lit, pas une lampe qui rayonne partout.
// Le mur et la charpente derrière la TV restent donc dans l'ombre.
const lumTV = new THREE.SpotLight('#9ab8ff', 0, 6, Math.PI / 3, 0.9, 2);
lumTV.position.set(0.3, 0.78, 2.2);
lumTV.target.position.set(3, 0.55, 2.2);
racine.add(lumTV, lumTV.target);

// --- Interrupteurs ---
// `manuel` : null = automatique (les lumières suivent la nuit), sinon true / false
// choisi à la main. `niveau` va de 0 à 1 en douceur.
let nuit = 0;
const commandes = {};
for (const i of interrupteurs) {
  commandes[i.id] = {
    ...i,
    manuel: null,
    niveau: 0,
    lampes: lampes.filter((l) => (i.lumieres ?? []).includes(l.nom)),
  };
}
const estAllume = (id) => commandes[id].manuel ?? (commandes[id].tv ? false : nuit > 0.5);
const basculer = (id) => {
  commandes[id].manuel = !estAllume(id);
};
const toutAuto = () => {
  for (const c of Object.values(commandes)) c.manuel = null;
};

function majLumieres(dt) {
  for (const c of Object.values(commandes)) {
    const cible = c.manuel === null ? (c.tv ? 0 : nuit) : c.manuel ? 1 : 0;
    c.niveau += (cible - c.niveau) * Math.min(1, dt * 6);
    for (const l of c.lampes) {
      for (const lu of l.lumieres) lu.intensity = l.intensite * c.niveau;
      l.materiauAmpoule.emissiveIntensity = 2.5 * c.niveau;
    }
    if (c.tv) {
      matEcran.emissiveIntensity = 1.1 * c.niveau;
      lumTV.intensity = 4 * c.niveau;
    }
  }
}

// --- Cycle jour / nuit ---
// Couleurs du ciel de la référence : soleil rasant orange, midi crème, nuit bleutée.
const SOLEIL_BAS = new THREE.Color('#ffb27a');
const SOLEIL_MIDI = new THREE.Color('#fff3e6');
const SOLEIL_NUIT = new THREE.Color('#aec6f0');
const AMBIANT_BAS = new THREE.Color('#ffd2c4');
const AMBIANT_MIDI = new THREE.Color('#ffd9ea');
const AMBIANT_NUIT = new THREE.Color('#b4bddb');
const HEMI_CIEL_NUIT = new THREE.Color('#9fa6d0');
const HEMI_CIEL_JOUR = new THREE.Color('#f0efff');
const tmp = new THREE.Color();
const tmp2 = new THREE.Color();
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const elHeure = document.getElementById('heure');
const elCurseur = document.getElementById('curseur');
const elLive = document.getElementById('live');
let manuel = false;

function appliquerHeure(heure) {
  // lever à 6 h, coucher à 19 h : le soleil monte de 8° à 60° puis redescend
  const h = ((heure % 24) + 24) % 24;
  const u = clamp01((h - 6) / 13);
  const d = h > 6 && h < 19 ? Math.sin(u * Math.PI) : 0; // 0 aux extrémités, 1 à la mi-journée
  // facteur de jour : 0 la nuit, 1 en plein jour, avec une transition d'une heure au lever et au coucher
  const f = clamp01(h <= 5.1 || h >= 19.9 ? 0 : h >= 6 && h <= 19 ? 1 : h < 6 ? (h - 5.1) / 0.9 : (19.9 - h) / 0.9);

  // le soleil se lève à l'est (+x), passe au sud (+z), se couche à l'ouest
  const elevation = 0.14 + d * (1.05 - 0.14);
  const azimut = Math.PI * u;
  const R = 22;
  const jourX = Math.cos(azimut) * Math.cos(elevation) * R;
  const jourY = Math.sin(elevation) * R;
  const jourZ = Math.sin(azimut) * Math.cos(elevation) * R;
  soleil.position.set(8.8 + (jourX - 8.8) * f, 19.8 + (jourY - 19.8) * f, 6.6 + (jourZ - 6.6) * f);
  soleil.intensity = 0.65 * (1 - f) + f * (0.7 + 0.8 * d);
  tmp.copy(SOLEIL_BAS).lerp(SOLEIL_MIDI, d);
  soleil.color.copy(SOLEIL_NUIT).lerp(tmp, f);

  ambiante.intensity = (0.65 * (1 - f) + f * (0.45 + 0.2 * d)) * (0.55 + 0.45 * f);
  tmp2.copy(AMBIANT_BAS).lerp(AMBIANT_MIDI, d);
  ambiante.color.copy(AMBIANT_NUIT).lerp(tmp2, f);
  // la nuit, le dôme céleste baisse pour que les lampes se voient, sans jamais noircir la scène
  hemi.intensity = 0.8 * (0.5 + 0.5 * f);
  hemi.color.copy(HEMI_CIEL_NUIT).lerp(HEMI_CIEL_JOUR, f);

  veluxMat.emissiveIntensity = 0.15 + 0.85 * f;
  veluxMat.emissive.set(f > 0.3 ? '#bfe3ff' : '#0b1230');
  veluxMat.color.copy(veluxMat.emissive);

  nuit = 1 - f;
  document.documentElement.style.setProperty('--nuit', nuit.toFixed(3));

  const hh = Math.floor(heure) % 24;
  const mm = Math.floor((heure % 1) * 60);
  elHeure.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function heureReelle() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

elCurseur.addEventListener('input', () => {
  manuel = true;
  appliquerHeure(parseFloat(elCurseur.value));
});
elLive.addEventListener('click', () => {
  manuel = false;
  elCurseur.value = heureReelle();
  appliquerHeure(heureReelle());
});

elCurseur.value = heureReelle();
appliquerHeure(heureReelle());
majLumieres(10); // au chargement, pas de fondu : les lumières prennent directement leur état

// --- Boucle ---
function redimensionner() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();

preparerMurs();
const interactions = initialiserInteractions({
  canvas,
  camera,
  controls,
  racine,
  murs,
  cliquables,
  vues,
  commandes,
  estAllume,
  basculer,
  toutAuto,
});
const horloge = new THREE.Clock();
let dernierEcran = -1;
let derniereMinute = -1;
renderer.setAnimationLoop(() => {
  if (!manuel) {
    const min = new Date().getMinutes();
    if (min !== derniereMinute) {
      derniereMinute = min;
      elCurseur.value = heureReelle();
      appliquerHeure(heureReelle());
    }
  }
  const dt = Math.min(horloge.getDelta(), 0.1);
  animerMurs(dt);
  majLumieres(dt);
  interactions.maj(dt);
  for (const f of calendriers) f(dt);
  // l'image de la TV change environ 8 fois par seconde, seulement si elle est allumée
  const maintenant = performance.now() / 1000;
  if (commandes.tv?.niveau > 0.02 && maintenant - dernierEcran > 0.12) {
    dernierEcran = maintenant;
    dessinerEcran(maintenant);
  }
  controls.update();
  renderer.render(scene, camera);
});

Promise.allSettled([...promesses, ...promessesDecors]).then(() => {
  document.getElementById('chargement').classList.add('fini');
});
