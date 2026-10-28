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


// Tranche d'une boîte ronde « PUREFLOW » (LE SSERAFIM) : deux anneaux (couvercle et fond) de la couleur de
// la version, avec les lettres P-U-R-E-F-L-O-W espacées autour et un petit repère entre chaque.
export function pureflowTranche(haut, bas, graine = 1) {
  return creer(1024, 128, (g, w, h) => {
    const r = aleatoire(graine);
    for (const [y0, hh, c] of [[0, h / 2, haut], [h / 2, h / 2, bas]]) {
      const d = g.createLinearGradient(0, 0, w, 0);
      d.addColorStop(0, c);
      d.addColorStop(0.5, c);
      d.addColorStop(1, c);
      g.fillStyle = d;
      g.fillRect(0, y0, w, hh);
      // un peu de marbrure : des traînées plus claires
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.16})`;
        g.beginPath();
        g.ellipse(r() * w, y0 + r() * hh, 40 + r() * 120, 3 + r() * 10, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h / 2 - 1, w, 2); // la fente entre couvercle et fond
    g.fillStyle = '#6b7380';
    g.font = '600 24px Inter, Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lettres = 'PUREFLOW';
    for (let k = 0; k < 16; k++) {
      const x = ((k + 0.5) * w) / 16;
      g.fillText(lettres[k % 8], x, h * 0.26);
      g.fillText(lettres[(k + 3) % 8], x, h * 0.76);
      g.fillRect(x + w / 32 - 1, h * 0.14, 2, 10);
      g.fillRect(x + w / 32 - 1, h * 0.64, 2, 10);
    }
  });
}

// Light stick LE SSERAFIM : deux textures qui font le tour du corps (u = angle, 0,5 = face avant) et
// vont de haut en bas (le haut de l'image = le haut du bâton).
//  - couleur : face avant argentée, côté droit plus sombre, coutures, joints du bas, et un liseré
//    clair tout autour des ajours (les tranches lumineuses de l'acrylique) ;
//  - alpha : blanc = matière, noir = ajour. Face : le logo en zigzag (deux éclats reliés par un col) ;
//    côté (à 90°) : « FEARNOT » découpé, lu de bas en haut. On voit le cœur lumineux à travers.
export function lightStickTextures() {
  const W = 1024;
  const H = 2048;
  const faire = (dessiner) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    dessiner(c.getContext('2d'));
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  };
  const tri = (x) => Math.abs((((x % 1) + 1) % 1) - 0.5) * 2; // onde triangulaire 0..1

  // trace tous les ajours : `mode` = 'remplir' (alpha) ou 'contour' (liseré de la couleur)
  const ajours = (g, mode) => {
    const cx = W * 0.5;
    const y0 = 110;
    const y1 = 1230;
    const demi = (u, dephase) => {
      if (u > 0.43 && u < 0.56) return 18 + 10 * tri(u * 9 + dephase);
      const k = u <= 0.43 ? u * 7 : (u - 0.56) * 6.6;
      return 46 + 52 * tri(k + dephase);
    };
    const gauche = [];
    const droite = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const y = y0 + u * (y1 - y0);
      gauche.push([cx - demi(u, 0), y]);
      droite.push([cx + demi(u, 0.5), y]);
    }
    g.beginPath();
    gauche.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    droite.reverse().forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    mode === 'remplir' ? g.fill() : g.stroke();
    // FEARNOT, lu de bas en haut, avec sa barre en haut
    g.save();
    g.translate(W * 0.8, 700);
    g.rotate(-Math.PI / 2);
    g.font = '700 118px "Arial Narrow", Impact, "Helvetica Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '10px';
    mode === 'remplir' ? g.fillText('FEARNOT', 0, 0) : g.strokeText('FEARNOT', 0, 0);
    g.restore();
    const barres = [[W * 0.8 - 62, 140, 124, 14], [W * 0.8 - 7, 110, 14, 70]];
    for (const b of barres) (mode === 'remplir' ? g.fillRect : g.strokeRect).call(g, ...b);
  };

  const couleur = faire((g) => {
    g.fillStyle = '#a3aec4';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#6f788d';
    g.fillRect(W * 0.64, 0, W * 0.32, H);
    const v = g.createLinearGradient(0, 0, W, 0);
    v.addColorStop(0, 'rgba(255,255,255,0.10)');
    v.addColorStop(0.5, 'rgba(255,255,255,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#2b303b';
    g.fillRect(W * 0.64 - 2, 0, 4, H);
    g.fillRect(W * 0.96 - 2, 0, 4, H);
    g.fillStyle = '#d3dae6';
    g.fillRect(0, 0, W, 46);
    g.fillStyle = '#2b303b';
    g.fillRect(0, 46, W, 4);
    g.fillRect(0, H * 0.86, W, 5);
    g.fillRect(0, H * 0.965, W, 4);
    g.strokeStyle = '#2b303b';
    g.lineWidth = 3;
    for (const x of [0.42, 0.5]) g.strokeRect(W * x, H * 0.885, W * 0.08, 70);
    // le liseré lumineux autour des ajours (la moitié intérieure est coupée par l'alpha)
    g.strokeStyle = '#f4f8ff';
    g.lineWidth = 16;
    g.lineJoin = 'miter';
    ajours(g, 'contour');
  });

  const alpha = faire((g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    ajours(g, 'remplir');
  });

  return { couleur, alpha };
}
