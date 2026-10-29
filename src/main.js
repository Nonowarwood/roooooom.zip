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
  magazinesCommode,
  lieu,
} from './chambre.js';
import { initialiserInteractions } from './interactions.js';
import { heuresSoleil, formatHeure } from './soleil.js';
import * as textures from './textures.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

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
// Réglages repris de la référence (inertie 0,08, zoom borné, caméra qui peut aller jusqu'à la verticale
// du dessus mais pas passer sous le sol : 82° max depuis le haut), COMBINÉS avec l'ancien système :
// le déplacement latéral reste possible (clic droit, Maj + glisser, ou deux doigts), mais la cible de
// la caméra est gardée dans la pièce pour qu'on ne puisse jamais perdre la chambre hors de l'écran.
const LIMITE_POLAIRE = Math.PI / 2.2;
controls.enablePan = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 16;
controls.minPolarAngle = 0;
controls.maxPolarAngle = LIMITE_POLAIRE;
const LIMITE_CIBLE = { min: new THREE.Vector3(-2.6, 0, -2.6), max: new THREE.Vector3(2.6, 2.4, 2.6) }; // en repère scène
const reglages = { murs: 'auto' }; // 'auto' | 'up' (tous levés) | 'down' (tous baissés) : boutons en haut à gauche
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
    if (reglages.murs === 'up') cible = HAUTEUR_MUR;
    else if (reglages.murs === 'down') cible = HAUTEUR_BORDURE;

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
// Géométrie du Velux, dans le repère de la pente (x = est, y = le long de la pente vers le haut,
// z = vers l'extérieur) : le cadre est dans le plan extérieur (z = T), l'ouverture dans le plâtre
// (z = 0) est plus haute de T / tan(pente) et un peu plus large (évasement).
const T = velux.profondeur;
const decalage = velux.appui; // de combien le bord avant du rebord est plus haut sur la pente que le bas du cadre
const yBas = velux.bas; // bas du cadre
const yHaut = velux.bas + velux.longueur; // haut du cadre
const I0 = yBas + decalage; // bas de l'ouverture dans le plâtre
const I1 = yHaut; // haut de l'ouverture : le cadre touche le haut, la coupe du dessus est perpendiculaire à la pente
const demiCadre = velux.largeur / 2;
const demiOuv = demiCadre + velux.evasement;
const trou = new THREE.Path();
const [vx0, vx1] = [velux.x - demiOuv, velux.x + demiOuv];
const [vy0, vy1] = [I0, I1];
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

// --- Le Velux, d'après tes photos : plâtre d'aplomb, cadre en chêne en gradins, battant blanc ---
const veluxObjet = new THREE.Group(); // l'objet sur lequel on clique (plâtre, cadre, vitre, store)
veluxObjet.name = 'Velux';
pente.add(veluxObjet);

const platre = new THREE.MeshStandardMaterial({ color: '#faf1ea', roughness: 0.95, side: THREE.DoubleSide });
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, platre);
  m.receiveShadow = true;
  veluxObjet.add(m);
}
const xc = velux.x;
// rebord (horizontal) et dessus (horizontal) : de l'ouverture du plâtre jusqu'au cadre
quad([xc - demiOuv, I0, 0], [xc + demiOuv, I0, 0], [xc + demiCadre, yBas, T], [xc - demiCadre, yBas, T]);
quad([xc - demiOuv, I1, 0], [xc + demiOuv, I1, 0], [xc + demiCadre, yHaut, T], [xc - demiCadre, yHaut, T]);
// côtés (verticaux) : ils se resserrent de l'ouverture vers le cadre
quad([xc - demiOuv, I0, 0], [xc - demiOuv, I1, 0], [xc - demiCadre, yHaut, T], [xc - demiCadre, yBas, T]);
quad([xc + demiOuv, I0, 0], [xc + demiOuv, I1, 0], [xc + demiCadre, yHaut, T], [xc + demiCadre, yBas, T]);

const chene = new THREE.MeshStandardMaterial({ color: '#d4a25e', roughness: 0.7 });
const blancBattant = new THREE.MeshStandardMaterial({ color: '#f6f2eb', roughness: 0.6 });
const alu = new THREE.MeshStandardMaterial({ color: '#b6bcc6', roughness: 0.45, metalness: 0.45 });
function bloc(l, h, d, mat, x, y, z, ombre = false) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = ombre;
  m.receiveShadow = true;
  veluxObjet.add(m);
  return m;
}
const yc = (yBas + yHaut) / 2;
const FC = 0.05; // largeur du cadre en chêne
const FB = 0.032; // largeur du battant blanc
// cadre en chêne (extérieur)
// le chêne déborde de 6 mm dans le plâtre (dessus et côtés) : ses faces ne sont plus dans le même plan que
// celles du plâtre, ce qui faisait clignoter le bois et le blanc l'un dans l'autre
const DEB = 0.006;
bloc(velux.largeur + 2 * DEB, FC + DEB, 0.05, chene, xc, yHaut - (FC - DEB) / 2, T - 0.02);
bloc(velux.largeur + 2 * DEB, FC, 0.05, chene, xc, yBas + FC / 2, T - 0.02);
bloc(FC + DEB, velux.longueur - 2 * FC, 0.05, chene, xc - demiCadre + (FC - DEB) / 2, yc, T - 0.02);
bloc(FC + DEB, velux.longueur - 2 * FC, 0.05, chene, xc + demiCadre - (FC - DEB) / 2, yc, T - 0.02);
// battant blanc (un cran plus bas vers la pièce, d'où l'aspect en gradins)
const wB = velux.largeur - 2 * FC;
const hB = velux.longueur - 2 * FC;
bloc(wB, FB, 0.04, blancBattant, xc, yHaut - FC - FB / 2, T - 0.04);
bloc(wB, FB, 0.04, blancBattant, xc, yBas + FC + FB / 2, T - 0.04);
bloc(FB, hB - 2 * FB, 0.04, blancBattant, xc - wB / 2 + FB / 2, yc, T - 0.04);
bloc(FB, hB - 2 * FB, 0.04, blancBattant, xc + wB / 2 - FB / 2, yc, T - 0.04);
// poignée blanche, au milieu du bas du battant
bloc(0.07, 0.02, 0.012, blancBattant, xc, yBas + FC + FB / 2, T - 0.068, true);
bloc(0.05, 0.014, 0.02, blancBattant, xc, yBas + FC + FB / 2 + 0.012, T - 0.058, true);

