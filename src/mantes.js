import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { palette, mantes, meublesMantes, decorsMantes, lumieresMantes, interrupteursMantes, vuesMantes } from './chambre.js';
import { miniature } from './mode.js';
import { initialiserInteractions } from './interactions.js';
import { heuresSoleil, formatHeure } from './soleil.js';
import * as textures from './textures.js';
import { sons, creerBoutonSon } from './sons.js';
import { modelesMantes } from './modeles/mantes.js';
import { creerMateriaux, boite, cylindre, sphere, tube } from './modeles/outils.js';

// La chambre de Mantes-la-Jolie : une pièce rectangulaire à plafond plat, la fenêtre au nord. C'est la même
// technique que src/main.js (murs en tuiles qui s'abaissent, éclairage pastel, cycle jour / nuit, clic sur les
// objets), sans la pente du toit, le Velux ni la charpente : tout ce qui est propre à cette pièce est dans
// `mantes` et les listes `…Mantes` de chambre.js, et ses meubles dans src/modeles/mantes.js.

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, miniature ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// Écran de chargement (voir main.js)
const elNiveau = document.getElementById('chargement-niveau');
const elAvancement = document.getElementById('chargement-texte');
let avancement = 0;
function afficherAvancement(f) {
  avancement = Math.max(avancement, f);
  elNiveau.style.transform = `scaleX(${avancement})`;
  elAvancement.textContent = `${Math.round(avancement * 100)} %`;
}
THREE.DefaultLoadingManager.onProgress = (url, charges, total) => afficherAvancement(Math.min(charges / total, 0.95));

const scene = new THREE.Scene();
const { largeur: W, profondeur: D, hauteur: H, lieu } = mantes;
const couleurs = { ...palette, ...mantes.palette };
const DEMI_X = W / 2;
const DEMI_Z = D / 2;
const PI2 = Math.PI / 2;

// Le centre de la pièce est à l'origine pour que la caméra tourne autour.
const racine = new THREE.Group();
racine.position.set(-W / 2, 0, -D / 2);
scene.add(racine);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(-4.2, 7.7, -6.0); // depuis le nord-ouest : la fenêtre, le bureau et le lit
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.9, 0);
const LIMITE_POLAIRE = Math.PI / 2.2;
controls.enablePan = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 16;
controls.minPolarAngle = 0;
controls.maxPolarAngle = LIMITE_POLAIRE;
const LIMITE_CIBLE = { min: new THREE.Vector3(-DEMI_X - 0.8, 0, -DEMI_Z - 0.75), max: new THREE.Vector3(DEMI_X + 0.8, 2.4, DEMI_Z + 0.75) };
const reglages = { murs: 'auto' };
if (miniature) {
  controls.target.y = 0;
  camera.position.y -= 0.9;
  camera.position.sub(controls.target).multiplyScalar(1.18).add(controls.target);
  controls.enabled = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;
}
controls.update();

const mat = (couleur, extra = {}) => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, metalness: 0, ...extra });
const interieur = (extra) => new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.BackSide, ...extra });
const m = creerMateriaux();

// --- Sol et socle ---
const contour = [[0, 0], [W, 0], [W, D], [0, D]];
const versPlan = (pts) => pts.map(([x, z]) => new THREE.Vector2(x, -z)); // dessiné en (x, -z), puis couché
const sol = new THREE.Mesh(
  new THREE.ShapeGeometry(new THREE.Shape(versPlan(contour))),
  new THREE.MeshStandardMaterial({ map: textures.sol(couleurs.sol, couleurs.solLigne), roughness: 0.9 }),
);
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
racine.add(sol);

const SOCLE_EPAISSEUR = 0.6;
const SOCLE_DEBORD = 0.5;
const socle = new THREE.Mesh(
  new THREE.ExtrudeGeometry(
    new THREE.Shape(versPlan([[-SOCLE_DEBORD, -SOCLE_DEBORD], [W + SOCLE_DEBORD, -SOCLE_DEBORD], [W + SOCLE_DEBORD, D + SOCLE_DEBORD], [-SOCLE_DEBORD, D + SOCLE_DEBORD]])),
    { depth: SOCLE_EPAISSEUR, bevelEnabled: false },
  ),
  new THREE.MeshStandardMaterial({ color: palette.socle, roughness: 0.95 }),
);
socle.rotation.x = -Math.PI / 2;
socle.position.y = -SOCLE_EPAISSEUR - 0.004;
socle.receiveShadow = true;
socle.castShadow = true;
racine.add(socle);

// --- Murs qui s'abaissent (même système que main.js : tuiles en ressort, vague, décors écrasés avec le mur) ---
const HAUTEUR_MUR = H;
const HAUTEUR_BORDURE = 0.2;
const LONGUEUR_TUILE = 0.34;
const RETARD_PAR_METRE = 0.14;
const SEUIL_CAMERA = 0.08;
const EPAISSEUR_MUR = 0.1;
const HAUTEUR_MIN = 0.04;

