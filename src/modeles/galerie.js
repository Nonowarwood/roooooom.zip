import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { modeles } from './meubles.js';

// Page de travail : montre tous les modèles côte à côte (pour les regarder de
// près) et les exporte en .glb. Le bouton télécharge les fichiers, à ranger dans
// public/models/. Les fichiers déjà livrés avec le projet ont été produits ainsi.

const canvas = document.getElementById('vue');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#3b2a5a');
scene.add(new THREE.HemisphereLight('#ffffff', '#6b4a5a', 1.5));
const soleil = new THREE.DirectionalLight('#fff4e0', 2.4);
soleil.position.set(-3, 6, 4);
soleil.castShadow = true;
soleil.shadow.mapSize.set(2048, 2048);
Object.assign(soleil.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
scene.add(soleil);

const sol = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#8f98ba', roughness: 0.8 }));
sol.rotation.x = -Math.PI / 2;
sol.receiveShadow = true;
scene.add(sol);

// disposition en grille : chaque modèle dans sa case
const noms = Object.keys(modeles);
const colonnes = 4;
const pas = 3;
const cases = new Map();
const rangees = Math.ceil(noms.length / colonnes);
// la porte et l'interrupteur ont leur origine au centre : on les remonte pour les voir en entier
const hauteurs = { porte: 1.02, interrupteur: 0.5 };
noms.forEach((nom, i) => {
  const g = modeles[nom]();
  const x = (i % colonnes - (colonnes - 1) / 2) * pas;
  const z = (Math.floor(i / colonnes) - (rangees - 1) / 2) * pas;
  g.position.set(x, hauteurs[nom] ?? 0, z);
  scene.add(g);
  cases.set(nom, new THREE.Vector3(x, 0.8, z));
});

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
function voir(centre, distance) {
  controls.target.copy(centre);
  camera.position.set(centre.x - distance * 0.55, centre.y + distance * 0.5, centre.z + distance * 0.8);
  controls.update();
}
const tout = new THREE.Vector3(0, 0.6, 0);
voir(tout, 13);

// un bouton par modèle pour s'en approcher
const barre = document.getElementById('barre');
for (const nom of noms) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = nom;
  b.addEventListener('click', () => voir(cases.get(nom), 3.4));
  barre.insertBefore(b, document.getElementById('etat'));
}
document.getElementById('tous').addEventListener('click', () => voir(tout, 13));

function redimensionner() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionner);
redimensionner();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

// --- Export en .glb ---
// Chaque modèle est reconstruit à neuf (position d'origine au centre du meuble) puis exporté.
async function construireGlb(nom) {
  const g = modeles[nom]();
  return new GLTFExporter().parseAsync(g, { binary: true });
}

function enBase64(buffer) {
  let binaire = '';
  const octets = new Uint8Array(buffer);
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

// utilisé aussi par l'outil en ligne de commande : renvoie { nom: contenuEnBase64 }
window.exporterTous = async () => {
  const sortie = {};
  for (const nom of noms) sortie[nom] = enBase64(await construireGlb(nom));
  return sortie;
};

document.getElementById('exporter').addEventListener('click', async () => {
  const etat = document.getElementById('etat');
  for (const nom of noms) {
    etat.textContent = `Export de ${nom}…`;
    const buffer = await construireGlb(nom);
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }));
    lien.download = `${nom}.glb`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  }
  etat.textContent = 'Terminé : range les fichiers dans public/models/';
});