// --- Charpente contre le mur ouest : chevron + poteau + entrait, comme sur ta photo ---
// Même style que la pièce : bois uni et mat, quelques fines veines. Un mobile d'avions en bois y pend.
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

// chevron : sous la pente, plaqué au mur. Prisme dont le bout du haut est coupé à l'horizontale, à la
// hauteur du plafond : il vient toucher le plafond au lieu de s'arrêter en biais en dessous.
// Profil dessiné dans le plan du mur (z, y), puis extrudé sur la profondeur de la pièce (x).
const cosP = R / LP; // cosinus et sinus de l'angle de la pente
const sinP = (H - K) / LP;
const surfaceP = (sigma) => [D - sigma * cosP, K + sigma * sinP]; // point de la pente à la distance sigma du bas
const versPiece = (pt, e) => [pt[0] - e * sinP, pt[1] - e * cosP]; // le même point, e plus bas dans la pièce (perpendiculairement)
const yHautChevron = H + 0.006;
const sigmaHaut = (yHautChevron - K) / sinP; // où la surface atteint la hauteur du plafond
const sigmaDessous = (yHautChevron - K + poutre.epaisseur * cosP) / sinP; // idem pour le dessous
const profilChevron = [
  surfaceP(-0.02),
  surfaceP(sigmaHaut),
  versPiece(surfaceP(sigmaDessous), poutre.epaisseur),
  versPiece(surfaceP(-0.02), poutre.epaisseur),
];
const formeChevron = new THREE.Shape(profilChevron.map(([z, y]) => new THREE.Vector2(z, y)));
const geoChevron = new THREE.ExtrudeGeometry(formeChevron, { depth: D2, bevelEnabled: false });
geoChevron.rotateY(-Math.PI / 2); // l'extrusion part vers -x : on la ramène dans la pièce
geoChevron.translate(D2 + 0.002, 0, 0);
const chevron = morceau(geoChevron, boisPoutre, 0, 0, 0);
// quelques veines le long de la pente, sur la face visible
for (let i = 0; i < 3; i++) {
  const longueurV = LP * (0.55 + 0.4 * (((i * 37) % 10) / 10));
  const centreV = versPiece(surfaceP(LP * 0.55 + (((i * 13) % 7) / 7 - 0.5) * 0.4), poutre.epaisseur / 2 - (i - 1) * (poutre.epaisseur / 4));
  const v = morceau(new THREE.BoxGeometry(0.002, longueurV, 0.004), veinePoutre, D2 + 0.0035, centreV[1], centreV[0]);
  v.rotation.x = Math.atan2(sinP, cosP) - Math.PI / 2;
  v.castShadow = false;
  charpente.add(v);
}
charpente.add(chevron);

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

// --- Mobile d'avions en bois, accroché au chevron juste au-dessus du poteau ---
// Deux baguettes parallèles ; au bout de fils : deux petits biplans, deux nuages et un cœur en bois. Ils
// se balancent très doucement.
const metalSombre = new THREE.MeshStandardMaterial({ color: '#4a4540', roughness: 0.6, metalness: 0.5 });
const boisClair = new THREE.MeshStandardMaterial({ color: '#e6cda0', roughness: 0.8 });
const boisAvion = new THREE.MeshStandardMaterial({ color: '#d4a96c', roughness: 0.8 });
const boisJaune = new THREE.MeshStandardMaterial({ color: '#efc767', roughness: 0.8 });
const filMat = new THREE.MeshStandardMaterial({ color: '#e9e0d0', roughness: 0.9 });

