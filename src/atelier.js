// L'atelier : un écran caché, pour inspecter les modèles de près. On y entre en tapant « atelier » au clavier,
// n'importe où sur le site, ou directement par l'adresse ?atelier (voir src/accueil.js).
// Tous les modèles y sont alignés sur un sol quadrillé (un trait tous les 10 cm, un plus marqué tous les mètres),
// une rangée par pièce : les .glb de Paris et de la chambre de rêve (ceux que charge la pièce, habillés de leurs
// écrans et de leurs imprimés comme dans la pièce : src/habillage.js), les meubles de Mantes (construits en code,
// comme dans leur pièce) et le petit bonhomme du mode secret. Chaque modèle est posé au sol, sa face vers nous.
// Un clic sur un modèle (ou son nom) le cadre ; sa fiche donne ses cotes, ses triangles, ses maillages, son poids.
// L'adresse garde le modèle choisi (#rangee/nom) : un rechargement y revient.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { modeles as modelesParis } from './modeles/meubles.js';
import { modelesReve } from './modeles/reve.js';
import { modelesMantes } from './modeles/mantes.js';
import { creerHabillage } from './habillage.js';
import * as textures from './textures.js';
import './atelier.css';

const PI = Math.PI;

// les rangées, de la plus proche à la plus lointaine. Les meubles de Mantes ont leur dos vers +x : un quart de tour
// les met face à nous. Le lampadaire et le ventilateur de Mantes sont ceux de Paris : pas deux fois.
const RANGEES = [
  { id: 'paris', titre: 'Paris', noms: Object.keys(modelesParis) },
  { id: 'reve', titre: 'Chambre de rêve', noms: Object.keys(modelesReve) },
  {
    id: 'mantes',
    titre: 'Mantes',
    noms: Object.keys(modelesMantes).filter((n) => modelesMantes[n] !== modelesParis[n]),
    construire: (nom) => modelesMantes[nom](),
    rotation: PI / 2,
  },
  // le bonhomme du mode secret, à la taille que lui donne le jeu (src/perso.js : 30 cm)
  { id: 'perso', titre: 'Bonhomme', noms: ['perso'], hauteur: 0.3 },
];
const ECART = 0.5; // entre deux modèles d'une rangée
const LARGEUR_MAX = 8; // une rangée plus longue continue sur la ligne suivante
const INTERLIGNE = 0.8; // entre deux lignes d'une même rangée
const ALLEE = 1.8; // entre deux rangées
// les points de vue, en direction depuis le centre du modèle (touches 1 à 5)
const VUES = [
  { id: 'troisQuarts', label: '3/4', dir: [0.62, 0.48, 0.86] },
  { id: 'face', label: 'Face', dir: [0, 0.1, 1] },
  { id: 'dos', label: 'Dos', dir: [0, 0.1, -1] },
  { id: 'cote', label: 'Côté', dir: [1, 0.1, 0] },
  { id: 'dessus', label: 'Dessus', dir: [0, 1, 0.0001] },
];