const papierUni = new THREE.MeshStandardMaterial({ color: couleurs.mur, roughness: 0.9 });
const papierAlt = new THREE.MeshStandardMaterial({ color: couleurs.murAlt, roughness: 0.9 });
const tranche = new THREE.MeshStandardMaterial({ color: couleurs.murBord, roughness: 0.9 });
const murs = {};

// `pos` = [x, z] du pied du mur (u = 0), `angle` = angle autour de y de la direction qui sort de la pièce.
function creerMur(nom, { pos, angle, longueur }) {
  const groupe = new THREE.Group();
  groupe.position.set(pos[0], 0, pos[1]);
  groupe.rotation.y = angle;
  racine.add(groupe);
  const nb = Math.max(1, Math.round(longueur / LONGUEUR_TUILE));
  const tuiles = [];
  for (let i = 0; i < nb; i++) {
    const ua = (longueur * i) / nb;
    const ub = (longueur * (i + 1)) / nb;
    const forme = new THREE.Shape([[ua, 0], [ub, 0], [ub, H], [ua, H]].map(([u, v]) => new THREE.Vector2(u, v)));
    const geo = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR_MUR, bevelEnabled: false });
    // les bouts sont biseautés pour que deux murs voisins se rejoignent sans trou (angle de 90°)
    const gp = geo.attributes.position;
    for (let k = 0; k < gp.count; k++) {
      if (gp.getZ(k) < EPAISSEUR_MUR / 2) continue;
      if (i === 0 && Math.abs(gp.getX(k) - ua) < 1e-5) gp.setX(k, ua - EPAISSEUR_MUR);
      if (i === nb - 1 && Math.abs(gp.getX(k) - ub) < 1e-5) gp.setX(k, ub + EPAISSEUR_MUR);
    }
    gp.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, [i % 2 ? papierAlt : papierUni, tranche]);
    mesh.receiveShadow = true;
    mesh.castShadow = nom !== 'nord'; // la lumière du jour entre par la fenêtre, au nord : ce mur ne fait pas d'ombre
    groupe.add(mesh);
    const tuile = { mesh, u: (ua + ub) / 2, h: HAUTEUR_MUR, v: 0, cible: HAUTEUR_MUR };
    mesh.userData.tuile = tuile;
    tuiles.push(tuile);
  }
  const axe = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const normale = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
  const pied = new THREE.Vector3(pos[0], 0, pos[1]);
  murs[nom] = {
    tuiles,
    u0: 0,
    u1: longueur,
    axe,
    normale,
    pied,
    centre: pied.clone().addScaledVector(axe, longueur / 2),
    debut: pied.clone(),
    fin: pied.clone().addScaledVector(axe, longueur),
    cible: HAUTEUR_MUR,
    changement: -999,
    depuisDebut: true,
    init: false,
  };
}
creerMur('ouest', { pos: [0, 0], angle: -Math.PI / 2, longueur: D }); // u = z
creerMur('est', { pos: [W, D], angle: Math.PI / 2, longueur: D }); // u = D - z
creerMur('nord', { pos: [W, 0], angle: Math.PI, longueur: W }); // u = W - x
creerMur('sud', { pos: [0, D], angle: 0, longueur: W }); // u = x

// Tout ce qui est accroché à un ou plusieurs murs suit leur hauteur : écrasé, puis effacé quand ils sont abaissés.
const accroches = [];
const cliquables = [];
function accrocher(noms, objet, { ecraser = true, fondu = [HAUTEUR_BORDURE, HAUTEUR_BORDURE + 0.65], large = false, facteur = null } = {}) {
  const enveloppe = new THREE.Group();
  racine.add(enveloppe);
  enveloppe.add(objet);
  const supports = [].concat(noms).map((nom) => {
    const mur = murs[nom];
    const u = large ? null : (objet.position.x - mur.pied.x) * mur.axe.x + (objet.position.z - mur.pied.z) * mur.axe.z;
    return { mur, u };
  });
  accroches.push({ enveloppe, supports, ecraser, fondu, facteur, materiaux: [] });
}
function hauteurSupport({ mur, u }) {
  if (u === null) return mur.tuiles.reduce((somme, t) => somme + t.h, 0) / mur.tuiles.length;
  let proche = mur.tuiles[0];
  for (const t of mur.tuiles) if (Math.abs(t.u - u) < Math.abs(proche.u - u)) proche = t;
  return proche.h;
}
function preparerMurs() {
  for (const accroche of accroches) {
    accroche.vus ??= new Set();
    accroche.enveloppe.traverse((o) => {
      if (!o.isMesh || accroche.vus.has(o.material)) return;
      accroche.vus.add(o.material);
      o.material.transparent = true;
      accroche.materiaux.push({ materiau: o.material, opacite: o.material.opacity });
    });
  }
}
// Ressort amorti de la hauteur d'une tuile, avec un rebond si elle touche le bas.
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
    // la caméra est-elle du côté extérieur du mur ?
    const dx = cam.x - mur.centre.x;
    const dz = cam.z - mur.centre.z;
    const d = (mur.normale.x * dx + mur.normale.z * dz) / (Math.hypot(dx, dz) || 1);
    let cible = mur.souhait ?? mur.cible;
    if (d > SEUIL_CAMERA) cible = HAUTEUR_BORDURE;
    else if (d < -SEUIL_CAMERA) cible = HAUTEUR_MUR;
    if (reglages.murs === 'up') cible = HAUTEUR_MUR;
    else if (reglages.murs === 'down') cible = HAUTEUR_BORDURE;
    mur.souhait = cible;
    if (!mur.init) {
      mur.init = true;
      mur.cible = cible;
      for (const t of mur.tuiles) t.h = t.cible = cible;
    } else if (cible !== mur.cible) {
      mur.cible = cible;
      mur.changement = temps;
      mur.depuisDebut = cam.distanceToSquared(mur.debut) <= cam.distanceToSquared(mur.fin);
      sons.mur(cible === HAUTEUR_BORDURE);
    }
    for (const t of mur.tuiles) {
      const distance = mur.depuisDebut ? t.u - mur.u0 : mur.u1 - t.u;
      if (temps >= mur.changement + distance * RETARD_PAR_METRE && t.cible !== mur.cible) {
        t.v += mur.cible < t.h ? 2.6 : 1.4;
        t.cible = mur.cible;
      }
      ressort(t, Math.min(dt, 1));
      t.mesh.scale.y = t.h / HAUTEUR_MUR;
    }
  }
  for (const a of accroches) {
    const h = Math.min(...a.supports.map(hauteurSupport));
    if (a.ecraser) a.enveloppe.scale.y = Math.max(h / HAUTEUR_MUR, 0.001);
    const [bas, haut] = a.fondu;
    const fondu = THREE.MathUtils.clamp((h - bas) / (haut - bas), 0, 1) * (a.facteur ? a.facteur(dt) : 1);
    for (const { materiau, opacite } of a.materiaux) materiau.opacity = opacite * fondu;
    a.enveloppe.visible = fondu > 0.001;
  }
}

