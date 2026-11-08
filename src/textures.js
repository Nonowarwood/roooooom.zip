import * as THREE from 'three';
import { champMiffy, traitsMiffy, coutureMiffy, MIFFY } from './modeles/miffy.js';

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

// --- Bois en lames : le parquet de la chambre de rêve ---
// Le motif est fait de colonnes de lames, le fil du bois dans le sens de la hauteur de l'image. Chaque lame est
// dessinée avec son propre tirage au sort (une graine par lame) : une lame qui passe le bas de l'image est dessinée
// une seconde fois une hauteur plus haut, identique, et le motif se raccorde sans couture quand il se répète.
// On dessine deux images avec le même plan : la couleur, et le relief (les joints creusés, en sombre).
function lames({ largeur, hauteur, colonnes, pxParM, segments, bois, graine, joint }) {
  const lPx = largeur / colonnes;
  // le plan : pour chaque colonne, ses lames [début, longueur] en pixels, et une graine chacune
  const plan = [];
  const r = aleatoire(graine);
  for (let c = 0; c < colonnes; c++) {
    for (const [a, h] of segments(r, hauteur)) plan.push({ x: c * lPx, y: a, l: lPx, h, graine: Math.floor(r() * 1e9), ton: Math.floor(r() * bois.tons.length) });
  }
  const dessiner = (relief) => (g, w, H) => {
    g.fillStyle = relief ? '#c8c8c8' : bois.tons[0];
    g.fillRect(0, 0, w, H);
    for (const lame of plan) {
      for (const dy of [0, -H]) {
        if (lame.y + dy >= H || lame.y + lame.h + dy <= 0) continue;
        if (relief) relieflame(g, lame, dy, joint);
        else veinerLame(g, lame, dy, bois, pxParM, joint);
      }
    }
  };
  const map = creer(largeur, hauteur, dessiner(false));
  const relief = creer(largeur, hauteur, dessiner(true));
  relief.colorSpace = THREE.NoColorSpace;
  for (const t of [map, relief]) t.repeat.set(pxParM / largeur, pxParM / hauteur); // coordonnées de texture en mètres
  return { map, relief };
}

// Le relief d'une lame : un léger écart de hauteur d'une lame à l'autre, et ses joints en creux.
function relieflame(g, { x, y, l, h, graine }, dy, joint) {
  const r = aleatoire(graine + 7);
  const v = Math.round(196 + (r() - 0.5) * 18);
  g.fillStyle = `rgb(${v},${v},${v})`;
  g.fillRect(x, y + dy, l, h);
  g.fillStyle = '#000';
  g.fillRect(x, y + dy, joint.largeur, h); // le joint du côté
  if (joint.bouts) g.fillRect(x, y + dy, l, joint.largeur); // le joint du bout
}