function biplan() {
  const a = new THREE.Group();
  const boite = (l, h, p, mat, x, y, z) => {
    const m = morceau(new RoundedBoxGeometry(l, h, p, 1, Math.min(l, h, p) * 0.3), mat, x, y, z);
    a.add(m);
    return m;
  };
  boite(0.016, 0.016, 0.09, boisAvion, 0, 0, 0); // fuselage (le nez vers +z)
  boite(0.11, 0.004, 0.03, boisClair, 0, -0.011, 0.005); // aile du bas
  boite(0.11, 0.004, 0.03, boisClair, 0, 0.019, 0.005); // aile du haut
  for (const sx of [-0.035, 0.035]) boite(0.003, 0.03, 0.003, boisAvion, sx, 0.004, 0.005); // mâts entre les ailes
  boite(0.004, 0.026, 0.022, boisAvion, 0, 0.012, -0.043); // dérive
  boite(0.045, 0.003, 0.016, boisClair, 0, 0.002, -0.043); // plan fixe arrière
  boite(0.003, 0.034, 0.006, boisAvion, 0, 0, 0.047); // hélice
  return a;
}
function formeBois(forme, mat, echelle) {
  const geo = new THREE.ExtrudeGeometry(forme, { depth: 0.005, bevelEnabled: false, curveSegments: 10 });
  geo.center();
  geo.scale(echelle, echelle, 1);
  const m = morceau(geo, mat, 0, 0, 0);
  m.userData.plat = true;
  return m;
}
function nuage() {
  const f = new THREE.Shape();
  f.moveTo(-0.5, 0);
  f.absarc(-0.28, 0.02, 0.22, Math.PI, Math.PI * 0.1, true);
  f.absarc(0.05, 0.1, 0.3, Math.PI * 0.85, Math.PI * 0.05, true);
  f.absarc(0.3, 0.0, 0.2, Math.PI * 0.35, -Math.PI * 0.5, true);
  f.lineTo(-0.3, -0.2);
  f.closePath();
  return formeBois(f, boisJaune, 0.09);
}
function coeur() {
  const f = new THREE.Shape();
  f.moveTo(0, -0.45);
  f.bezierCurveTo(-0.6, -0.05, -0.5, 0.5, 0, 0.22);
  f.bezierCurveTo(0.5, 0.5, 0.6, -0.05, 0, -0.45);
  return formeBois(f, boisJaune, 0.075);
}

const mobile = new THREE.Group();
mobile.name = 'mobile avions';
const zMobile = poutre.poteau.z - 0.13;
mobile.position.set(D2 + 0.07, 1.68, zMobile);
mobile.rotation.x = -0.1; // les baguettes montent un peu vers le fond de la pièce, comme sur la photo
// deux baguettes parallèles, tenues au chevron par deux petits crochets
for (const dy of [-0.014, 0.014]) {
  const baguette = morceau(new THREE.CylinderGeometry(0.0055, 0.0055, 0.46, 10), boisClair, 0, dy, 0);
  baguette.rotation.x = Math.PI / 2;
  mobile.add(baguette);
}
for (const dz of [-0.17, 0.17]) {
  const crochet = morceau(new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8), metalSombre, -0.035, 0, dz);
  crochet.rotation.z = Math.PI / 2;
  crochet.castShadow = false;
  mobile.add(crochet);
}
const pendules = [];
// [position sur la baguette, longueur du fil, objet, rotation autour de la verticale]
for (const [dz, fil, objet, lacet, phase] of [
  [-0.19, 0.2, nuage(), 0.5, 0.0],
  [-0.1, 0.4, biplan(), 0.95, 1.7],
  [0.04, 0.27, nuage(), -0.3, 3.1],
  [0.12, 0.5, biplan(), -0.7, 4.6],
  [0.2, 0.34, coeur(), 0.2, 5.4],
]) {
  const pivot = new THREE.Group(); // le point d'accroche : c'est lui qui se balance
  pivot.position.set(0, 0, dz);
  const cordon = morceau(new THREE.CylinderGeometry(0.0012, 0.0012, fil, 5), filMat, 0, -fil / 2, 0);
  cordon.castShadow = false;
  objet.position.y = -fil - (objet.userData.pend ?? 0.012);
  objet.rotation.y = lacet + (objet.userData.plat ? Math.PI / 2 : 0); // nuages et cœur : la face plate regarde la pièce
  pivot.add(cordon, objet);
  mobile.add(pivot);
  pendules.push({ pivot, phase, amplitude: 0.05 + 0.03 * ((pendules.length * 7) % 3) / 3 });
}
charpente.add(mobile);
let tempsMobile = 0;
function animerMobile(dt) {
  tempsMobile += dt;
  for (const { pivot, phase, amplitude } of pendules) {
    pivot.rotation.x = amplitude * Math.sin(tempsMobile * 0.9 + phase);
    pivot.rotation.z = amplitude * 0.6 * Math.cos(tempsMobile * 0.7 + phase);
  }
}

racine.add(charpente);
racine.updateMatrixWorld(true);

const veluxMat = new THREE.MeshStandardMaterial({
  color: '#bfe3ff',
  emissive: '#bfe3ff',
  emissiveIntensity: 0.8,
  roughness: 0.2,
  side: THREE.BackSide,
});
// ouverture visible de la vitre : à l'intérieur du battant
const wV = wB - 2 * FB;
const hV = hB - 2 * FB;
const yHautV = yc + hV / 2;
const vitre = new THREE.Mesh(new THREE.PlaneGeometry(wV, hV), veluxMat);
vitre.position.set(xc, yc, T);
veluxObjet.add(vitre);
veluxMat.userData.sansSurbrillance = true; // son éclat suit le jour et le store, pas la sélection