// Plafond plat, effacé avec les murs et dès que la caméra passe au-dessus.
const plafond = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(versPlan(contour))), interieur({ color: couleurs.plafond }));
plafond.rotation.x = -Math.PI / 2;
plafond.position.y = H;
plafond.receiveShadow = true;
racine.add(plafond);
const ciel = { visible: 1 };
accrocher(['nord', 'est', 'ouest', 'sud'], plafond, {
  ecraser: false,
  fondu: [HAUTEUR_MUR * 0.55, HAUTEUR_MUR * 0.9],
  large: true,
  facteur: (dt) => (ciel.visible += ((cam.y > H + 0.05 ? 0 : 1) - ciel.visible) * Math.min(1, dt * 8)),
});

// Où poser un décor contre chaque mur : `s` le long du mur, `y` la hauteur, regarde vers l'intérieur.
const poseMur = {
  ouest: (s, y) => ({ p: [0.004, y, s], r: Math.PI / 2 }),
  nord: (s, y) => ({ p: [s, y, 0.004], r: 0 }),
  est: (s, y) => ({ p: [W - 0.004, y, s], r: -Math.PI / 2 }),
  sud: (s, y) => ({ p: [s, y, D - 0.004], r: Math.PI }),
};
const rotationContre = { est: 0, ouest: Math.PI, nord: Math.PI / 2, sud: -Math.PI / 2 }; // le dos des meubles est à +x

const promesses = [];
const ouvrants = []; // le capot du Mac (la porte a son propre réglage, plus bas)
const matVue = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.image('/photos/mantes/vue.jpg'), emissiveIntensity: 0.9, roughness: 0.2 });
matVue.userData.sansSurbrillance = true;