// --- l'écran ---
const racine = document.createElement('div');
racine.className = 'atelier';
racine.innerHTML = `
  <canvas class="atelier-vue"></canvas>
  <div class="atelier-etiquettes"></div>
  <header class="atelier-tete">
    <button type="button" class="atelier-bouton" data-action="retour" title="Revenir au choix de la pièce">← Chambre</button>
    <h1>Atelier</h1>
    <button type="button" class="atelier-bouton" data-action="tout" title="Vue d'ensemble (Échap)">Tout voir</button>
    <span class="atelier-etat" role="status" aria-live="polite">Chargement…</span>
  </header>
  <nav class="atelier-liste atelier-panneau" aria-label="Modèles"></nav>
  <section class="atelier-fiche atelier-panneau" aria-live="polite" hidden>
    <div class="atelier-fiche-tete">
      <button type="button" class="atelier-bouton rond" data-action="precedent" aria-label="Modèle précédent (←)">‹</button>
      <div class="atelier-fiche-titre"><h2></h2><p class="atelier-source"></p></div>
      <button type="button" class="atelier-bouton rond" data-action="suivant" aria-label="Modèle suivant (→)">›</button>
    </div>
    <dl class="atelier-cotes">
      <div><dt>Largeur</dt><dd data-cote="l"></dd></div>
      <div><dt>Hauteur</dt><dd data-cote="h"></dd></div>
      <div><dt>Profondeur</dt><dd data-cote="p"></dd></div>
    </dl>
    <p class="atelier-stats"></p>
    <div class="atelier-groupe" role="group" aria-label="Points de vue"></div>
    <div class="atelier-groupe" role="group" aria-label="Affichage">
      <button type="button" class="atelier-bouton" data-bascule="seul" aria-pressed="false" title="S">Seul</button>
      <button type="button" class="atelier-bouton" data-bascule="cotes" aria-pressed="false" title="C">Boîte</button>
      <button type="button" class="atelier-bouton" data-bascule="filDeFer" aria-pressed="false" title="W">Fil de fer</button>
    </div>
  </section>
  <p class="atelier-aide">← → modèle · 1–5 vues · S seul · C boîte · W fil de fer · Échap tout voir</p>
`;
document.body.append(racine);
const $ = (sel) => racine.querySelector(sel);
const canvas = $('.atelier-vue');
const etat = $('.atelier-etat');
const fiche = $('.atelier-fiche');
const liste = $('.atelier-liste');
const calqueEtiquettes = $('.atelier-etiquettes');
for (const [i, v] of VUES.entries()) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'atelier-bouton';
  b.dataset.vue = v.id;
  b.textContent = v.label;
  b.title = String(i + 1);
  $('[aria-label="Points de vue"]').append(b);
}

// --- la scène ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#3a2f52');
// une lumière d'atelier : douce de partout (les dos ne sont jamais noirs), une lampe principale qui fait les ombres
// et suit le modèle choisi, une lampe d'appoint en face
scene.add(new THREE.AmbientLight('#fff4f8', 0.55));
scene.add(new THREE.HemisphereLight('#f4f2ff', '#8f84a6', 1.0));
const lampe = new THREE.DirectionalLight('#fff6ea', 2.2);
lampe.castShadow = true;
lampe.shadow.mapSize.set(4096, 4096);
lampe.shadow.bias = -0.0004;
lampe.shadow.normalBias = 0.01;
scene.add(lampe, lampe.target);
const appoint = new THREE.DirectionalLight('#e8ecff', 0.7);
appoint.position.set(4, 3, -6);
scene.add(appoint);