// Le veinage d'une lame, dans le rectangle (x, y + dy, l, h) : nuances le long de la lame, fil ondulé, quelques
// « flammes » (les arcs emboîtés du bois scié en dosse), des nœuds, et ses joints.
function veinerLame(g, { x, y, l, h, graine, ton }, dy, bois, pxParM, joint) {
  const r = aleatoire(graine);
  const y0 = y + dy;
  g.save();
  g.beginPath();
  g.rect(x, y0, l, h);
  g.clip();
  g.globalAlpha = 1;
  g.fillStyle = bois.tons[ton];
  g.fillRect(x, y0, l, h);
  // de grandes nuances, plus claires ou plus foncées, sur toute la longueur
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.04 + r() * 0.07;
    g.fillStyle = r() < 0.5 ? bois.clair : bois.fonce;
    const bw = l * (0.15 + r() * 0.45);
    g.fillRect(x + r() * l - bw / 2, y0, bw, h);
  }
  // un nœud (parfois) : on le place d'abord, pour que le fil du bois le contourne
  const noeud = r() < bois.noeuds ? (() => {
    const rx = l * (0.05 + r() * 0.08) * bois.tailleNoeud;
    return { x: x + l * (0.25 + r() * 0.5), y: y0 + h * (0.1 + r() * 0.8), rx, ry: rx * (1.2 + r() * 0.6) };
  })() : null;
  // de combien le fil s'écarte au passage du nœud (vers la gauche ou la droite selon son côté)
  const ecart = (xx, yy) => {
    if (!noeud) return 0;
    const dx = xx - noeud.x;
    const dy = (yy - noeud.y) / (noeud.ry * 2.2);
    return Math.sign(dx || 1) * noeud.rx * 1.5 * Math.exp(-dy * dy) * Math.exp(-Math.abs(dx) / (noeud.rx * 2.5));
  };
  // le fil : de fines lignes qui ondulent doucement le long de la lame
  const nb = Math.round(l * bois.densite);
  g.lineCap = 'round';
  for (let i = 0; i < nb; i++) {
    const x0 = x + r() * l;
    const amp = (0.4 + r() * 1.6) * (pxParM / 600);
    const f = (2 * Math.PI) / ((0.25 + r() * 0.8) * pxParM);
    const ph = r() * 6.28;
    const derive = (r() - 0.5) * 0.012;
    g.globalAlpha = bois.alphaFil * (0.4 + r() * 0.8);
    g.strokeStyle = r() < 0.8 ? bois.fil : bois.clair;
    g.lineWidth = 0.6 + r() * (r() < 0.15 ? 2.2 : 0.9);
    g.beginPath();
    for (let s = 0; s <= h; s += 6) {
      let xx = x0 + Math.sin(s * f + ph) * amp + s * derive;
      xx += ecart(xx, y0 + s);
      if (s) g.lineTo(xx, y0 + s);
      else g.moveTo(xx, y0 + s);
    }
    g.stroke();
  }
  // les flammes : des arcs emboîtés qui se resserrent en pointe, prolongés par des lignes droites
  if (r() < bois.flammes) {
    const cx = x + l * (0.3 + r() * 0.4);
    const pointe = y0 + h * (0.15 + r() * 0.7);
    const sens = r() < 0.5 ? 1 : -1; // les bras partent vers le bas (1) ou vers le haut (−1)
    const nbArcs = 3 + Math.floor(r() * 5);
    const pas = l * (0.035 + r() * 0.03);
    const longueur = pxParM * (0.12 + r() * 0.2);
    for (let k = 1; k <= nbArcs; k++) {
      const demi = k * pas;
      const ak = pointe - sens * k * longueur * 0.22; // les arcs extérieurs ont leur pointe plus loin
      g.globalAlpha = bois.alphaFil * (1.1 + r() * 0.8);
      g.strokeStyle = bois.fil;
      g.lineWidth = 0.8 + r() * 1.4;
      g.beginPath();
      for (let s = -1; s <= 1.0001; s += 0.05) {
        const t = Math.abs(s);
        const xx = cx + Math.sign(s) * demi * Math.sqrt(t) + Math.sin(t * 5 + k) * 0.8;
        const yy = ak + sens * t * longueur;
        if (s === -1) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.stroke();
      // les bras continuent tout droit jusqu'au bout de la lame
      for (const c of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + c * demi, ak + sens * longueur);
        g.lineTo(cx + c * demi + c * 0.6, sens > 0 ? y0 + h : y0);
        g.stroke();
      }
    }
  }
  // le nœud : un halo plus foncé, un cœur brun-roux au contour irrégulier cerné de sombre, deux cernes dedans
  if (noeud) {
    const { x: nx, y: ny, rx, ry } = noeud;
    const halo = g.createRadialGradient(nx, ny, 0, nx, ny, rx * 2.4);
    halo.addColorStop(0, bois.fonce);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.22;
    g.fillStyle = halo;
    g.beginPath();
    g.ellipse(nx, ny, rx * 2.4, ry * 2.4, 0, 0, 2 * Math.PI);
    g.fill();
    const contour = () => {
      g.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = (k / 18) * 2 * Math.PI;
        const j = 1 + Math.sin(a * 3 + graine) * 0.08 + Math.sin(a * 5 + graine * 0.7) * 0.06;
        const px = nx + Math.cos(a) * rx * j;
        const py = ny + Math.sin(a) * ry * j;
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    };
    const coeur = g.createRadialGradient(nx - rx * 0.2, ny - ry * 0.2, 0, nx, ny, Math.max(rx, ry));
    coeur.addColorStop(0, bois.noeud);
    coeur.addColorStop(0.55, bois.noeud);
    coeur.addColorStop(1, bois.fonce);
    g.globalAlpha = 0.6;
    g.fillStyle = coeur;
    contour();
    g.fill();
    g.globalAlpha = 0.45;
    g.strokeStyle = bois.joint;
    g.lineWidth = 1.3;
    g.stroke();
    g.globalAlpha = 0.25;
    g.lineWidth = 1;
    for (const k of [0.62, 0.32]) {
      g.beginPath();
      g.ellipse(nx, ny, rx * k, ry * k, 0, 0, 2 * Math.PI);
      g.stroke();
    }
  }
  // les pores : de petits traits sombres dans le sens du fil (le chêne surtout)
  for (let i = 0; i < l * h * bois.pores; i++) {
    g.globalAlpha = 0.08 + r() * 0.1;
    g.fillStyle = bois.fil;
    g.fillRect(x + r() * l, y0 + r() * h, 1, 2 + r() * 6);
  }
  // les joints : un trait sombre (le creux) suivi d'un liseré clair (l'arête qui prend la lumière)
  g.globalAlpha = 0.75;
  g.fillStyle = bois.joint;
  g.fillRect(x, y0, joint.largeur, h);
  if (joint.bouts) g.fillRect(x, y0, l, joint.largeur);
  g.globalAlpha = 0.35;
  g.fillStyle = bois.clair;
  g.fillRect(x + joint.largeur, y0, 1, h);
  if (joint.bouts) g.fillRect(x, y0 + joint.largeur, l, 1);
  g.restore();
}