// --- La fenêtre : deux vantaux gris anthracite sur la vue de tes photos, rebord blanc, coffre de volet roulant ---
{
  const { x: fx, largeur: fl, bas, haut } = mantes.fenetre;
  const fh = haut - bas;
  const gris = m.uni('#8e949b');
  const g = new THREE.Group();
  g.position.set(0, 0, 0.004);
  const plat = (l, h, p, mate, x, y, z) => {
    const b = boite([l, h, p], mate, [x, y, z], { r: 0.004 });
    b.userData.sansSurbrillance = false;
    return b;
  };
  const ep = 0.05;
  // embrasure blanche tout autour, puis vantaux gris
  g.add(plat(fl + 0.1, 0.05, 0.07, m.blanc, fx + fl / 2, bas - 0.05, 0));
  g.add(plat(ep, fh, 0.07, m.blanc, fx - ep / 2, bas, 0), plat(ep, fh, 0.07, m.blanc, fx + fl + ep / 2, bas, 0));
  g.add(plat(fl + 2 * ep, ep, 0.07, m.blanc, fx + fl / 2, haut, 0));
  const paneL = (fl - 0.06) / 2;
  for (const i of [0, 1]) {
    const x0 = fx + i * (paneL + 0.06);
    const cadreX = x0 + paneL / 2;
    // cadre du vantail : quatre profilés
    g.add(plat(paneL, 0.05, 0.05, gris, cadreX, bas, 0.01), plat(paneL, 0.05, 0.05, gris, cadreX, haut - 0.05, 0.01));
    g.add(plat(0.05, fh, 0.05, gris, x0, bas, 0.01), plat(0.05, fh, 0.05, gris, x0 + paneL - 0.05, bas, 0.01));
    const verre = new THREE.Mesh(new THREE.PlaneGeometry(paneL - 0.08, fh - 0.1), matVue);
    verre.position.set(cadreX, bas + fh / 2, 0.012);
    verre.rotation.y = 0; // vers l'intérieur de la pièce (+z)
    g.add(verre);
  }
  // le montant central et la poignée
  g.add(plat(0.06, fh, 0.06, gris, fx + fl / 2, bas, 0.012));
  g.add(boite([0.02, 0.12, 0.03], m.metalClair, [fx + fl / 2 + 0.05, bas + fh / 2 - 0.1, 0.06], { r: 0.006 }));
  // rebord intérieur
  g.add(boite([fl + 0.16, 0.03, 0.14], m.blanc, [fx + fl / 2, bas - 0.03, 0.12], { r: 0.006 }));
  // coffre du volet roulant, avec sa réglette lumineuse
  g.add(boite([fl + 0.35, 0.34, 0.17], m.blanc, [fx + fl / 2 - 0.05, haut + 0.02, 0.0], { r: 0.008 }));
  const reglette = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#fff1cc', emissiveIntensity: 1.3 }));
  reglette.position.set(fx + 0.6, haut + 0.14, 0.18);
  g.add(reglette);
  accrocher('nord', g);
  const info = { nom: 'fenêtre', description: 'Fenêtre à deux vantaux gris anthracite, avec son coffre de volet roulant et la réglette lumineuse. Elle donne sur un jardin, des haies et l’immeuble d’en face : la vue de ta photo. Elle est au nord.', groupe: g, normale: new THREE.Vector3(0, 0, 1) };
  g.userData.info = info;
  cliquables.push(info);
}

// --- La porte, dans le mur sud côté ouest : charnières à l'ouest, elle s'ouvre vers l'intérieur, le long du mur ---
const porteCtl = { f: 0, cible: 0, pivot: null };
{
  const { x: px, largeur: pl, hauteur: ph } = mantes.porte;
  const groupe = new THREE.Group();
  groupe.name = 'porte';
  // ce qu'on voit derrière quand elle est ouverte : le couloir, éclairé
  const couloir = new THREE.Mesh(
    new THREE.PlaneGeometry(pl, ph),
    new THREE.MeshStandardMaterial({
      map: textures.creer(64, 128, (g, w, h) => {
        const d = g.createLinearGradient(0, 0, 0, h);
        d.addColorStop(0, '#efe8df');
        d.addColorStop(0.1, '#e3cdb4');
        d.addColorStop(0.85, '#d2ad88');
        d.addColorStop(0.86, '#9b7650');
        d.addColorStop(1, '#8a6742');
        g.fillStyle = d;
        g.fillRect(0, 0, w, h);
      }, false),
      emissive: '#ffffff',
      emissiveIntensity: 0.25,
      roughness: 1,
    }),
  );
  couloir.position.set(px + pl / 2, ph / 2, D - 0.006);
  couloir.rotation.y = Math.PI;
  groupe.add(couloir);
  // chambranle blanc
  const chambranle = (l, h, x, y) => boite([l, h, 0.035], m.blanc, [x, y, D - 0.03], { r: 0.004 });
  groupe.add(chambranle(0.06, ph + 0.06, px - 0.03, 0), chambranle(0.06, ph + 0.06, px + pl + 0.03, 0), chambranle(pl + 0.12, 0.06, px + pl / 2, ph));
  groupe.add(boite([pl, 0.012, 0.06], m.metalFonce, [px + pl / 2, 0, D - 0.03], { r: 0.003 })); // seuil
  // le vantail pivote autour de la charnière (x = px)
  const pivot = new THREE.Group();
  pivot.position.set(px, 0, D - 0.045);
  const vantail = boite([pl, ph - 0.01, 0.04], m.blanc, [pl / 2, 0, 0], { r: 0.006 });
  // poignée en laiton des deux côtés : longue plaque, béquille coudée, entrée de clé
  const laiton = m.laiton;
  const poignee = (cote) => {
    const z = cote * 0.02;
    return [
      boite([0.045, 0.22, 0.008], laiton, [pl - 0.07, 0.86, z + cote * 0.004], { r: 0.004 }),
      cylindre(0.024, 0.02, laiton, [pl - 0.07, 1.02, z + cote * 0.014], { rot: [PI2, 0, 0], centre: true, segments: 14 }),
      boite([0.13, 0.02, 0.022], laiton, [pl - 0.125, 1.02, z + cote * 0.03], { r: 0.009 }),
      boite([0.006, 0.022, 0.003], m.uni('#2b2620'), [pl - 0.07, 0.9, z + cote * 0.0085], { r: 0.001 }),
      cylindre(0.012, 0.003, m.uni('#2b2620'), [pl - 0.07, 0.915, z + cote * 0.0085], { rot: [PI2, 0, 0], centre: true, segments: 10 }),
    ];
  };
  pivot.add(vantail, ...poignee(1), ...poignee(-1));
  // trois paumelles : nœud cylindrique et lames
  for (const y of [0.22, 1.0, 1.82]) {
    pivot.add(cylindre(0.018, 0.11, m.metalFonce, [-0.006, y - 0.055, -0.02]), sphere(0.018, m.metalFonce, [-0.006, y + 0.057, -0.02]));
    pivot.add(boite([0.03, 0.09, 0.004], m.metalFonce, [0.012, y - 0.045, -0.021], { r: 0.001 }));
  }
  groupe.add(pivot);
  porteCtl.pivot = pivot;
  racine.add(groupe);
  const basculer = () => {
    porteCtl.cible = porteCtl.cible ? 0 : 1;
    sons.ouvrant('porte', porteCtl.cible === 1);
  };
  const info = { nom: 'porte', description: 'La porte blanche vers le couloir, dans le coin sud-ouest. Clique pour l’ouvrir : elle se range le long du mur, derrière le pouf.', groupe, auClic: basculer, normale: new THREE.Vector3(0, 0, -1) };
  groupe.userData.info = info;
  cliquables.push(info);
  accrocher('sud', groupe);
}
function animerPorte(dt) {
  if (porteCtl.f === porteCtl.cible) return;
  porteCtl.f += (porteCtl.cible - porteCtl.f) * (1 - Math.exp(-3 * dt));
  if (Math.abs(porteCtl.f - porteCtl.cible) < 0.002) porteCtl.f = porteCtl.cible;
  porteCtl.pivot.rotation.y = THREE.MathUtils.lerp(0, 1.75, porteCtl.f);
}