// le sol : un quadrillage dessiné au shader (net de près, qui s'efface quand ses traits se serrent au loin), et par
// dessus un plan qui ne reçoit que les ombres
const sol = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.ShaderMaterial({
    uniforms: { base: { value: new THREE.Color('#5d5179') }, mineur: { value: new THREE.Color('#71668e') }, majeur: { value: new THREE.Color('#9488b4') } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec4 p = modelMatrix * vec4(position, 1.0);
        vPos = p.xyz;
        gl_Position = projectionMatrix * viewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 base, mineur, majeur;
      varying vec3 vPos;
      float trait(vec2 p, float pas, float epaisseur) {
        vec2 q = p / pas;
        vec2 fw = fwidth(q);
        vec2 g = abs(fract(q - 0.5) - 0.5) / (fw * epaisseur);
        return (1.0 - min(min(g.x, g.y), 1.0)) * (1.0 - smoothstep(0.15, 0.5, max(fw.x, fw.y)));
      }
      void main() {
        vec3 c = mix(base, mineur, trait(vPos.xz, 0.1, 1.0));
        c = mix(c, majeur, trait(vPos.xz, 1.0, 1.5));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }),
);
sol.rotation.x = -PI / 2;
const ombresSol = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
ombresSol.rotation.x = -PI / 2;
ombresSol.receiveShadow = true;
scene.add(sol, ombresSol);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.screenSpacePanning = true;

// --- les modèles ---
const chargeur = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath(textures.chemin('/draco/'));
chargeur.setDRACOLoader(draco);
chargeur.setMeshoptDecoder(MeshoptDecoder);
const { habiller } = creerHabillage({ reve: true });

const modeles = []; // dans l'ordre : rangée par rangée, de gauche à droite
const joli = (nom) => nom.replace(/-/g, ' ');

async function charger(rangee, nom) {
  let objet;
  let octets = null;
  if (rangee.construire) objet = rangee.construire(nom);
  else {
    const url = textures.chemin(`/models/${nom}.glb`);
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`${nom}.glb : ${reponse.status}`);
    const buffer = await reponse.arrayBuffer();
    octets = buffer.byteLength;
    objet = (await chargeur.parseAsync(buffer, '')).scene;
  }
  const materiaux = new Set();
  let triangles = 0;
  let maillages = 0;
  objet.traverse((o) => {
    if (!o.isMesh) return;
    habiller(o);
    o.castShadow = !o.material.transparent;
    o.receiveShadow = true;
    maillages++;
    for (const m of [o.material].flat()) materiaux.add(m);
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  // posé au sol, centré sur son emprise, face vers +z
  const pivot = new THREE.Group();
  pivot.add(objet);
  objet.rotation.y += rangee.rotation ?? 0;
  pivot.updateMatrixWorld(true);
  if (rangee.hauteur) {
    const h = new THREE.Box3().setFromObject(objet).getSize(new THREE.Vector3()).y;
    objet.scale.multiplyScalar(rangee.hauteur / h);
    pivot.updateMatrixWorld(true);
  }
  const b = new THREE.Box3().setFromObject(objet);
  objet.position.x -= (b.min.x + b.max.x) / 2;
  objet.position.z -= (b.min.z + b.max.z) / 2;
  objet.position.y -= b.min.y;
  return { rangee, nom, pivot, octets, triangles, maillages, materiaux: materiaux.size, taille: b.getSize(new THREE.Vector3()), boite: new THREE.Box3() };
}

// --- la liste, les étiquettes au sol, la fiche ---
function creerListe() {
  for (const r of RANGEES) {
    const bloc = document.createElement('section');
    bloc.innerHTML = `<h2>${r.titre}</h2>`;
    const puces = document.createElement('div');
    puces.className = 'atelier-puces';
    for (const m of modeles.filter((x) => x.rangee === r)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'atelier-puce';
      b.textContent = joli(m.nom);
      b.addEventListener('click', () => choisir(m));
      m.puce = b;
      puces.append(b);
      const e = document.createElement('button');
      e.type = 'button';
      e.className = 'atelier-etiquette';
      e.textContent = joli(m.nom);
      e.tabIndex = -1;
      e.addEventListener('click', () => choisir(m));
      m.etiquette = e;
      calqueEtiquettes.append(e);
    }
    bloc.append(puces);
    liste.append(bloc);
  }
}

const cm = (m) => `${(m * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} cm`;
const entier = (n) => Math.round(n).toLocaleString('fr-FR');
function poids(o) {
  if (o === null) return 'construit en code';
  return o > 1048576 ? `${(o / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.round(o / 1024)} Ko`;
}
function remplirFiche(m) {
  fiche.hidden = false;
  $('.atelier-fiche h2').textContent = joli(m.nom);
  $('.atelier-source').textContent = `${m.rangee.titre} · ${m.octets === null ? `${m.nom} (src/modeles/mantes.js)` : `${m.nom}.glb`}`;
  $('[data-cote="l"]').textContent = cm(m.taille.x);
  $('[data-cote="h"]').textContent = cm(m.taille.y);
  $('[data-cote="p"]').textContent = cm(m.taille.z);
  $('.atelier-stats').textContent = `${entier(m.triangles)} triangles · ${m.maillages} maillages · ${m.materiaux} matériaux · ${poids(m.octets)}`;
}

// --- la caméra : elle glisse d'un cadrage à l'autre ---
let trajet = null; // { de: [cible, position], vers: [cible, position], t }
function allerA(cible, position, instant = false) {
  if (instant) {
    controls.target.copy(cible);
    camera.position.copy(position);
    trajet = null;
    return;
  }
  trajet = { de: [controls.target.clone(), camera.position.clone()], vers: [cible.clone(), position.clone()], t: 0 };
}
controls.addEventListener('start', () => (trajet = null)); // la main reprend la caméra
// la liste couvre la gauche de l'écran (sauf sur téléphone) : l'image est décalée pour que ce qu'on regarde soit au
// centre de la place qui reste
const masque = () => (innerWidth > 760 ? liste.getBoundingClientRect().right : 0);
// la distance qui fait tenir une sphère de ce rayon dans cette place, quel que soit le format de l'écran
function recul(rayon) {
  const v = (camera.fov * PI) / 360;
  const h = Math.atan(Math.tan(v) * ((canvas.clientWidth - masque()) / canvas.clientHeight));
  return rayon / Math.sin(Math.min(v, h));
}

let choisi = null;
let vue = 'troisQuarts';
const reglages = { seul: false, cotes: false, filDeFer: false };
const boiteAide = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#f4c9c2'));
boiteAide.visible = false;
scene.add(boiteAide);
// l'emprise du modèle choisi, tracée au sol en rose
const emprise = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5)]),
  new THREE.LineBasicMaterial({ color: '#f4c9c2' }),
);
emprise.position.y = 0.002;
emprise.visible = false;
scene.add(emprise);