// Parquet en chêne naturel vitrifié : lames de 14 cm posées à l'anglaise (longueurs de 50 cm à 1,90 m, bouts
// décalés), dans le sens nord-sud. Un motif = 12 lames × 3,36 m. Renvoie { map, relief }.
export function parquet() {
  const pxParM = 600;
  return lames({
    largeur: 12 * 84,
    hauteur: Math.round(3.36 * pxParM),
    colonnes: 12,
    pxParM,
    graine: 41,
    joint: { largeur: 2, bouts: true },
    segments: (r, H) => {
      // depuis un départ au hasard, des lames bout à bout jusqu'à avoir fait le tour de la hauteur
      const out = [];
      let a = r() * H;
      const fin = a + H;
      while (a < fin) {
        let h = (0.5 + r() * 1.4) * pxParM;
        if (fin - (a + h) < 0.35 * pxParM) h = fin - a; // pas de petit bout de lame
        out.push([a, h]);
        a += h;
      }
      return out.map(([a, h]) => [a % H, h]);
    },
    bois: {
      tons: ['#c4a078', '#bf9a70', '#caa77f', '#b9946a', '#c29d74', '#ccab84'],
      clair: '#dcc09a',
      fonce: '#8f6a44',
      fil: '#86603b',
      joint: '#4f3720',
      noeud: '#6b4a2b',
      densite: 0.42,
      alphaFil: 0.16,
      flammes: 0.55,
      noeuds: 0.07,
      tailleNoeud: 1.5,
      pores: 0.0016,
    },
  });
}

// Le tapis tufté tête de Miffy : bouclette blanche, contour noir épais, yeux et bouche en croix noirs (la
// silhouette et les traits sont dans src/modeles/miffy.js). Les boucles sont des cellules de 3,5 mm (bruit de
// Worley) : claires au sommet, sombres dans les creux ; la limite entre noir et blanc suit les boucles, un peu
// floue, comme sur un vrai tapis tufté. Renvoie { map, relief } ; coordonnées de texture = les bornes du tapis.
export function tapisMiffy() {
  const champ = champMiffy();
  const { x0, y0, x1, y1 } = champ;
  const pxParM = 800;
  const w = Math.round((x1 - x0) * pxParM);
  const h = Math.round((y1 - y0) * pxParM);
  const cellule = 0.0035;
  const hash = (i, j, k) => {
    let n = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  // la boucle sous un point : 1 à son sommet, 0 entre deux boucles ; et l'identifiant de la boucle
  const boucle = (x, y) => {
    const ci = Math.floor(x / cellule);
    const cj = Math.floor(y / cellule);
    let best = Infinity;
    let id = 0;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const px = (ci + a + 0.15 + 0.7 * hash(ci + a, cj + b, 1)) * cellule;
        const py = (cj + b + 0.15 + 0.7 * hash(ci + a, cj + b, 2)) * cellule;
        const d = Math.hypot(x - px, y - py);
        if (d < best) {
          best = d;
          id = hash(ci + a, cj + b, 3);
        }
      }
    }
    return [Math.max(0, 1 - (best / (cellule * 0.75)) ** 1.6), id];
  };
  const couleur = document.createElement('canvas');
  couleur.width = w;
  couleur.height = h;
  const relief = document.createElement('canvas');
  relief.width = w;
  relief.height = h;
  const gc = couleur.getContext('2d');
  const gr = relief.getContext('2d');
  const ic = gc.createImageData(w, h);
  const ir = gr.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const y = y1 - (j + 0.5) / pxParM; // la ligne du haut de l'image = le haut du tapis
    for (let i = 0; i < w; i++) {
      const x = x0 + (i + 0.5) / pxParM;
      const [v, id] = boucle(x, y);
      // noir : le contour (la limite suit les boucles) ou un trait du visage
      const d = champ.lire(x, y);
      const t = traitsMiffy(x, y);
      const flou = (id - 0.5) * 0.004;
      const noir = d + flou > -MIFFY.contour || t + flou * 0.5 < 0 || coutureMiffy(x + flou, y);
      let r, g, b;
      if (noir) {
        const k = 26 + 30 * v * v + id * 8;
        [r, g, b] = [k, k * 0.97, k * 1.1];
      } else {
        const k = 0.83 + 0.17 * v - id * 0.035;
        [r, g, b] = [246 * k, 243 * k, 236 * k];
      }
      const p = (j * w + i) * 4;
      ic.data[p] = r;
      ic.data[p + 1] = g;
      ic.data[p + 2] = b;
      ic.data[p + 3] = 255;
      const q = 70 + 185 * v;
      ir.data[p] = ir.data[p + 1] = ir.data[p + 2] = q;
      ir.data[p + 3] = 255;
    }
  }
  gc.putImageData(ic, 0, 0);
  gr.putImageData(ir, 0, 0);
  const vers = (canvas, couleurs) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = couleurs ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: vers(couleur, true), relief: vers(relief, false) };
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
