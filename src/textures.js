import * as THREE from 'three';

// Chemin d'un fichier de public/ qui marche à la racine (en local) comme dans un sous-dossier
// (GitHub Pages : https://compte.github.io/ma-chambre-3d/). `/models/x.glb` -> `<base>models/x.glb`.
export const chemin = (url) => (url.startsWith('/') ? import.meta.env.BASE_URL + url.slice(1) : url);

// Petit générateur pseudo-aléatoire pour que les textures soient identiques à chaque chargement.
export function aleatoire(graine) {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function creer(w, h, dessiner, repeter = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  dessiner(canvas.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeter) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Sol rose, comme dans la référence : des lames fines, à peine plus foncées entre elles.
// Un motif = 1 m × 1 m, lames dans le sens nord-sud.
export function sol(base = '#f4c9c2', ligne = '#dfb6af') {
  return creer(512, 512, (g, w, h) => {
    const r = aleatoire(3);
    const lames = 5;
    for (let i = 0; i < lames; i++) {
      g.fillStyle = base;
      g.fillRect((i * w) / lames, 0, w / lames, h);
      g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`;
      g.fillRect((i * w) / lames, 0, w / lames, h);
      g.fillStyle = ligne;
      g.fillRect((i * w) / lames, 0, 3, h);
      g.fillRect((i * w) / lames, r() * h, w / lames, 2);
    }
  });
}

// Couette à gros carreaux, en tons pastel : rose, orangé, jaune, mauve.
export function couette() {
  const R = '#ec8a94';
  const O = '#f5a97c';
  const Y = '#f8d58a';
  const P = '#c97aa0';
  const M = '#e0788f';
  const grille = [
    [P, R, O, Y, O],
    [R, O, Y, O, R],
    [M, R, O, R, P],
    [R, P, R, M, R],
  ];
  return creer(
    512,
    410,
    (g, w, h) => {
      const lignes = grille.length;
      const colonnes = grille[0].length;
      grille.forEach((ligne, j) =>
        ligne.forEach((c, i) => {
          g.fillStyle = c;
          g.fillRect((i * w) / colonnes, (j * h) / lignes, w / colonnes + 1, h / lignes + 1);
        }),
      );
    },
    false,
  );
}

function etoile(g, x, y, rayon) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? rayon * 0.45 : rayon;
    g[i ? 'lineTo' : 'moveTo'](x + Math.cos(angle) * rr, y + Math.sin(angle) * rr);
  }
  g.closePath();
  g.fill();
}

// Pente du toit : plâtre rose très clair avec les étoiles autocollantes d'un jaune pâle.
export function etoiles() {
  return creer(
    1024,
    563,
    (g, w, h) => {
      g.fillStyle = '#f1d8d9';
      g.fillRect(0, 0, w, h);
      const r = aleatoire(11);
      g.fillStyle = '#f7e7ae';
      for (let i = 0; i < 32; i++) etoile(g, r() * w, r() * h, 9 + r() * 9);
    },
    false,
  );
}

// Les vraies affiches, recadrées depuis tes photos (public/textures/).
const chargeur = new THREE.TextureLoader();
export function affiche(type) {
  const t = chargeur.load(chemin(type === 'iron' ? '/textures/iron.jpg' : '/textures/mando.jpg'));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// N'importe quelle image du projet (public/textures/…) comme texture.
export function image(url) {
  const t = chargeur.load(chemin(url));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