function cadrer(m, instant = false) {
  const centre = m.boite.getCenter(new THREE.Vector3());
  const rayon = Math.max(m.taille.length() / 2, 0.05);
  const d = recul(rayon) * 1.08;
  const dir = new THREE.Vector3(...VUES.find((v) => v.id === vue).dir).normalize();
  camera.near = Math.max(0.002, d / 200);
  camera.updateProjectionMatrix();
  allerA(centre, centre.clone().addScaledVector(dir, d), instant);
}
function eclairer(centre, rayon) {
  // la lampe principale suit ce qu'on regarde : ses ombres restent fines
  lampe.target.position.copy(centre);
  lampe.position.copy(centre).add(new THREE.Vector3(-0.6, 1.1, 0.8).multiplyScalar(Math.max(rayon * 3, 2)));
  const c = lampe.shadow.camera;
  const r = Math.max(rayon * 1.6, 0.3);
  Object.assign(c, { left: -r, right: r, top: r, bottom: -r, near: 0.05, far: Math.max(rayon * 12, 12) });
  c.updateProjectionMatrix();
}

function choisir(m, { instant = false } = {}) {
  choisi = m;
  for (const x of modeles) {
    x.puce.classList.toggle('actif', x === m);
    x.pivot.visible = !reglages.seul || x === m;
  }
  m.puce.scrollIntoView({ block: 'nearest' });
  remplirFiche(m);
  const centre = m.boite.getCenter(new THREE.Vector3());
  emprise.scale.set(m.taille.x + 0.04, 1, m.taille.z + 0.04);
  emprise.position.set(centre.x, 0.002, centre.z);
  emprise.visible = true;
  boiteAide.box.copy(m.boite);
  boiteAide.visible = reglages.cotes;
  eclairer(centre, m.taille.length() / 2);
  cadrer(m, instant);
  history.replaceState(null, '', `#${m.rangee.id}/${m.nom}`);
}

function toutVoir(instant = false) {
  choisi = null;
  fiche.hidden = true;
  emprise.visible = false;
  boiteAide.visible = false;
  for (const x of modeles) {
    x.puce.classList.remove('actif');
    x.pivot.visible = true;
  }
  const b = new THREE.Box3();
  for (const x of modeles) b.union(x.boite);
  const centre = b.getCenter(new THREE.Vector3());
  const taille = b.getSize(new THREE.Vector3());
  eclairer(centre, Math.max(taille.x, taille.z) / 2);
  camera.near = 0.05;
  camera.updateProjectionMatrix();
  const d = recul(Math.hypot(taille.x, taille.z) / 2) * 0.85;
  allerA(new THREE.Vector3(centre.x, 0, centre.z), new THREE.Vector3(centre.x, d * 0.7, centre.z + d * 0.72), instant);
  history.replaceState(null, '', location.pathname + location.search);
}

function voisin(sens) {
  if (!modeles.length) return;
  const i = choisi ? modeles.indexOf(choisi) : sens > 0 ? -1 : modeles.length;
  choisir(modeles[(i + sens + modeles.length) % modeles.length]);
}
function changerVue(id) {
  vue = id;
  for (const b of racine.querySelectorAll('[data-vue]')) b.classList.toggle('actif', b.dataset.vue === id);
  if (choisi) cadrer(choisi);
}
function basculer(nom) {
  reglages[nom] = !reglages[nom];
  racine.querySelector(`[data-bascule="${nom}"]`).setAttribute('aria-pressed', String(reglages[nom]));
  if (nom === 'filDeFer') {
    scene.traverse((o) => {
      if (o.isMesh && o !== sol && o !== ombresSol) for (const m of [o.material].flat()) m.wireframe = reglages.filDeFer;
    });
  }
  if (nom === 'cotes') boiteAide.visible = reglages.cotes && !!choisi;
  if (nom === 'seul') for (const x of modeles) x.pivot.visible = !reglages.seul || !choisi || x === choisi;
}