// --- Store occultant noir : un caisson gris en haut, deux rails gris sur les côtés, une toile noire
// plissée qui descend, et une barre en bas ---
const cPli = document.createElement('canvas');
cPli.width = 8;
cPli.height = 32;
{
  const g = cPli.getContext('2d');
  const d = g.createLinearGradient(0, 0, 0, 32);
  d.addColorStop(0, '#4a4a54');
  d.addColorStop(0.6, '#33333b');
  d.addColorStop(1, '#1e1e24');
  g.fillStyle = d;
  g.fillRect(0, 0, 8, 32);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(0, 0, 8, 2); // l'arête de chaque pli
}
const texStore = new THREE.CanvasTexture(cPli);
texStore.colorSpace = THREE.SRGBColorSpace;
texStore.wrapT = THREE.RepeatWrapping;
const NB_PLIS = 22; // nombre de plis quand le store est entièrement fermé
const matStore = new THREE.MeshStandardMaterial({ map: texStore, roughness: 0.95, side: THREE.DoubleSide });
matStore.userData.sansSurbrillance = true;
const matBarre = new THREE.MeshStandardMaterial({ color: '#3b3c44', roughness: 0.6, metalness: 0.3 });
const RAIL = 0.014;
const zStore = T - 0.03; // le store est entre le battant et la vitre, côté pièce de la vitre
const hCaisson = 0.034;
const yHautStore = yHautV - hCaisson; // le haut de la toile, sous le caisson
const hStore = hV - hCaisson;
const lStore = wV - 2 * RAIL;
// caisson en haut (toujours visible) et rails le long des côtés
bloc(wV, hCaisson, 0.034, alu, xc, yHautV - hCaisson / 2, zStore);
bloc(RAIL, hV - hCaisson, 0.016, alu, xc - wV / 2 + RAIL / 2, yHautV - hCaisson - (hV - hCaisson) / 2, zStore + 0.002);
bloc(RAIL, hV - hCaisson, 0.016, alu, xc + wV / 2 - RAIL / 2, yHautV - hCaisson - (hV - hCaisson) / 2, zStore + 0.002);
const geoStore = new THREE.PlaneGeometry(lStore, hStore);
geoStore.translate(0, -hStore / 2, 0); // le haut de la toile est l'origine : elle s'étire vers le bas
const store = new THREE.Mesh(geoStore, matStore);
store.position.set(xc, yHautStore, zStore);
store.receiveShadow = true;
store.visible = false;
const barreStore = new THREE.Mesh(new THREE.BoxGeometry(lStore, 0.016, 0.014), matBarre);
barreStore.position.set(xc, yHautStore - 0.008, zStore);
veluxObjet.add(store, barreStore);

const etatStore = { ferme: false, f: 0 }; // f : 0 = ouvert (replié dans le caisson), 1 = fermé
function basculerStore() {
  etatStore.ferme = !etatStore.ferme;
}
// la vitre est cachée par le store
function ajusterVitre() {
  veluxMat.emissiveIntensity = (veluxMat.userData.base ?? 0.8) * (1 - 0.95 * etatStore.f);
}
function animerStore(dt) {
  const cible = etatStore.ferme ? 1 : 0;
  if (etatStore.f === cible) return;
  etatStore.f += (cible - etatStore.f) * (1 - Math.exp(-5 * dt));
  if (Math.abs(etatStore.f - cible) < 0.002) etatStore.f = cible;
  const f = etatStore.f;
  store.visible = f > 0.004;
  store.scale.y = Math.max(f, 0.001);
  texStore.repeat.set(1, NB_PLIS * f); // les plis gardent la même taille, seul leur nombre change
  texStore.offset.set(0, -NB_PLIS * f); // et restent alignés sur le haut
  barreStore.position.y = yHautStore - hStore * f - 0.008;
  ajusterVitre();
  appliquerLumiereJour(); // fermer le store coupe la lumière du jour
}

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
// Le plafond disparaît aussi dès que la caméra passe au-dessus : sinon la vue de dessus ne verrait que lui.
const ciel = { visible: 1 };
function facteurPlafond(dt) {
  ciel.visible += ((cam.y > H + 0.05 ? 0 : 1) - ciel.visible) * Math.min(1, dt * 8);
  return ciel.visible;
}
accrocher(['nord', 'est', 'ouest', 'sud'], plafond, { ecraser: false, fondu: FONDU_PERMANENT, large: true, facteur: facteurPlafond });

