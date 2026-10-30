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

// Pente du toit : plâtre rose très clair (ou `fond`) avec les étoiles autocollantes d'un jaune pâle.
export function etoiles(fond = '#f1d8d9') {
  return creer(
    1024,
    563,
    (g, w, h) => {
      g.fillStyle = fond;
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
//  - alpha : blanc = matière, noir = ajour. Face : le vrai symbole du groupe (une croix aplatie aux
//    bords en dents de scie, public/textures/logo-lesserafim.png) tourné à la verticale et étiré
//    le long du bâton, comme sur le produit ; côté (à 90°) : « FEARNOT », lu de bas en haut.
//    On voit le cœur lumineux à travers.
// Le symbole se charge en arrière-plan : les textures sont repeintes dès qu'il est là.
export function lightStickTextures() {
  const W = 1024;
  const H = 2048;
  const fabrique = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return { c, g: c.getContext('2d'), tex };
  };
  const cou = fabrique();
  const alp = fabrique();
  const symbole = new Image();
  let chargé = false;

  // le symbole, de la taille voulue : 1120 px de long (le long du bâton) pour 197 px de large
  const LONG = 1120;
  const LARG = LONG / (1593 / 280);
  const CX = W * 0.5;
  const CY = 670;
  const poserSymbole = (g, teinte) => {
    if (!chargé) return;
    const t = document.createElement('canvas');
    t.width = Math.round(LONG);
    t.height = Math.round(LARG);
    const tg = t.getContext('2d');
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(symbole, 0, 0, t.width, t.height);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = teinte;
    tg.fillRect(0, 0, t.width, t.height);
    g.save();
    g.translate(CX, CY);
    g.rotate(-Math.PI / 2); // à la verticale
    g.drawImage(t, -LONG / 2, -LARG / 2);
    g.restore();
  };

  // FEARNOT, lu de bas en haut, avec sa barre horizontale en haut ; `mode` : remplir | contour
  const fearnot = (g, mode) => {
    g.save();
    g.translate(W * 0.8, 700);
    g.rotate(-Math.PI / 2);
    g.font = '700 118px "Arial Narrow", Impact, "Helvetica Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '10px';
    mode === 'remplir' ? g.fillText('FEARNOT', 0, 0) : g.strokeText('FEARNOT', 0, 0);
    g.restore();
    for (const b of [[W * 0.8 - 62, 140, 124, 14], [W * 0.8 - 7, 110, 14, 70]]) {
      mode === 'remplir' ? g.fillRect(...b) : g.strokeRect(...b);
    }
  };

  const peindre = () => {
    // — couleur —
    const g = cou.g;
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
    // liseré lumineux autour des ajours : un halo clair (la partie sous l'ajour est coupée par l'alpha)
    g.save();
    g.shadowColor = '#f4f8ff';
    g.shadowBlur = 16;
    for (let i = 0; i < 3; i++) poserSymbole(g, '#f4f8ff');
    g.restore();
    g.strokeStyle = '#f4f8ff';
    g.lineWidth = 16;
    fearnot(g, 'contour');
    cou.tex.needsUpdate = true;
    // — alpha —
    const a = alp.g;
    a.fillStyle = '#fff';
    a.fillRect(0, 0, W, H);
    a.fillStyle = '#000';
    poserSymbole(a, '#000');
    fearnot(a, 'remplir');
    alp.tex.needsUpdate = true;
  };

  peindre(); // une première fois sans le symbole (FEARNOT seul), puis avec dès qu'il est chargé
  symbole.onload = () => {
    chargé = true;
    peindre();
  };
  symbole.src = chemin('/textures/logo-lesserafim.png');

  return { couleur: cou.tex, alpha: alp.tex };
}