// --- clics et clavier ---
racine.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.action === 'retour') location.href = location.pathname;
  else if (b.dataset.action === 'tout') toutVoir();
  else if (b.dataset.action === 'precedent') voisin(-1);
  else if (b.dataset.action === 'suivant') voisin(1);
  else if (b.dataset.vue) changerVue(b.dataset.vue);
  else if (b.dataset.bascule) basculer(b.dataset.bascule);
});
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const n = /^Digit([1-5])$/.exec(e.code) ?? /^Numpad([1-5])$/.exec(e.code); // les chiffres, même en AZERTY
  if (n) changerVue(VUES[Number(n[1]) - 1].id);
  else if (e.key === 'ArrowRight') voisin(1);
  else if (e.key === 'ArrowLeft') voisin(-1);
  else if (e.key === 'Escape') toutVoir();
  else if (e.key.toLowerCase() === 's') basculer('seul');
  else if (e.key.toLowerCase() === 'c') basculer('cotes');
  else if (e.key.toLowerCase() === 'w') basculer('filDeFer');
  else return;
  e.preventDefault();
});

// un clic (sans glisser) sur un modèle le choisit ; au survol, le curseur et l'étiquette le signalent
const lancer = new THREE.Raycaster();
const pointeur = new THREE.Vector2();
function sousLePointeur(e) {
  const r = canvas.getBoundingClientRect();
  pointeur.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  lancer.setFromCamera(pointeur, camera);
  let meilleur = null;
  for (const m of modeles) {
    if (!m.pivot.visible || !lancer.ray.intersectsBox(m.boite)) continue;
    const touche = lancer.intersectObject(m.pivot, true)[0];
    if (touche && (!meilleur || touche.distance < meilleur.distance)) meilleur = { distance: touche.distance, modele: m };
  }
  return meilleur?.modele ?? null;
}
let appui = null;
canvas.addEventListener('pointerdown', (e) => (appui = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!appui || Math.hypot(e.clientX - appui[0], e.clientY - appui[1]) > 5) return;
  appui = null;
  const m = sousLePointeur(e);
  if (m) choisir(m);
});
let survole = null;
let survolEnAttente = null;
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  survolEnAttente = e;
});
function majSurvol() {
  if (!survolEnAttente) return;
  const m = sousLePointeur(survolEnAttente);
  survolEnAttente = null;
  if (m === survole) return;
  survole?.etiquette.classList.remove('survol');
  survole = m;
  survole?.etiquette.classList.add('survol');
  canvas.style.cursor = m ? 'pointer' : '';
}

// les étiquettes suivent leur modèle, au sol devant lui, et s'effacent au loin ; le nom de chaque rangée, à sa gauche
const v = new THREE.Vector3();
const titresRangees = []; // { el, pos }
function majEtiquettes() {
  const l = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const t of titresRangees) {
    const d = t.pos.distanceTo(camera.position);
    v.copy(t.pos).project(camera);
    // de près, on regarde un modèle : les noms des rangées s'effacent
    const opacite = v.z < 1 && !(reglages.seul && choisi) ? THREE.MathUtils.clamp((d - 5) / 4, 0, 1) : 0;
    t.el.style.opacity = opacite;
    t.el.style.visibility = opacite > 0.02 ? 'visible' : 'hidden';
    t.el.style.transform = `translate(${((v.x + 1) / 2) * l}px, ${((1 - v.y) / 2) * h}px) translate(-100%, -50%)`;
  }
  // quand on regarde un modèle, les noms de ceux qui sont derrière lui s'effacent (ils passeraient devant)
  const loin = choisi ? choisi.boite.getCenter(v).distanceTo(camera.position) + 0.3 : Infinity;
  for (const m of modeles) {
    const e = m.etiquette;
    const visible = m.pivot.visible && m !== choisi;
    v.set((m.boite.min.x + m.boite.max.x) / 2, 0, m.boite.max.z + 0.08);
    const d = v.distanceTo(camera.position);
    v.project(camera);
    const opacite = visible && v.z < 1 && d < loin ? THREE.MathUtils.clamp((20 - d) / 6, 0, 1) : 0;
    e.style.opacity = opacite;
    e.style.visibility = opacite > 0.02 ? 'visible' : 'hidden';
    if (opacite > 0.02) e.style.transform = `translate(${((v.x + 1) / 2) * l}px, ${((1 - v.y) / 2) * h}px) translate(-50%, 0)`;
  }
}