// --- Décors plaqués sur les murs (affiches, porte) ---
const texturesNommees = {
  couette: textures.couette(),
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
{
  const infoVelux = {
    nom: 'Velux',
    description: velux.description,
    groupe: veluxObjet,
    auClic: () => basculerStore(),
    sansRecentrage: true, // on ferme le store sans bouger la caméra
    actions: [{ label: () => (etatStore.ferme ? 'Ouvrir le store' : 'Fermer le store'), fn: () => basculerStore() }],
  };
  veluxObjet.userData.info = infoVelux;
  cliquables.push(infoVelux);
}
const calendriers = []; // animations des pages qui tournent (calendrier, couvertures), appelées à chaque image
const promessesDecors = [];

// Écran de la TV : une image animée qui ne s'affiche que quand elle est allumée.
const ecranCanvas = document.createElement('canvas');
ecranCanvas.width = 160;
ecranCanvas.height = 90;
const ecranTex = new THREE.CanvasTexture(ecranCanvas);
ecranTex.colorSpace = THREE.SRGBColorSpace;
// Écran du Mac : une capture du site lui-même (public/textures/ecran-mac.jpg), allumée comme un écran.
const matEcranMac = new THREE.MeshStandardMaterial({
  color: '#000000',
  emissive: '#ffffff',
  emissiveMap: textures.image('/textures/ecran-mac.jpg'),
  emissiveIntensity: 0.85,
  roughness: 0.3,
});
matEcranMac.userData.sansSurbrillance = true;
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

// Le clip de la TV (public/videos/clip-tv.mp4) : il n'est téléchargé qu'au premier allumage, il se lit
// avec le son quand on allume la TV (le clic sur le bouton autorise le son) et se met en pause quand on
// l'éteint. En attendant qu'il soit prêt, l'écran garde son image animée de remplacement.
let clipTV = null;
let clipPret = false;
function preparerClip() {
  if (clipTV) return;
  clipTV = document.createElement('video');
  clipTV.src = textures.chemin('/videos/clip-tv.mp4');
  clipTV.loop = true;
  clipTV.playsInline = true;
  clipTV.preload = 'auto';
  clipTV.crossOrigin = 'anonymous';
  clipTV.addEventListener('canplay', () => {
    if (clipPret) return;
    clipPret = true;
    const tex = new THREE.VideoTexture(clipTV);
    tex.colorSpace = THREE.SRGBColorSpace;
    matEcran.emissiveMap = tex;
    matEcran.needsUpdate = true;
  });
}
let tvAllumee = false;
function suivreClip() {
  const voulu = commandes.tv?.manuel === true;
  if (voulu === tvAllumee) return;
  tvAllumee = voulu;
  if (voulu) {
    preparerClip();
    clipTV.muted = false;
    // si le navigateur refuse le son, on lit quand même, sans le son
    clipTV.play().catch(() => {
      clipTV.muted = true;
      clipTV.play().catch(() => {});
    });
  } else {
    clipTV?.pause();
  }
}

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
  let tournerPage = null; // pour un décor à pages : fait tourner la page du dessus
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
          const vantail = gltf.scene.getObjectByName('pivot_vantail');
          if (vantail && g.userData.info) g.userData.info.auClic = creerOuvrant(vantail, 'y', 0, 1.75, { vitesse: 2.8 });
          preparerMurs();
        })
        .catch((err) => console.warn(`Modèle introuvable pour « ${d.nom} » :`, err.message)),
    );
  } else if (d.pages) {
    // décor à pages : la page du dessous est fixe, celle du dessus part et laisse voir la suivante.
    // Calendrier : elle se tourne vers le haut autour de sa charnière et s'aplatit derrière ;
    // couvertures (`sens: 'chute'`) : elle est découpée en petits blocs qui s'écrasent chacun vers leur bord
    // bas, en vague, avec le ressort des murs qui s'abaissent (petit rebond avant de tomber).
    const chute = d.sens === 'chute';
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
    charniere.position.set(0, chute ? 0 : h / 2, e + 0.0015); // le haut de la page (le centre pour une chute)
    const blocs = []; // chute : un bloc de la couverture, avec son propre ressort et son retard
    if (chute) {
      const [COLONNES, LIGNES] = [6, 8];
      const [cw, ch] = [w / COLONNES, h / LIGNES];
      for (let lig = 0; lig < LIGNES; lig++) {
        for (let col = 0; col < COLONNES; col++) {
          const geo = new THREE.PlaneGeometry(cw + 0.0006, ch + 0.0006); // léger recouvrement : pas de fente entre blocs
          const uv = geo.attributes.uv;
          for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / COLONNES, 1 - (lig + 1 - uv.getY(k)) / LIGNES);
          const morceau = new THREE.Mesh(geo, matDessus);
          morceau.position.y = ch / 2;
          morceau.receiveShadow = true;
          const pivot = new THREE.Group(); // au bas du bloc : c'est vers lui qu'il s'écrase
          pivot.position.set(-w / 2 + (col + 0.5) * cw, -h / 2 + (LIGNES - 1 - lig) * ch, 0);
          pivot.add(morceau);
          charniere.add(pivot);
          const alea = Math.abs(Math.sin((lig * COLONNES + col + 1) * 12.9898)) % 1;
          blocs.push({ pivot, r: { h: HAUTEUR_MUR, v: 0, cible: HAUTEUR_MUR }, delai: col * 0.07 + lig * 0.03 + alea * 0.08, parti: false, fini: false });
        }
      }
    } else {
      const devant = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDessus);
      devant.position.set(0, -h / 2, 0);
      devant.castShadow = true;
      devant.receiveShadow = true;
      const dos = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matDos);
      dos.position.set(0, -h / 2, -0.0004);
      dos.rotation.y = Math.PI;
      charniere.add(devant, dos);
    }
    g.add(charniere);

    const cal = { i: 0, t: -1, n: textes.length, tombe: false, horloge: 0 };
    const tourner = () => {
      if (chute) {
        if (cal.tombe) return;
        cal.tombe = true;
        cal.horloge = 0;
        return;
      }
      if (cal.t >= 0) return; // une page est déjà en train de tourner
      cal.t = 0;
    };
    const passerALaSuivante = () => {
      cal.i = (cal.i + 1) % cal.n;
      matDessus.map = textes[cal.i];
      matDessous.map = textes[(cal.i + 1) % cal.n];
      matDessus.needsUpdate = true;
      matDessous.needsUpdate = true;
    };
    calendriers.push((dt) => {
      if (cal.tombe) {
        cal.horloge += Math.min(dt, 1);
        let reste = 0;
        for (const b of blocs) {
          if (b.fini) continue;
          if (!b.parti && cal.horloge >= b.delai) {
            b.parti = true;
            b.r.v += 2.6; // le même petit rebond avant de descendre que les murs
            b.r.cible = HAUTEUR_MIN;
          }
          if (b.parti) {
            ressort(b.r, Math.min(dt, 1) * 0.6); // un peu plus lent que pour un mur : on doit voir chaque bloc tomber
            b.pivot.scale.y = Math.max(b.r.h / HAUTEUR_MUR, 0.001);
            if (b.r.h < 0.1) {
              b.fini = true;
              b.pivot.visible = false;
            }
          }
          reste++;
        }
        if (!reste) {
          // tous les blocs sont tombés : la page suivante prend la place du dessus, une nouvelle apparaît dessous
          passerALaSuivante();
          for (const b of blocs) {
            b.r = { h: HAUTEUR_MUR, v: 0, cible: HAUTEUR_MUR };
            b.parti = b.fini = false;
            b.pivot.scale.y = 1;
            b.pivot.visible = true;
          }
          cal.tombe = false;
        }
        return;
      }
      if (cal.t < 0) return;
      cal.t = Math.min(1, cal.t + dt / 0.85);
      const k = cal.t;
      const lisse = k * k * (3 - 2 * k);
      // dans la dernière partie, la page s'aplatit contre le mur et disparaît
      const aplat = 1 - THREE.MathUtils.smoothstep(k, 0.72, 1);
      charniere.rotation.x = -Math.PI * lisse; // vers l'avant puis par-dessus le haut
      charniere.scale.y = aplat;
      if (cal.t >= 1) {
        passerALaSuivante();
        charniere.rotation.set(0, 0, 0);
        charniere.scale.set(1, 1, 1);
        cal.t = -1;
      }
    });
    tournerPage = tourner;
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
    if (tournerPage) {
      info.auClic = tournerPage;
      info.actions = [{ label: 'Page suivante', fn: tournerPage }];
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
    for (const q of groupe.posters) posters.push({ lot: groupe, mur: groupe.mur, fichier: q.fichier, s: q.s, y: q.y, w: q.taille[0], h: q.taille[1] });
  } else {
    const [w, h] = groupe.cadre;
    groupe.fichiers.forEach((fichier, i) => {
      posters.push({
        lot: groupe,
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

// un clic sur une photo cadre tout son mur de photos : une seule fiche par lot, partagée par ses posters
const infosLots = new Map();
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

  let info = infosLots.get(q.lot);
  if (!info) {
    info = {
      nom: q.lot.nom,
      description: q.lot.description,
      groupe: g,
      groupes: [],
      normale: new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), // côté pièce
    };
    infosLots.set(q.lot, info);
    cliquables.push(info);
  }
  info.groupes.push(g);
  g.userData.info = info;

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
    // light stick : un cône (large en haut, la tête, qui s'affine vers le manche), dont la matière est
    // percée du logo (face) et de « FEARNOT » (côté). Un cœur lumineux dedans se voit par les ajours.
    const { longueur: L, z, angle } = o.baton;
    const RH = 0.0255; // rayon en haut
    const RB = 0.0175; // rayon en bas
    const rayonA = (t) => RB + (RH - RB) * Math.pow(t, 0.9); // t = 0 en bas, 1 en haut
    const pts = [];
    const N = 48;
    pts.push(new THREE.Vector2(0, 0));
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(new THREE.Vector2(rayonA(t) * (i === 0 ? 0.92 : 1), t * L));
    }
    pts.push(new THREE.Vector2(0, L));
    const { couleur, alpha } = textures.lightStickTextures();
    const corps = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 96, -Math.PI, Math.PI * 2),
      new THREE.MeshStandardMaterial({ map: couleur, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide, color: '#ffffff', metalness: 0.4, roughness: 0.38 }),
    );
    corps.castShadow = true;
    corps.receiveShadow = true;
    // cœur lumineux « Fearless Blue » : visible uniquement à travers les ajours
    const cPts = [new THREE.Vector2(0, L * 0.1)];
    for (let i = 4; i <= N - 1; i++) {
      const t = i / N;
      cPts.push(new THREE.Vector2(rayonA(t) - 0.004, t * L));
    }
    cPts.push(new THREE.Vector2(0, L * 0.98));
    const coeur = new THREE.Mesh(new THREE.LatheGeometry(cPts, 40), new THREE.MeshBasicMaterial({ color: '#86b6f2' }));
    const bras = new THREE.Group();
    corps.rotation.y = 0;
    coeur.rotation.y = 0;
    const tourne = new THREE.Group(); // le logo regarde la porte vitrée et un peu vers le haut
    tourne.rotation.y = 0.5;
    tourne.add(corps, coeur);
    bras.add(tourne);
    bras.rotation.z = Math.PI / 2; // couché, tête vers -x ; le côté FEARNOT se retrouve sur le dessus
    bras.position.set(L / 2, RH - 0.001, 0);
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

// --- Magazines empilés à plat sur la commode ---
{
  const n = magazinesCommode.liste.length;
  let hauteur = magazinesCommode.y; // sommet de la pile en construction (on monte du dessous vers le dessus)
  for (let i = n - 1; i >= 0; i--) {
    const mg = magazinesCommode.liste[i];
    const [w, h, d] = mg.taille;
    const papier = new THREE.MeshStandardMaterial({ color: '#f3efe8', roughness: 0.85 });
    const face = new THREE.MeshStandardMaterial({ map: textures.image(mg.fichier), roughness: 0.55 });
    // ordre des faces d'une boîte : +x, -x, +y, -y, +z (avant), -z
    const boite = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [papier, papier, papier, papier, face, papier]);
    boite.castShadow = true;
    boite.receiveShadow = true;
    const couche = new THREE.Group(); // couché : la face (+z) regarde vers le haut, le haut du magazine vers -z
    couche.rotation.x = -Math.PI / 2;
    couche.add(boite);
    const g = new THREE.Group(); // tourné pour que le haut du magazine soit vers le mur (+x)
    g.name = mg.nom;
    g.rotation.y = -Math.PI / 2 + mg.rotation;
    g.position.set(magazinesCommode.centre[0] + mg.dx, hauteur + d / 2, magazinesCommode.centre[1] + mg.dz);
    g.add(couche);
    racine.add(g);
    hauteur += d + 0.0004; // un tout petit jeu pour éviter le scintillement entre deux couvertures
    const info = { nom: mg.nom, description: mg.description, groupe: g, aPlat: true };
    g.userData.info = info;
    cliquables.push(info);
  }
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

// --- Ouvrants : capot du Mac, porte de la vitrine, porte de la chambre ---
// Chaque ouvrant est un sous-groupe « pivot_… » du modèle 3D, dont l'origine est la charnière : on
// l'anime en tournant sur un axe entre une position fermée et une position ouverte.
const ouvrants = [];
function creerOuvrant(pivot, axe, ferme, ouvert, { ouvertAuDepart = false, vitesse = 4 } = {}) {
  const o = { pivot, axe, ferme, ouvert, vitesse, f: ouvertAuDepart ? 1 : 0, cible: ouvertAuDepart ? 1 : 0 };
  pivot.rotation[axe] = ouvertAuDepart ? ouvert : ferme;
  ouvrants.push(o);
  return () => {
    o.cible = o.cible ? 0 : 1;
  };
}
function animerOuvrants(dt) {
  for (const o of ouvrants) {
    if (o.f === o.cible) continue;
    o.f += (o.cible - o.f) * (1 - Math.exp(-o.vitesse * dt));
    if (Math.abs(o.f - o.cible) < 0.002) o.f = o.cible;
    o.pivot.rotation[o.axe] = THREE.MathUtils.lerp(o.ferme, o.ouvert, o.f);
  }
}
// un objet cliquable à lui seul à l'intérieur d'un meuble (le Mac, la porte de la vitrine)
function ouvrantCliquable(nom, description, partie, groupe, basculer) {
  const info = { nom, description, groupe, auClic: basculer };
  partie.userData.info = info;
  cliquables.push(info);
}

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
            // le Mac du bureau : une capture du site dans une fenêtre de navigateur
            if (o.name === 'ecran-mac') o.material = matEcranMac;
          });
          remplacerParModele(groupe, gltf.scene, m);
          if (m.nom === 'bureau') {
            // le MacBook : le capot s'ouvre à 112° (comme sur la photo) ou se referme sur le clavier
            const capot = groupe.getObjectByName('pivot_capot');
            const mac = groupe.getObjectByName('objet_mac');
            if (capot && mac) {
              const bascule = creerOuvrant(capot, 'x', 0.034, -1.95, { ouvertAuDepart: true });
              ouvrantCliquable('MacBook', 'Le MacBook Air du bureau. Clique pour fermer ou rouvrir son capot.', mac, mac, bascule);
            }
          }
          if (m.nom === 'vitrine') {
            const porte = groupe.getObjectByName('pivot_porte');
            if (porte) {
              const bascule = creerOuvrant(porte, 'y', 0, -1.9, { vitesse: 3.2 });
              ouvrantCliquable('porte de la vitrine', 'La porte vitrée de la vitrine.', porte, groupe, bascule);
            }
          }
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
// « Paris » en haut ; l'heure et le curseur se déplient au survol (au toucher : un appui sur l'heure)
document.getElementById('ville-nom').textContent = lieu.nom;
const elVille = document.getElementById('ville');
document.getElementById('ville-tete').addEventListener('click', () => elVille.classList.toggle('ouvert'));
addEventListener('pointerdown', (e) => {
  if (!elVille.contains(e.target)) elVille.classList.remove('ouvert');
});
// une fois le curseur lâché on le relâche aussi, sinon le panneau resterait ouvert tant qu'on ne clique pas ailleurs
elCurseur.addEventListener('pointerup', () => elCurseur.blur());
let manuel = false;

