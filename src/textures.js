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

// La trame du voilage (le rideau de la chambre de rêve) : un lin léger, quelques fils plus épais (les flammes du
// lin) dans le sens de la hauteur et une trame fine en travers. En niveaux de gris très clairs : elle module la
// couleur du rideau. Un motif = 8 × 8 cm ; les coordonnées de texture du rideau sont en mètres de tissu.
export function voilage() {
  const t = creer(256, 256, (g, w, h) => {
    const r = aleatoire(29);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.015 + r() * 0.035;
      g.fillStyle = r() < 0.7 ? '#8a8378' : '#ffffff';
      g.fillRect(r() * w, 0, 0.6 + r() * (r() < 0.1 ? 2.5 : 1), h);
    }
    for (let j = 0; j < h; j += 2) {
      g.globalAlpha = 0.025 + r() * 0.03;
      g.fillStyle = '#8a8378';
      g.fillRect(0, j, w, 1);
    }
    g.globalAlpha = 1;
  });
  t.repeat.set(1 / 0.08, 1 / 0.08);
  return t;
}

// --- Les écrans du coin bureau du studio ---
// Le Macintosh Plus, branché en terminal série sur le Raspberry Pi du rack : il surveille le stockage du NAS, en noir
// et blanc comme sur l'écran d'origine (512 × 342 points). La barre des menus, une fenêtre de Terminal à la barre de
// titre rayée et, dedans : le pool de disques et son remplissage, ses quatre dossiers, les quatre disques
// (température, voyant d'activité), le graphique des lectures et des écritures qui défile, le journal des
// sauvegardes et l'invite, au curseur qui clignote. L'écran vit : les débits suivent une marche au hasard (avec des
// rafales), les voyants clignotent, l'heure avance, une ligne de journal arrive de temps en temps.
// Tout est dessiné en vrais points noirs et blancs (le texte est seuillé), puis agrandi deux fois sur la texture, au
// milieu du verre noir du tube. Les proportions de la texture sont celles de la vitre (19 × 14,8 cm), la zone
// allumée celles de l'image (16,5 × 11 cm). Renvoie la texture et `maj(t)`, à appeler à chaque image (t en secondes) :
// l'écran n'est redessiné que deux fois par seconde.
export function moniteurNas() {
  const [LV, HV] = [0.19, 0.148];
  const [LA, HA] = [0.165, 0.11];
  const [PW, PH] = [512, 342];
  const k = 2; // pixels de texture par point
  const w = Math.round((PW * k * LV) / LA);
  const h = Math.round((PH * k * HV) / HA);
  const x0 = Math.round((w - PW * k) / 2);
  const y0 = Math.round((h - PH * k) / 2);
  const ecran = document.createElement('canvas');
  ecran.width = PW;
  ecran.height = PH;
  const g = ecran.getContext('2d', { willReadFrequently: true });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // les trois teintes du tube : le blanc et le noir des points, le gris uni du bureau (la trame d'origine, un point
  // sur deux, ferait un moiré)
  const [BLANC, NOIR, GRIS] = [[233, 238, 240], [20, 22, 21], [127, 132, 134]];
  const BUREAU = '#ff0000'; // couleur témoin du bureau, remplacée par le gris au seuillage

  // --- l'état du NAS ---
  const r = aleatoire(91);
  const NE = 156; // échantillons du graphique (3 points chacun)
  const lecture = [];
  const ecriture = [];
  let [lu, ecrit, rafaleL, rafaleE] = [60, 20, 0, 0];
  const avancer = () => {
    // une marche au hasard, et de temps en temps une rafale : une lecture (un film, une copie), une écriture (une
    // sauvegarde), chacune à son rythme
    if (rafaleL <= 0 && r() < 0.05) rafaleL = 4 + Math.floor(r() * 9);
    if (rafaleE <= 0 && r() < 0.03) rafaleE = 6 + Math.floor(r() * 12);
    lu = Math.max(2, Math.min(240, lu + ((rafaleL > 0 ? 190 : 35) - lu) * 0.25 + (r() - 0.5) * 40));
    ecrit = Math.max(1, Math.min(160, ecrit + ((rafaleE > 0 ? 120 : 10) - ecrit) * 0.3 + (r() - 0.5) * 16));
    rafaleL--;
    rafaleE--;
    lecture.push(lu);
    ecriture.push(ecrit);
    if (lecture.length > NE) {
      lecture.shift();
      ecriture.shift();
    }
  };
  for (let i = 0; i < NE; i++) avancer();
  const disques = [
    { nom: 'sda', modele: 'WD Red Plus 4 To', temp: 36 },
    { nom: 'sdb', modele: 'WD Red Plus 4 To', temp: 37 },
    { nom: 'sdc', modele: 'IronWolf 4 To', temp: 38 },
    { nom: 'sdd', modele: 'IronWolf 4 To', temp: 36 },
  ];
  const dossiers = [
    ['photos', 2.41],
    ['musique', 0.61],
    ['films', 3.07],
    ['sauvegardes', 1.48],
  ];
  const TOTAL = 10.9; // To utiles : quatre disques de 4 To en raidz1
  let utilise = 8.13;
  const evenements = [
    () => 'sauvegarde MacBook -> tank/sauvegardes  ok',
    () => `immich : ${12 + Math.floor(r() * 40)} photos importées`,
    () => 'rsync ThinkPad -> tank/sauvegardes  ok',
    (d) => `instantané tank@auto-${d}`,
    () => {
      const q = disques[Math.floor(r() * disques.length)];
      return `smart ${q.nom}  ${q.temp}°C  ok`;
    },
    () => 'scrub tank  0 erreur',
    () => 'onduleur : secteur ok, batterie 100 %',
    () => `musique : ${1 + Math.floor(r() * 3)} CD rippés en flac`,
  ];
  const deux = (n) => String(n).padStart(2, '0');
  const heure = (d) => `${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
  const journal = [];
  let prochain = 0;
  const noter = (d) => {
    const e = evenements[prochain++ % evenements.length];
    journal.push(`${heure(d)}  ${e(`${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}`)}`);
    if (journal.length > 4) journal.shift();
  };
  {
    const d = new Date();
    for (let i = 4; i > 0; i--) noter(new Date(d - i * 41000));
  }
  const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  // --- le dessin, en points ---
  const POLICE = 'Monaco, Menlo, "DejaVu Sans Mono", monospace';
  const texte = (t, x, y, { gras = false, taille = 10, droite = false } = {}) => {
    g.font = `${gras ? 'bold ' : ''}${taille}px ${POLICE}`;
    g.fillStyle = '#000';
    g.textBaseline = 'top';
    g.fillText(t, droite ? x - g.measureText(t).width : x, y);
  };
  const cadre = (x, y, l, hh) => {
    g.fillStyle = '#000';
    g.fillRect(x, y, l, 1);
    g.fillRect(x, y + hh - 1, l, 1);
    g.fillRect(x, y, 1, hh);
    g.fillRect(x + l - 1, y, 1, hh);
  };
  const jauge = (x, y, l, hh, f) => {
    cadre(x, y, l, hh);
    g.fillStyle = '#000';
    g.fillRect(x + 2, y + 2, Math.round((l - 4) * f), hh - 4);
  };
  // la pomme de la barre des menus, point par point
  const POMME = ['......##..', '.....##...', '..##.####.', '.#########', '#########.', '########..', '########..', '#########.', '.#########', '..##...##.'];
  const fr = (x, d = 2) => x.toFixed(d).replace('.', ',');
  let curseur = true;
  const dessiner = (d) => {
    g.fillStyle = BUREAU;
    g.fillRect(0, 0, PW, PH);
    // la barre des menus
    g.fillStyle = '#fff';
    g.fillRect(0, 0, PW, 19);
    g.fillStyle = '#000';
    g.fillRect(0, 19, PW, 1);
    POMME.forEach((ligne, j) => [...ligne].forEach((q, i) => q === '#' && g.fillRect(14 + i, 5 + j, 1, 1)));
    let xm = 40;
    for (const titre of ['Fichier', 'Édition', 'Session', 'Réglages']) {
      texte(titre, xm, 4, { gras: true, taille: 11 });
      xm += g.measureText(titre).width + 18;
    }
    // la fenêtre du Terminal, et son ombre
    const [fx, fy, fl, fh] = [6, 26, 498, 310];
    g.fillStyle = '#000';
    g.fillRect(fx + 2, fy + 2, fl, fh);
    g.fillStyle = '#fff';
    g.fillRect(fx, fy, fl, fh);
    cadre(fx, fy, fl, fh);
    // la barre de titre rayée, la case de fermeture, le titre dans son cartouche blanc
    g.fillStyle = '#000';
    for (let j = 0; j < 6; j++) g.fillRect(fx + 2, fy + 4 + j * 2, fl - 4, 1);
    g.fillRect(fx, fy + 19, fl, 1);
    g.fillStyle = '#fff';
    g.fillRect(fx + 8, fy + 3, 13, 13);
    cadre(fx + 9, fy + 4, 11, 11);
    const titre = 'Terminal — nas.local';
    g.font = `bold 11px ${POLICE}`;
    const lt = g.measureText(titre).width + 16;
    g.fillStyle = '#fff';
    g.fillRect(fx + (fl - lt) / 2, fy + 2, lt, 16);
    texte(titre, fx + fl / 2 - (lt - 16) / 2, fy + 4, { gras: true, taille: 11 });
    // — le contenu —
    const X = fx + 10;
    const XD = fx + fl - 10;
    let y = fy + 25;
    texte('nas.local — stockage', X, y, { gras: true });
    texte(`${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}  ${heure(d)}`, XD, y, { droite: true });
    y += 15;
    texte(`pool tank   raidz1   ONLINE`, X, y);
    texte(`${fr(utilise)} / ${fr(TOTAL, 1)} To   ${Math.round((100 * utilise) / TOTAL)} %`, XD, y, { droite: true });
    y += 13;
    jauge(X, y, XD - X, 14, utilise / TOTAL);
    y += 20;
    // les dossiers du pool
    dossiers.forEach(([nom, to], i) => {
      const yy = y + i * 12;
      texte(`tank/${nom}`, X, yy);
      jauge(X + 110, yy + 2, 150, 8, to / 3.5);
      texte(`${fr(to)} To`, X + 312, yy, { droite: true });
    });
    // les disques, à droite des dossiers
    disques.forEach((q, i) => {
      const yy = y + i * 12;
      const xq = X + 330;
      texte(q.nom, xq, yy, { gras: true });
      texte(`${q.temp}°C`, xq + 26, yy);
      // le voyant d'activité : plein quand le disque travaille
      if (q.actif) {
        g.fillStyle = '#000';
        g.fillRect(XD - 8, yy + 2, 8, 8);
      } else cadre(XD - 8, yy + 2, 8, 8);
      texte(q.modele.split(' ')[0] === 'WD' ? 'WD Red' : 'IronWolf', XD - 14, yy, { droite: true });
    });
    y += 4 * 12 + 6;
    g.fillStyle = '#000';
    g.fillRect(X, y, XD - X, 1);
    y += 5;
    // le graphique des entrées-sorties : les lectures montent, les écritures descendent
    const [l, e] = [lecture.at(-1), ecriture.at(-1)];
    texte('E/S', X, y, { gras: true });
    texte(`lecture ${Math.round(l)} Mo/s`, X + 40, y);
    texte(`écriture ${Math.round(e)} Mo/s`, X + 190, y);
    texte('5 min', XD, y, { droite: true });
    y += 13;
    const HG = 34; // la demi-hauteur du graphique
    const yM = y + HG;
    cadre(X, y, XD - X, 2 * HG + 1);
    g.fillStyle = '#000';
    for (let i = 0; i < lecture.length; i++) {
      const x = X + 2 + i * 3;
      if (x + 2 > XD - 2) break;
      const hl = Math.round((lecture[i] / 240) * (HG - 2));
      const he = Math.round((ecriture[i] / 240) * (HG - 2));
      g.fillRect(x, yM - hl, 2, hl);
      g.fillRect(x, yM + 1, 2, he);
    }
    // la ligne du milieu, en pointillés
    for (let x = X + 2; x < XD - 2; x += 4) g.fillRect(x, yM, 2, 1);
    y += 2 * HG + 7;
    g.fillRect(X, y, XD - X, 1);
    y += 5;
    // le journal, et l'invite
    journal.forEach((ligne, i) => texte(ligne, X, y + i * 12));
    y += 4 * 12 + 2;
    texte('noah@nas:~$ ', X, y);
    if (curseur) {
      g.font = `10px ${POLICE}`;
      g.fillStyle = '#000';
      g.fillRect(X + g.measureText('noah@nas:~$ ').width, y, 6, 11);
    }
    // le seuillage : chaque point devient blanc, noir, ou le gris du bureau
    const img = g.getImageData(0, 0, PW, PH);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const [rr, gg, bb] = [p[i], p[i + 1], p[i + 2]];
      const t = rr > 200 && gg < 60 && bb < 60 ? GRIS : 0.3 * rr + 0.59 * gg + 0.11 * bb < 172 ? NOIR : BLANC;
      [p[i], p[i + 1], p[i + 2]] = t;
    }
    g.putImageData(img, 0, 0);
    // sur la texture : le verre noir du tube, l'image agrandie deux fois, les coins un peu plus sombres
    c.fillStyle = '#0b0c0b';
    c.fillRect(0, 0, w, h);
    c.imageSmoothingEnabled = false;
    c.drawImage(ecran, x0, y0, PW * k, PH * k);
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, w * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
    texture.needsUpdate = true;
  };

  let pas = -1;
  const maj = (t) => {
    const n = Math.floor(t * 2);
    if (n === pas) return;
    const seconde = n >> 1 !== pas >> 1;
    pas = n;
    curseur = n % 2 === 0;
    const d = new Date();
    if (seconde) {
      avancer();
      for (const q of disques) q.actif = r() < 0.25 + lecture.at(-1) / 400;
      utilise += ecriture.at(-1) / 1e6; // (des Mo écrits en une seconde, en To)
      if (r() < 0.12) noter(d);
    }
    dessiner(d);
  };
  maj(0);
  return { texture, maj };
}

// L'écran du ThinkPad posé sur le rack : un tableau de bord de supervision au thème sombre, comme sur ta photo
// (pastilles d'état colorées, courbes et histogrammes, tableaux de chiffres). Rien de lisible de près : des
// formes et des couleurs de tableau de bord.
export function tableauDeBord() {
  return creer(
    1024,
    640,
    (g, w, h) => {
      const r = aleatoire(57);
      g.fillStyle = '#1b1f26';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#262c35';
      g.fillRect(0, 0, w, 34);
      g.fillStyle = '#d64545';
      g.fillRect(14, 9, 64, 16);
      g.fillStyle = '#9aa5b5';
      for (let i = 0; i < 6; i++) g.fillRect(96 + i * 70, 14, 46, 6);
      g.font = 'bold 15px sans-serif';
      g.fillStyle = '#c9d1dc';
      g.fillText('nas.local', w - 120, 22);
      const panneau = (x, y, pw, ph, titre = true) => {
        g.fillStyle = '#222831';
        g.fillRect(x, y, pw, ph);
        g.strokeStyle = '#323a46';
        g.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
        if (titre) {
          g.fillStyle = '#8c97a8';
          g.fillRect(x + 8, y + 8, 60 + r() * 50, 6);
        }
      };
      // en haut : la disponibilité (pastilles) et une barre de recherche
      panneau(12, 46, 480, 150);
      g.fillStyle = '#3b82c4';
      g.fillRect(150, 70, 200, 12);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#5d6878';
        g.fillRect(24, 100 + i * 22, 90, 6);
        g.fillRect(150, 100 + i * 22, 60 + r() * 120, 6);
      }
      panneau(502, 46, 510, 150);
      const etats = ['#5dbb63', '#e05555', '#7fb3d5', '#5dbb63'];
      etats.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(512 + i * 122, 68, 116, 50);
      });
      const gravite = ['#7fb3d5', '#f0c75e', '#f39c4a', '#e8754a', '#e05555', '#97c97a'];
      gravite.forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(512 + i * 81, 130, 76, 52);
      });
      // au milieu : quatre graphiques
      const couleurs = ['#e05555', '#f0a63c', '#4fc3c8', '#5b8def'];
      for (let p = 0; p < 4; p++) {
        const x = 12 + p * 252;
        panneau(x, 206, 244, 190);
        g.strokeStyle = '#323a46';
        for (let l = 0; l < 4; l++) {
          g.beginPath();
          g.moveTo(x + 10, 240 + l * 36);
          g.lineTo(x + 234, 240 + l * 36);
          g.stroke();
        }
        g.fillStyle = couleurs[p];
        for (let b = 0; b < 56; b++) {
          const v = Math.pow(r(), p % 2 ? 1.2 : 3) * (p === 1 ? 120 : 140);
          g.globalAlpha = 0.85;
          g.fillRect(x + 12 + b * 4, 380 - v, 3, v);
        }
        g.globalAlpha = 1;
      }
      // en bas : des tableaux de chiffres
      panneau(12, 406, 600, 222);
      panneau(622, 406, 390, 222);
      for (let l = 0; l < 9; l++) {
        g.fillStyle = l % 2 ? '#262d36' : '#222831';
        g.fillRect(20, 432 + l * 21, 584, 21);
        for (let c = 0; c < 8; c++) {
          g.fillStyle = c === 0 ? '#9aa5b5' : '#6f7b8c';
          g.fillRect(28 + c * 72, 440 + l * 21, 30 + r() * 30, 5);
        }
      }
      for (let l = 0; l < 9; l++) {
        g.fillStyle = '#6f7b8c';
        g.fillRect(632, 440 + l * 21, 200, 5);
        g.fillStyle = l % 3 ? '#5dbb63' : '#f0c75e';
        g.fillRect(960, 438 + l * 21, 36, 9);
      }
    },
    false,
  );
}

// --- La Nintendo 3DS de la console du lit : ses deux écrans sur Pokémon Lune, et ses marquages ---
// L'écran du haut (400 × 240, dessiné en double) : le monde d'Alola vu de derrière le joueur, comme en jeu : le ciel,
// la mer turquoise, la plage, deux palmiers, une case au toit de paille, l'herbe et le chemin de sable, et le
// joueur de dos (bob blanc, haut orangé). Celui du bas (320 × 240) : le Motisma, le Pokédex Rotom, avec ses deux
// grands yeux bleus au-dessus de la carte de l'île de Mele-Mele (villes, routes, ta position, l'objectif). Le cadre
// argenté de l'écran tactile (SELECT, HOME, START, le micro) et les lettres des boutons sont des décalques.
// Renvoie { haut, bas, cadre, lettres: { a, b, x, y }, power, powerNom }.
export function ecrans3ds() {
  const PI = Math.PI;
  const haut = creer(
    800,
    480,
    (g, w, h) => {
      const r = aleatoire(311);
      // le ciel et ses nuages
      const ciel = g.createLinearGradient(0, 0, 0, 150);
      ciel.addColorStop(0, '#6fc0f2');
      ciel.addColorStop(1, '#cdeefc');
      g.fillStyle = ciel;
      g.fillRect(0, 0, w, 150);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [cx, cy, k] of [[120, 52, 1], [520, 34, 0.8], [700, 86, 0.7], [330, 96, 0.55]]) {
        for (const [dx, dy, rx, ry] of [[0, 0, 46, 18], [-34, 8, 30, 14], [36, 6, 34, 15], [10, -12, 30, 16]]) {
          g.beginPath();
          g.ellipse(cx + dx * k, cy + dy * k, rx * k, ry * k, 0, 0, 2 * PI);
          g.fill();
        }
      }
      // une île au loin, la mer turquoise et ses reflets
      g.fillStyle = '#62a98d';
      g.beginPath();
      g.moveTo(560, 150);
      g.quadraticCurveTo(640, 112, 730, 150);
      g.fill();
      const mer = g.createLinearGradient(0, 150, 0, 238);
      mer.addColorStop(0, '#1d86c4');
      mer.addColorStop(1, '#45cbdc');
      g.fillStyle = mer;
      g.fillRect(0, 150, w, 90);
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 70; i++) g.fillRect(r() * w, 155 + r() * 75, 6 + r() * 14, 2);
      // la plage, l'écume
      g.fillStyle = '#f3e1ad';
      g.fillRect(0, 236, w, 70);
      g.fillStyle = '#e4cd92';
      g.fillRect(0, 236, w, 12);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 7;
      g.beginPath();
      for (let x = 0; x <= w; x += 10) g.lineTo(x, 238 + 4 * Math.sin(x / 37) + 2 * Math.sin(x / 13));
      g.stroke();
      // l'herbe, tondue en bandes, avec des fleurs
      g.fillStyle = '#79c257';
      g.fillRect(0, 300, w, h - 300);
      g.fillStyle = '#86cd63';
      for (let k = -6; k < 10; k += 2) {
        g.beginPath();
        g.moveTo(400 + k * 30, 300);
        g.lineTo(400 + (k + 1) * 30, 300);
        g.lineTo(400 + (k + 1) * 150, h);
        g.lineTo(400 + k * 150, h);
        g.fill();
      }
      g.fillStyle = '#a4cf6e';
      g.fillRect(0, 298, w, 5);
      // les hautes herbes, en bas à gauche et à droite
      for (const [x0, x1, y0] of [[0, 230, 385], [610, 800, 405]]) {
        g.fillStyle = '#4c9a3b';
        g.fillRect(x0, y0, x1 - x0, h - y0);
        g.strokeStyle = '#3a7f2e';
        g.lineWidth = 3;
        for (let x = x0 + 8; x < x1; x += 16) for (let y = y0 + 14; y < h; y += 22) {
          g.beginPath();
          g.moveTo(x - 5, y + 8);
          g.lineTo(x, y - 6);
          g.lineTo(x + 5, y + 8);
          g.stroke();
        }
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = ['#ffe36b', '#ffffff', '#ff9bc0'][i % 3];
        g.beginPath();
        g.arc(240 + r() * 360, 310 + r() * 160, 3, 0, 2 * PI);
        g.fill();
      }
      // le chemin de sable, qui file vers la plage
      g.fillStyle = '#e9d398';
      g.beginPath();
      g.moveTo(312, h);
      g.lineTo(488, h);
      g.lineTo(424, 300);
      g.lineTo(376, 300);
      g.fill();
      g.strokeStyle = '#d2b675';
      g.lineWidth = 4;
      g.stroke();
      // une case au toit de paille, à droite
      g.fillStyle = '#f6efe0';
      g.fillRect(590, 238, 120, 62);
      g.fillStyle = '#8a5a3a';
      g.fillRect(636, 262, 26, 38);
      g.fillStyle = '#7fc8e8';
      g.fillRect(602, 254, 22, 18);
      g.fillRect(676, 254, 22, 18);
      g.fillStyle = '#c99a5b';
      g.beginPath();
      g.moveTo(574, 242);
      g.lineTo(650, 196);
      g.lineTo(726, 242);
      g.fill();
      g.strokeStyle = '#b0834a';
      g.lineWidth = 2;
      for (let x = 590; x < 712; x += 9) {
        g.beginPath();
        g.moveTo(x, 240);
        g.lineTo(650 + (x - 650) * 0.4, 208);
        g.stroke();
      }
      // deux palmiers
      const palmier = (x, y, haut, penche) => {
        g.strokeStyle = '#9c7148';
        g.lineWidth = 14;
        g.lineCap = 'round';
        const [xt, yt] = [x + penche, y - haut];
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + penche * 0.2, y - haut * 0.6, xt, yt);
        g.stroke();
        g.strokeStyle = '#7e5733';
        g.lineWidth = 2;
        for (let t = 0.12; t < 0.95; t += 0.1) {
          const px = x + (xt - x) * t * t + penche * 0.2 * 2 * t * (1 - t);
          const py = y - haut * (1.2 * t - 0.2 * t * t);
          g.beginPath();
          g.moveTo(px - 7, py);
          g.lineTo(px + 7, py - 3);
          g.stroke();
        }
        for (let k = 0; k < 7; k++) {
          const a = -PI / 2 + (k - 3) * 0.55;
          const L = 74 + (k % 2) * 16;
          g.fillStyle = k % 2 ? '#3f9b4c' : '#2f8040';
          g.beginPath();
          g.moveTo(xt, yt);
          g.quadraticCurveTo(xt + Math.cos(a - 0.3) * L * 0.7, yt + Math.sin(a - 0.3) * L * 0.7 - 10, xt + Math.cos(a) * L, yt + Math.sin(a) * L + 26);
          g.quadraticCurveTo(xt + Math.cos(a + 0.3) * L * 0.6, yt + Math.sin(a + 0.3) * L * 0.6, xt, yt);
          g.fill();
        }
        g.fillStyle = '#6e4f2e';
        for (const [dx, dy] of [[-6, 6], [6, 7], [0, 12]]) {
          g.beginPath();
          g.arc(xt + dx, yt + dy, 6, 0, 2 * PI);
          g.fill();
        }
      };
      palmier(130, 318, 205, 30);
      palmier(520, 290, 150, -22);
      // le joueur, de dos, sur le chemin : son ombre, ses jambes, son short, son haut, son sac, sa tête et son bob
      const [px, py] = [400, 400];
      g.fillStyle = 'rgba(30,60,20,0.28)';
      g.beginPath();
      g.ellipse(px, py + 34, 30, 9, 0, 0, 2 * PI);
      g.fill();
      g.fillStyle = '#f0c49d';
      g.fillRect(px - 13, py + 6, 9, 26);
      g.fillRect(px + 4, py + 6, 9, 26);
      g.fillStyle = '#e8e2d6';
      g.fillRect(px - 15, py + 28, 12, 7);
      g.fillRect(px + 3, py + 28, 12, 7);
      g.fillStyle = '#2f4f9a';
      g.fillRect(px - 17, py - 4, 34, 14);
      g.fillStyle = '#f39a3c';
      g.fillRect(px - 19, py - 36, 38, 34);
      g.fillStyle = '#f0c49d';
      g.fillRect(px - 26, py - 30, 8, 22);
      g.fillRect(px + 18, py - 30, 8, 22);
      g.fillStyle = '#d65a6f';
      g.fillRect(px - 13, py - 34, 26, 24); // le sac à dos
      g.fillStyle = '#3b2a20';
      g.beginPath();
      g.arc(px, py - 52, 20, 0, 2 * PI);
      g.fill();
      g.fillStyle = '#fafafa';
      g.beginPath();
      g.ellipse(px, py - 62, 27, 9, 0, 0, 2 * PI);
      g.fill();
      g.beginPath();
      g.arc(px, py - 64, 17, PI, 0);
      g.fill();
      g.fillStyle = '#e04b4b';
      g.fillRect(px - 17, py - 66, 34, 4);
    },
    false,
  );
  const bas = creer(
    640,
    480,
    (g, w, h) => {
      // le corps rouge-orangé du Motisma
      const fond = g.createLinearGradient(0, 0, 0, h);
      fond.addColorStop(0, '#f2633a');
      fond.addColorStop(1, '#d4432a');
      g.fillStyle = fond;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, 0, w, 26);
      // ses deux grands yeux
      for (const cx of [250, 390]) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(cx, 60, 36, 30, 0, 0, 2 * PI);
        g.fill();
        g.fillStyle = '#5cc8ff';
        g.beginPath();
        g.ellipse(cx, 60, 30, 25, 0, 0, 2 * PI);
        g.fill();
        g.fillStyle = '#1b3d8f';
        g.beginPath();
        g.ellipse(cx, 62, 13, 18, 0, 0, 2 * PI);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(cx - 7, 50, 6, 8, 0, 0, 2 * PI);
        g.fill();
      }
      // la carte : la mer quadrillée dans son cadre blanc
      const [x0, y0, x1, y1] = [36, 112, 604, 444];
      const cadre = new Path2D();
      cadre.roundRect(x0, y0, x1 - x0, y1 - y0, 18);
      g.fillStyle = '#3f86d6';
      g.fill(cadre);
      g.save();
      g.clip(cadre);
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 2;
      for (let x = x0; x < x1; x += 32) {
        g.beginPath();
        g.moveTo(x, y0);
        g.lineTo(x, y1);
        g.stroke();
      }
      for (let y = y0; y < y1; y += 32) {
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.stroke();
      }
      // l'île de Mele-Mele : son sable, son herbe, sa montagne
      const ile = [[150, 330], [170, 250], [230, 205], [300, 190], [360, 175], [430, 190], [505, 230], [540, 290], [520, 350], [455, 395], [380, 410], [300, 405], [220, 385]];
      const tracer = (pts) => {
        g.beginPath();
        pts.forEach(([x, y], i) => {
          const [nx, ny] = pts[(i + 1) % pts.length];
          if (i === 0) g.moveTo((x + nx) / 2, (y + ny) / 2);
          else g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
        });
        const [x, y] = pts[0];
        const [nx, ny] = pts[1];
        g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
        g.closePath();
      };
      tracer(ile);
      g.strokeStyle = '#f1e2a6';
      g.lineWidth = 18;
      g.stroke();
      g.fillStyle = '#82cf60';
      g.fill();
      tracer([[400, 215], [470, 235], [500, 290], [455, 310], [395, 280]]);
      g.fillStyle = '#5fae4a';
      g.fill();
      // les routes et les villes
      g.strokeStyle = '#f6d54b';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(215, 360);
      g.lineTo(300, 330);
      g.lineTo(330, 250);
      g.lineTo(420, 250);
      g.moveTo(300, 330);
      g.lineTo(420, 370);
      g.lineTo(490, 330);
      g.stroke();
      for (const [x, y, s] of [[215, 360, 26], [330, 250, 20], [420, 370, 30], [490, 330, 18]]) {
        g.fillStyle = '#ffffff';
        g.fillRect(x - s / 2, y - s / 2, s, s);
        g.strokeStyle = '#6b7380';
        g.lineWidth = 3;
        g.strokeRect(x - s / 2, y - s / 2, s, s);
      }
      // l'objectif (un drapeau rouge) et ta position (une flèche bleue)
      g.strokeStyle = '#5b3a28';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(420, 252);
      g.lineTo(420, 214);
      g.stroke();
      g.fillStyle = '#e8343a';
      g.beginPath();
      g.moveTo(420, 214);
      g.lineTo(446, 224);
      g.lineTo(420, 234);
      g.fill();
      g.fillStyle = '#2f6cf2';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(300, 312);
      g.lineTo(316, 348);
      g.lineTo(300, 340);
      g.lineTo(284, 348);
      g.closePath();
      g.stroke();
      g.fill();
      g.restore();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 6;
      g.stroke(cadre);
      // le nom de l'île, en haut à gauche de la carte
      g.font = 'bold 30px "Trebuchet MS", "Arial Rounded MT Bold", sans-serif';
      g.lineJoin = 'round';
      g.lineWidth = 7;
      g.strokeStyle = '#1e3c74';
      g.strokeText('Mele-Mele', 58, 156);
      g.fillStyle = '#ffffff';
      g.fillText('Mele-Mele', 58, 156);
      // deux boutons ronds en bas
      for (const x of [62, 578]) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(x, 462, 14, 0, 2 * PI);
        g.fill();
        g.fillStyle = '#d4432a';
        g.beginPath();
        g.arc(x, 462, 6, 0, 2 * PI);
        g.fill();
      }
    },
    false,
  );
  // le cadre de l'écran tactile (72,5 × 60,5 mm, 8 px par mm) : argenté, la vitre noire, les trois touches et le micro
  const cadre = creer(
    580,
    484,
    (g, w, h) => {
      const f = g.createLinearGradient(0, 0, 0, h);
      f.addColorStop(0, '#e9ecef');
      f.addColorStop(1, '#d3d7dc');
      g.fillStyle = f;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#f7f8fa';
      g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, h - 4);
      g.fillStyle = '#0b0c0f';
      g.beginPath();
      g.roundRect(32, 13, 516, 394, 6);
      g.fill();
      const touche = (x, l, texte, maison) => {
        g.fillStyle = '#e4e7eb';
        g.strokeStyle = '#b9bec5';
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(x - l / 2, 430, l, 26, 4);
        g.fill();
        g.stroke();
        g.fillStyle = '#5f656d';
        g.font = 'bold 15px Helvetica, Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(texte, x + (maison ? 10 : 0), 444);
        if (maison) {
          const [hx, hy] = [x - 30, 444];
          g.beginPath();
          g.moveTo(hx - 8, hy);
          g.lineTo(hx, hy - 8);
          g.lineTo(hx + 8, hy);
          g.lineTo(hx + 5, hy);
          g.lineTo(hx + 5, hy + 7);
          g.lineTo(hx - 5, hy + 7);
          g.lineTo(hx - 5, hy);
          g.closePath();
          g.fill();
        }
      };
      touche(113, 104, 'SELECT');
      touche(290, 114, 'HOME', true);
      touche(464, 109, 'START');
      g.fillStyle = '#1a1b1f';
      g.fillRect(522, 470, 8, 7); // le micro
    },
    false,
  );
  // les lettres grises des boutons, POWER et son pictogramme : sur fond transparent
  const marque = (l, h, dessiner) =>
    creer(
      l,
      h,
      (g) => {
        g.fillStyle = '#8f959c';
        g.strokeStyle = '#8f959c';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        dessiner(g);
      },
      false,
    );
  const lettres = Object.fromEntries(
    ['a', 'b', 'x', 'y'].map((c) => [
      c,
      marque(64, 64, (g) => {
        g.font = 'bold 44px Helvetica, Arial, sans-serif';
        g.fillText(c.toUpperCase(), 32, 35);
      }),
    ]),
  );
  const power = marque(64, 64, (g) => {
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(32, 34, 16, -PI / 2 + 0.6, -PI / 2 - 0.6 + 2 * PI);
    g.stroke();
    g.beginPath();
    g.moveTo(32, 12);
    g.lineTo(32, 30);
    g.stroke();
  });
  const powerNom = marque(224, 48, (g) => {
    g.font = '30px Helvetica, Arial, sans-serif';
    g.fillText('POWER', 112, 26);
  });
  return { haut, bas, cadre, lettres, power, powerNom };
}

// Le dessus du couvercle du coffre en osier : un tressage serré, des brins plats qui passent deux par-dessus, deux
// par-dessous (un sergé), chacun ombré comme un brin rond, avec son relief (bumpMap). Un motif qui se répète tous
// les 6 cm environ : le programme règle la répétition.
export function osierTresse() {
  const N = 8; // brins par motif, dans chaque sens
  const T = 256;
  const p = T / N;
  const dessiner = (g, relief) => {
    g.fillStyle = relief ? '#000' : '#cfc4ab';
    g.fillRect(0, 0, T, T);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        // sergé 2/2 : le brin horizontal passe dessus deux fois, puis dessous deux fois, décalé d'un cran à chaque rang
        const horizontal = (i + j) % 4 < 2;
        const [x, y] = [j * p, i * p];
        const grad = horizontal ? g.createLinearGradient(0, y, 0, y + p) : g.createLinearGradient(x, 0, x + p, 0);
        if (relief) {
          grad.addColorStop(0, '#202020');
          grad.addColorStop(0.5, '#ffffff');
          grad.addColorStop(1, '#202020');
        } else {
          grad.addColorStop(0, '#ddd3be');
          grad.addColorStop(0.45, '#fbf7ee');
          grad.addColorStop(1, '#d8cdb5');
        }
        g.fillStyle = grad;
        g.fillRect(x + 0.6, y + 0.6, p - 1.2, p - 1.2);
      }
    }
  };
  const map = creer(T, T, (g) => dessiner(g, false));
  const relief = creer(T, T, (g) => dessiner(g, true));
  relief.colorSpace = THREE.NoColorSpace;
  return { map, relief };
}

// Le logo Brandt du bas de l'écran : le nom en lettres argentées, sur fond transparent.
export function logoBrandt() {
  return creer(
    256,
    52,
    (g, w, h) => {
      g.fillStyle = '#d4d7dc';
      g.font = 'bold 40px "Helvetica Neue", Helvetica, Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Brandt', w / 2, h / 2 + 2);
    },
    false,
  );
}

// Les afficheurs du rack : des chiffres blancs lumineux sur fond bleu nuit (`lignes` : [texte, taille relative]).
export function afficheur(lignes, l = 256, h = 128) {
  return creer(
    l,
    h,
    (g) => {
      g.fillStyle = '#0d1a2b';
      g.fillRect(0, 0, l, h);
      g.fillStyle = '#e8f3ff';
      g.textBaseline = 'middle';
      lignes.forEach(([texte, x, y, taille]) => {
        g.font = `bold ${taille}px monospace`;
        g.fillText(texte, x, y);
      });
    },
    false,
  );
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