function redimensionner() {
  const [l, h] = [canvas.clientWidth, canvas.clientHeight];
  renderer.setSize(l, h, false);
  camera.aspect = l / h;
  const s = masque();
  if (s) camera.setViewOffset(l, h, -s / 2, 0, l, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();

let avant = performance.now();
renderer.setAnimationLoop((maintenant) => {
  const dt = Math.min(0.1, (maintenant - avant) / 1000);
  avant = maintenant;
  if (trajet) {
    trajet.t = Math.min(1, trajet.t + dt / 0.55);
    const k = 1 - (1 - trajet.t) ** 3;
    controls.target.lerpVectors(trajet.de[0], trajet.vers[0], k);
    camera.position.lerpVectors(trajet.de[1], trajet.vers[1], k);
    if (trajet.t >= 1) trajet = null;
  }
  controls.update();
  majSurvol();
  majEtiquettes();
  renderer.render(scene, camera);
});

// --- chargement, puis mise en rangées ---
async function demarrer() {
  const taches = RANGEES.flatMap((r) => r.noms.map((nom) => ({ r, nom })));
  let faits = 0;
  etat.textContent = `Chargement… 0 / ${taches.length}`;
  const resultats = await Promise.all(
    taches.map(({ r, nom }) =>
      charger(r, nom)
        .catch((err) => {
          console.error(err);
          return null;
        })
        .finally(() => (etat.textContent = `Chargement… ${++faits} / ${taches.length}`)),
    ),
  );
  modeles.push(...resultats.filter(Boolean));
  const manquants = taches.length - modeles.length;
  etat.textContent = `${modeles.length} modèles${manquants ? ` · ${manquants} introuvable${manquants > 1 ? 's' : ''}` : ''}`;

  // chaque rangée de gauche à droite, en lignes d'au plus LARGEUR_MAX, alignées à gauche ; les rangées et leurs
  // lignes s'éloignent l'une derrière l'autre, le nom de la rangée à gauche de sa première ligne
  const gauche = -LARGEUR_MAX / 2;
  let z = 0;
  let profondeurAvant = 0;
  for (const r of RANGEES) {
    const lignes = [];
    let largeur = Infinity;
    for (const m of modeles.filter((x) => x.rangee === r)) {
      if (largeur + ECART + m.taille.x > LARGEUR_MAX) {
        lignes.push([]);
        largeur = -ECART;
      }
      largeur += ECART + m.taille.x;
      lignes.at(-1).push(m);
    }
    for (const [k, ligne] of lignes.entries()) {
      const profondeur = Math.max(...ligne.map((m) => m.taille.z));
      if (profondeurAvant) z -= profondeurAvant / 2 + (k ? INTERLIGNE : ALLEE);
      z -= profondeur / 2;
      profondeurAvant = profondeur;
      let x = gauche;
      for (const m of ligne) {
        m.pivot.position.set(x + m.taille.x / 2, 0, z);
        x += m.taille.x + ECART;
        scene.add(m.pivot);
        m.pivot.updateMatrixWorld(true);
        m.boite.setFromObject(m.pivot);
      }
      if (k) continue;
      const el = document.createElement('span');
      el.className = 'atelier-rangee';
      el.textContent = r.titre;
      calqueEtiquettes.append(el);
      titresRangees.push({ el, pos: new THREE.Vector3(gauche - 0.3, 0, z) });
    }
  }
  creerListe();
  redimensionner(); // la liste est remplie : sa largeur compte pour le cadrage
  changerVue(vue);
  const [idRangee, nom] = decodeURIComponent(location.hash.slice(1)).split('/');
  const depart = modeles.find((m) => m.rangee.id === idRangee && m.nom === nom);
  if (depart) choisir(depart, { instant: true });
  else toutVoir(true);
}
demarrer();