// Lumière du jour qui entre par le Velux : la partie « jour » de l'éclairage (soleil, ambiante, dôme
// céleste) baisse quand le store se ferme. Fermé en plein jour, il ne reste que 35 % de la lumière.
const baseLumiere = { f: 0, soleil: 0, ambiante: 0, hemi: 0 };
function appliquerLumiereJour() {
  // le store ne coupe que la vraie lumière du jour : rien à la nuit ni à la tombée, puis de plus en plus
  const jour = clamp01((baseLumiere.f - 0.3) / 0.7);
  const k = 1 - 0.65 * etatStore.f * jour * jour * (3 - 2 * jour);
  soleil.intensity = baseLumiere.soleil * k;
  ambiante.intensity = baseLumiere.ambiante * k;
  hemi.intensity = baseLumiere.hemi * k;
}

// Lever et coucher du soleil RÉELS du jour, pour le lieu choisi dans chambre.js : on les recalcule quand
// la date change (si la page reste ouverte après minuit).
const elSoleil = document.getElementById('soleil-heures');
let soleilReel = { jour: '', lever: 6, coucher: 19 };
function majSoleilReel() {
  const maintenant = new Date();
  const jour = maintenant.toDateString();
  if (jour === soleilReel.jour) return;
  const { lever, coucher } = heuresSoleil(maintenant, lieu.lat, lieu.lon);
  soleilReel = { jour, lever, coucher };
  elSoleil.textContent = `☀ lever ${formatHeure(lever)} · coucher ${formatHeure(coucher)}`;
}