// --- La penderie à portes coulissantes, dans le mur sud côté est : l'image est recadrée de ta photo ---
{
  const { x: px, largeur: pl, hauteur: ph } = mantes.penderie;
  const g = new THREE.Group();
  g.name = 'penderie';
  const BAS = 0.41; // la photo ne montre pas le bas des portes (le Kallax le cache)
  const hautPhoto = ph - BAS;
  // la photo de ta penderie, sans l'affiche collée en haut à gauche : sa zone est repeinte d'un dégradé pris
  // de part et d'autre (le blanc de la porte, avec son ombre)
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const photo = new Image();
  photo.onload = () => {
    const c = document.createElement('canvas');
    const [w, h] = [(c.width = photo.width), (c.height = photo.height)];
    const g = c.getContext('2d');
    g.drawImage(photo, 0, 0);
    const [x0, y0, x1, y1] = [0.12 * w, 0.16 * h, 0.43 * w, 0.305 * h]; // l'affiche, en fraction de l'image
    const teinte = (x, y) => `rgb(${g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3).join(',')})`;
    for (let y = y0; y < y1; y += 4) {
      const d = g.createLinearGradient(x0, 0, x1, 0);
      d.addColorStop(0, teinte(x0 - 0.03 * w, y));
      d.addColorStop(1, teinte(x1 + 0.03 * w, y));
      g.fillStyle = d;
      g.fillRect(x0, y, x1 - x0, 4);
    }
    tex.image = c;
    tex.needsUpdate = true;
  };
  photo.src = textures.chemin('/photos/mantes/penderie.jpg');
  const haut = new THREE.Mesh(new THREE.PlaneGeometry(pl, hautPhoto), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.4 })); // la photo est prise dans l'ombre : on l'éclaircit
  haut.position.set(px + pl / 2, BAS + hautPhoto / 2, D - 0.012);
  haut.rotation.y = Math.PI;
  haut.receiveShadow = true;
  const bas = new THREE.Mesh(new THREE.PlaneGeometry(pl, BAS), new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.8 }));
  bas.position.set(px + pl / 2, BAS / 2, D - 0.012);
  bas.rotation.y = Math.PI;
  bas.receiveShadow = true;
  const cadre = (l, h, x, y) => boite([l, h, 0.03], m.metalClair, [x, y, D - 0.025], { r: 0.003 });
  g.add(haut, bas, cadre(pl + 0.04, 0.03, px + pl / 2, ph), cadre(pl + 0.04, 0.03, px + pl / 2, 0), cadre(0.025, ph, px, 0), cadre(0.025, ph, px + pl, 0), cadre(0.02, ph, px + pl / 2, 0));
  accrocher('sud', g);
  const info = { nom: 'penderie', description: 'La penderie à deux portes coulissantes blanches, couverte de stickers Supreme, Stussy et Carhartt.', groupe: g, normale: new THREE.Vector3(0, 0, -1) };
  g.userData.info = info;
  cliquables.push(info);
}

// --- Affiches et toiles : des images de tes photos, sur un petit cadre blanc ---
const papierCadre = new THREE.MeshStandardMaterial({ color: '#fbfaf8', roughness: 0.9 });
for (const d of decorsMantes) {
  const g = new THREE.Group();
  const { p, r } = poseMur[d.mur](d.s, d.y);
  g.position.set(...p);
  g.rotation.y = r;
  g.name = d.nom;
  const [w, h] = d.taille;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, h + 0.012, 0.012), papierCadre);
  chassis.position.z = 0.006;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textures.image(`/photos/mantes/${d.image}.jpg`), roughness: 0.8 }));
  image.position.z = 0.0125;
  image.receiveShadow = true;
  g.add(chassis, image);
  accrocher(d.mur, g);
  const info = { nom: d.nom, description: d.description, groupe: g, normale: new THREE.Vector3(Math.sin(r), 0, Math.cos(r)) };
  g.userData.info = info;
  cliquables.push(info);
}