function appliquerHeure(heure) {
  majSoleilReel();
  const { lever: LEVER, coucher: COUCHER } = soleilReel;
  const RAMPE = 0.9; // le jour se lève et se couche en 54 minutes autour de ces heures
  // le soleil monte de 8° à 60° entre le lever et le coucher réels, puis redescend
  const h = ((heure % 24) + 24) % 24;
  const u = clamp01((h - LEVER) / (COUCHER - LEVER || 1));
  const d = h > LEVER && h < COUCHER ? Math.sin(u * Math.PI) : 0; // 0 aux extrémités, 1 à la mi-journée
  // facteur de jour : 0 la nuit, 1 en plein jour, avec une transition d'environ une heure au lever et au coucher
  const f = clamp01(h <= LEVER - RAMPE || h >= COUCHER + RAMPE ? 0 : h >= LEVER && h <= COUCHER ? 1 : h < LEVER ? (h - (LEVER - RAMPE)) / RAMPE : (COUCHER + RAMPE - h) / RAMPE);

  // le soleil se lève à l'est (+x), passe au sud (+z), se couche à l'ouest
  const elevation = 0.14 + d * (1.05 - 0.14);
  const azimut = Math.PI * u;
  const R = 22;
  const jourX = Math.cos(azimut) * Math.cos(elevation) * R;
  const jourY = Math.sin(elevation) * R;
  const jourZ = Math.sin(azimut) * Math.cos(elevation) * R;
  soleil.position.set(8.8 + (jourX - 8.8) * f, 19.8 + (jourY - 19.8) * f, 6.6 + (jourZ - 6.6) * f);
  baseLumiere.f = f;
  baseLumiere.soleil = f * (0.7 + 0.8 * d); // la nuit, plus de soleil : donc plus aucune ombre portée par le jour
  tmp.copy(SOLEIL_BAS).lerp(SOLEIL_MIDI, d);
  soleil.color.copy(SOLEIL_NUIT).lerp(tmp, f);

  // la nuit, le remplissage ambiant prend la place du soleil pour que la pièce reste lisible, mais sans ombre
  baseLumiere.ambiante = (0.65 * (1 - f) + f * (0.45 + 0.2 * d)) * (0.55 + 0.45 * f) + 0.3 * (1 - f);
  tmp2.copy(AMBIANT_BAS).lerp(AMBIANT_MIDI, d);
  ambiante.color.copy(AMBIANT_NUIT).lerp(tmp2, f);
  // la nuit, le dôme céleste baisse pour que les lampes se voient, sans jamais noircir la scène
  baseLumiere.hemi = 0.8 * (0.5 + 0.5 * f);
  hemi.color.copy(HEMI_CIEL_NUIT).lerp(HEMI_CIEL_JOUR, f);

  veluxMat.userData.base = 0.15 + 0.85 * f;
  ajusterVitre();
  appliquerLumiereJour(); // les intensités de l'heure, réduites si le store est fermé en plein jour
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
  reglages,
  limitePolaire: LIMITE_POLAIRE,
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
  animerMobile(dt);
  animerStore(dt);
  animerOuvrants(dt);
  // l'image de la TV change environ 8 fois par seconde, seulement si elle est allumée
  const maintenant = performance.now() / 1000;
  suivreClip();
  if (!clipPret && commandes.tv?.niveau > 0.02 && maintenant - dernierEcran > 0.12) {
    dernierEcran = maintenant;
    dessinerEcran(maintenant);
  }
  controls.update();
  // la cible reste dans la pièce : si un déplacement latéral la fait sortir, on ramène la caméra du même décalage
  const dedans = controls.target.clone().clamp(LIMITE_CIBLE.min, LIMITE_CIBLE.max);
  if (!dedans.equals(controls.target)) {
    camera.position.add(dedans.clone().sub(controls.target));
    controls.target.copy(dedans);
  }
  renderer.render(scene, camera);
});

Promise.allSettled([...promesses, ...promessesDecors]).then(() => {
  document.getElementById('chargement').classList.add('fini');
});