// --- La TV (au mur ouest, au-dessus du bureau) : allumée, elle affiche l'écran de ta photo (un lecteur de musique) ---
const matEcran = new THREE.MeshStandardMaterial({ color: '#050507', emissive: '#ffffff', emissiveMap: textures.image('/photos/mantes/ecran-tv.jpg'), emissiveIntensity: 0, roughness: 0.25 });
matEcran.userData.sansSurbrillance = true;
{
  const g = new THREE.Group();
  g.name = 'télé';
  const { p, r } = poseMur.ouest(1.15, 1.55);
  g.position.set(...p);
  g.rotation.y = r;
  const noir = new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.5 });
  // support mural, dos bombé, dalle et son cadre fin ; logo et voyant sous l'écran
  g.add(boite([0.3, 0.2, 0.03], m.uni('#24242a'), [0, -0.1, 0], { r: 0.004 }));
  g.add(boite([0.6, 0.34, 0.03], noir, [0, -0.17, 0.025], { r: 0.012 }));
  g.add(boite([0.97, 0.565, 0.022], noir, [0, -0.2825, 0.045], { r: 0.006 }));
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.535), matEcran);
  ecran.position.z = 0.0565;
  ecran.position.y = 0.006;
  g.add(ecran);
  g.add(boite([0.05, 0.008, 0.002], m.metalClair, [0, -0.276, 0.0565], { r: 0.001 }));
  g.add(sphere(0.006, m.uni('#ff5a4e'), [0.4, -0.274, 0.056]));
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  accrocher('ouest', g);
  // les deux câbles qui pendent jusqu'au bureau
  const cables = new THREE.Group();
  cables.add(tube([[0.03, 1.27, 1.05], [0.025, 1.05, 1.0], [0.03, 0.82, 0.92], [0.06, 0.75, 0.88]], 0.005, m.uni('#16161a'), 18));
  cables.add(tube([[0.03, 1.27, 1.3], [0.022, 1.0, 1.36], [0.03, 0.82, 1.4], [0.07, 0.75, 1.42]], 0.004, m.uni('#16161a'), 18));
  accrocher('ouest', cables);
  const info = { nom: 'télé', description: 'La télé murale au-dessus du bureau, avec ses deux câbles qui pendent. Clique pour l’allumer : elle affiche le lecteur de musique de ta photo.', interrupteur: 'tv', groupe: g, normale: new THREE.Vector3(1, 0, 0) };
  g.userData.info = info;
  cliquables.push(info);
}

// Les écrans des meubles : celui du PC (l'image de ta photo) et celui du Mac (une capture du site).
const matEcranPC = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.image('/photos/mantes/ecran-pc.jpg'), emissiveIntensity: 0.85, roughness: 0.3 });
const matEcranMac = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.image('/textures/ecran-mac.jpg'), emissiveIntensity: 0.85, roughness: 0.3 });
matEcranPC.userData.sansSurbrillance = matEcranMac.userData.sansSurbrillance = true;

// --- Les meubles ---
for (const def of meublesMantes) {
  const g = new THREE.Group();
  g.name = def.nom;
  g.position.set(def.pos[0], 0, def.pos[1]);
  g.rotation.y = (def.contre ? rotationContre[def.contre] : 0) + (def.rotation ?? 0);
  const modele = modelesMantes[def.modele]();
  modele.traverse((o) => {
    if (o.name === 'ecran-pc') o.material = matEcranPC;
    if (o.name === 'ecran-mac') o.material = matEcranMac;
  });
  g.add(modele);
  racine.add(g);
  // la tour PC : une lueur bleue à l'intérieur, et sa propre fiche quand on clique dessus
  const pc = modele.getObjectByName('objet_pc');
  if (pc) {
    const lueur = new THREE.PointLight('#3a9cff', 0.6, 1.3, 2);
    lueur.position.set(0, 0.25, 0);
    pc.add(lueur);
    const info = { nom: 'PC', description: 'La tour noire à double vitre : watercooling à trois ventilateurs sous le dessus, trois ventilateurs debout côté fenêtre, pompe et barrettes éclairées en bleu, bandeau en alu brossé avec les prises et le dongle Logitech.', groupe: pc };
    pc.userData.info = info;
    cliquables.push(info);
  }
  // le MacBook : clique pour fermer ou rouvrir son capot
  const capot = modele.getObjectByName('pivot_capot');
  const mac = modele.getObjectByName('objet_mac');
  if (capot && mac) {
    const o = { pivot: capot, axe: 'x', ferme: 0.034, ouvert: -1.95, f: 1, cible: 1, vitesse: 4 };
    ouvrants.push(o);
    const info = { nom: 'MacBook', description: 'Le MacBook ouvert devant l’écran. Clique pour fermer ou rouvrir son capot.', groupe: mac, auClic: () => {
      o.cible = o.cible ? 0 : 1;
      sons.ouvrant('mac', o.cible === 1);
    } };
    mac.userData.info = info;
    cliquables.push(info);
  }
  const info = { nom: def.nom, description: def.description, interrupteur: def.interrupteur, groupe: g };
  g.userData.info = info;
  cliquables.push(info);
}

// --- Lumières : même éclairage doux que dans les autres pièces (voir main.js) ---
const ambiante = new THREE.AmbientLight('#ffeee8', 0.6);
scene.add(ambiante);
const hemi = new THREE.HemisphereLight('#f4f4ff', '#b9b3bd', 0.8);
scene.add(hemi);
const soleil = new THREE.DirectionalLight('#fff3e6', 1.2);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 64 });
soleil.shadow.radius = 1.8;
soleil.shadow.bias = -0.00015;
soleil.shadow.normalBias = 0.018;
scene.add(soleil);
scene.add(soleil.target);
soleil.target.position.set(0, 0.5, 0);

const texHalo = textures.creer(128, 128, (g, w, h) => {
  const d = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  d.addColorStop(0, 'rgba(255,255,255,1)');
  d.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  d.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d;
  g.fillRect(0, 0, w, h);
}, false);
const geoAmpoule = new THREE.SphereGeometry(0.05, 12, 12);
const lampes = lumieresMantes.map((l) => {
  const materiauAmpoule = new THREE.MeshStandardMaterial({ color: l.couleur, emissive: l.couleur, emissiveIntensity: 0, roughness: 0.3 });
  const matHalo = new THREE.SpriteMaterial({ map: texHalo, color: l.couleur, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const lumiere = new THREE.PointLight(l.couleur, 0, l.portee ?? 6, 1.5);
  lumiere.position.set(...l.pos);
  lumiere.castShadow = true;
  lumiere.shadow.mapSize.set(1024, 1024);
  racine.add(lumiere);
  const a = new THREE.Mesh(geoAmpoule, materiauAmpoule);
  a.position.set(...l.pos);
  a.scale.setScalar(l.tailleAmpoule ?? 1);
  const halo = new THREE.Sprite(matHalo);
  halo.scale.setScalar(0.6 / (l.tailleAmpoule ?? 1));
  a.add(halo);
  racine.add(a);
  return { nom: l.nom, lumieres: [lumiere], materiauAmpoule, matHalo, surMur: false, intensite: l.intensite };
});
// la lueur de la télé : un projecteur depuis son écran vers la pièce, et un halo derrière
const lumTV = new THREE.SpotLight('#9ab8ff', 0, 6, Math.PI / 3, 0.9, 2);
lumTV.position.set(0.3, 1.5, 1.15);
lumTV.target.position.set(2.6, 0.6, 1.15);
racine.add(lumTV, lumTV.target);
const matHaloTV = new THREE.MeshBasicMaterial({ map: texHalo, color: '#9ab8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const haloTV = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.15), matHaloTV);
haloTV.position.set(0.05, 1.55, 1.15);
haloTV.rotation.y = Math.PI / 2;
racine.add(haloTV);

// --- Interrupteurs ---
let nuit = 0;
const commandes = {};
for (const i of interrupteursMantes) commandes[i.id] = { ...i, manuel: null, niveau: 0, lampes: lampes.filter((l) => (i.lumieres ?? []).includes(l.nom)) };
const estAllume = (id) => commandes[id].manuel ?? (commandes[id].tv ? false : nuit > 0.5);
const basculer = (id) => {
  const c = commandes[id];
  c.manuel = !estAllume(id);
  if (c.tv) sons.tv(c.manuel);
  else sons.interrupteur(c.manuel);
};
const toutAuto = () => {
  for (const c of Object.values(commandes)) c.manuel = null;
};
function majLumieres(dt) {
  for (const c of Object.values(commandes)) {
    const cible = c.manuel === null ? (c.tv ? 0 : nuit) : c.manuel ? 1 : 0;
    c.niveau += (cible - c.niveau) * Math.min(1, dt * 6);
    const halo = c.niveau * (0.35 + 0.65 * nuit);
    for (const l of c.lampes) {
      for (const lu of l.lumieres) lu.intensity = l.intensite * c.niveau;
      l.materiauAmpoule.emissiveIntensity = 2.5 * c.niveau;
      l.matHalo.opacity = 0.85 * halo;
    }
    if (c.tv) {
      matEcran.emissiveIntensity = 1.1 * c.niveau;
      lumTV.intensity = 4 * c.niveau;
      matHaloTV.opacity = 0.55 * halo;
      haloTV.visible = halo > 0.001;
    }
  }
}

// --- Cycle jour / nuit : le soleil réel de Mantes-la-Jolie. La fenêtre étant au nord, la lumière du jour entre
// de ce côté, plus douce que dans une pièce au sud. ---
const SOLEIL_BAS = new THREE.Color('#ffb27a');
const SOLEIL_MIDI = new THREE.Color('#fff3e6');
const SOLEIL_NUIT = new THREE.Color('#aec6f0');
const AMBIANT_BAS = new THREE.Color('#ffddcf');
const AMBIANT_MIDI = new THREE.Color('#ffeee8'); // moins rose qu'ailleurs : les murs doivent rester blancs
const AMBIANT_NUIT = new THREE.Color('#b4bddb');
const HEMI_CIEL_NUIT = new THREE.Color('#9fa6d0');
const HEMI_CIEL_JOUR = new THREE.Color('#f0efff');
const tmp = new THREE.Color();
const tmp2 = new THREE.Color();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const elHeure = document.getElementById('heure');
const elCurseur = document.getElementById('curseur');
const elLive = document.getElementById('live');
document.getElementById('ville-nom').textContent = lieu.nom;
const elVille = document.getElementById('ville');
document.getElementById('ville-tete').addEventListener('click', () => elVille.classList.toggle('ouvert'));
addEventListener('pointerdown', (e) => {
  if (!elVille.contains(e.target)) elVille.classList.remove('ouvert');
});
elCurseur.addEventListener('pointerup', () => elCurseur.blur());
let manuel = false;
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
  const RAMPE = 0.9;
  const h = ((heure % 24) + 24) % 24;
  const u = clamp01((h - LEVER) / (COUCHER - LEVER || 1));
  const d = h > LEVER && h < COUCHER ? Math.sin(u * Math.PI) : 0;
  const f = clamp01(h <= LEVER - RAMPE || h >= COUCHER + RAMPE ? 0 : h >= LEVER && h <= COUCHER ? 1 : h < LEVER ? (h - (LEVER - RAMPE)) / RAMPE : (COUCHER + RAMPE - h) / RAMPE);
  // la lumière entre par la fenêtre, au nord : le soleil de l'ombre porte depuis le nord, de l'est vers l'ouest
  const elevation = 0.3 + d * 0.55;
  const azimut = Math.PI * u;
  const R = 22;
  soleil.position.set(Math.cos(azimut) * 0.8 * R, Math.sin(elevation) * R, -(5 + Math.sin(azimut) * 4));
  soleil.position.lerp(new THREE.Vector3(6, 19, -6), 1 - f);
  const base = { soleil: f * (0.55 + 0.6 * d), ambiante: (0.65 * (1 - f) + f * (0.45 + 0.2 * d)) * (0.55 + 0.45 * f) + 0.3 * (1 - f), hemi: 0.8 * (0.5 + 0.5 * f) };
  soleil.intensity = base.soleil;
  ambiante.intensity = base.ambiante;
  hemi.intensity = base.hemi;
  tmp.copy(SOLEIL_BAS).lerp(SOLEIL_MIDI, d);
  soleil.color.copy(SOLEIL_NUIT).lerp(tmp, f);
  tmp2.copy(AMBIANT_BAS).lerp(AMBIANT_MIDI, d);
  ambiante.color.copy(AMBIANT_NUIT).lerp(tmp2, f);
  hemi.color.copy(HEMI_CIEL_NUIT).lerp(HEMI_CIEL_JOUR, f);
  // la vue par la fenêtre : lumineuse le jour, sombre et bleutée la nuit
  matVue.emissiveIntensity = 0.12 + 0.8 * f;
  matVue.emissive.set(f > 0.3 ? '#ffffff' : '#242d5c');
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
majLumieres(10);

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
  etendue: { x: DEMI_X, z: DEMI_Z },
  murs,
  cliquables,
  vues: vuesMantes,
  commandes,
  estAllume,
  basculer,
  toutAuto,
  reglages,
  limitePolaire: LIMITE_POLAIRE,
});
creerBoutonSon(document.getElementById('cmd-murs'));
{
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ctrl';
  b.setAttribute('aria-label', 'Changer de pièce');
  b.title = 'Changer de pièce';
  b.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>';
  b.addEventListener('click', () => location.reload());
  document.getElementById('cmd-murs').append(b);
}

const horloge = new THREE.Clock();
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
  animerPorte(dt);
  for (const o of ouvrants) {
    if (o.f === o.cible) continue;
    o.f += (o.cible - o.f) * (1 - Math.exp(-o.vitesse * dt));
    if (Math.abs(o.f - o.cible) < 0.002) o.f = o.cible;
    o.pivot.rotation[o.axe] = THREE.MathUtils.lerp(o.ferme, o.ouvert, o.f);
  }
  controls.update();
  const dedans = controls.target.clone().clamp(LIMITE_CIBLE.min, LIMITE_CIBLE.max);
  if (!dedans.equals(controls.target)) {
    camera.position.add(dedans.clone().sub(controls.target));
    controls.target.copy(dedans);
  }
  renderer.render(scene, camera);
});

Promise.allSettled(promesses).then(() => {
  afficherAvancement(1);
  if (miniature) return parent.postMessage({ miniature: globalThis.PIECE }, location.origin);
  setTimeout(() => {
    document.getElementById('chargement').classList.add('fini');
    interactions.entree();
  }, 450);
});
