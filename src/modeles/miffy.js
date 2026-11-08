// Le tapis tufté tête de Miffy (d'après ta photo) : sa silhouette et ses traits, partagés par le modèle 3D
// (src/modeles/reve.js : le relief) et sa texture (src/textures.js : la bouclette blanche, le contour noir).
//
// Repère du tapis, en mètres : x vers la droite, y vers le haut de la tête (vers les oreilles), origine au
// centre de la tête. La tête est une super-ellipse un peu plus large que haute ; les deux oreilles sont des
// ellipses allongées, la gauche presque droite, la droite penchée vers l'extérieur (en V, comme sur la photo).
// Leur pied est dans la tête ; là où elles se touchent presque, le creux entre elles est comblé (une
// « fermeture » de 2 cm) : c'est l'encoche noire entre les oreilles.

export const MIFFY = {
  bornes: { x0: -0.35, y0: -0.29, x1: 0.35, y1: 0.67 },
  tete: { rx: 0.3, ry: 0.25, n: 2.4 },
  oreilles: [
    { x: -0.095, y: 0.37, rx: 0.095, ry: 0.23, penche: 0.08 }, // penche > 0 : le bout part vers la gauche
    { x: 0.095, y: 0.375, rx: 0.095, ry: 0.23, penche: -0.22 },
  ],
  fermeture: 0.02,
  contour: 0.03, // la largeur du contour noir
  epaisseur: 0.016, // la hauteur de la bouclette
  // les yeux (ovales verticaux) et la bouche en croix (deux traits arrondis)
  yeux: [
    { x: -0.135, y: -0.06, rx: 0.022, ry: 0.027 },
    { x: 0.135, y: -0.06, rx: 0.022, ry: 0.027 },
  ],
  bouche: { x: 0, y: -0.158, demi: 0.042, angle: 0.55, trait: 0.0105 },
};

// --- Transformée de distance exacte (Felzenszwalb & Huttenlocher), sur une grille ---
function distance1D(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
// distance (en cases) de chaque case à la plus proche case « vraie » de `masque`
function distances(masque, nx, ny) {
  const INF = 1e20;
  const g = new Float64Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) g[i] = masque[i] ? 0 : INF;
  const n = Math.max(nx, ny);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) f[y] = g[y * nx + x];
    distance1D(f, ny, d, v, z);
    for (let y = 0; y < ny; y++) g[y * nx + x] = d[y];
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) f[x] = g[y * nx + x];
    distance1D(f, nx, d, v, z);
    for (let x = 0; x < nx; x++) g[y * nx + x] = Math.sqrt(d[x]);
  }
  return g;
}
// distance signée (en mètres, négative dedans) au bord de `dedans`
function signee(dedans, nx, ny, pas) {
  const dehors = dedans.map((b) => (b ? 0 : 1));
  const versDedans = distances(dedans, nx, ny);
  const versDehors = distances(dehors, nx, ny);
  const s = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) s[i] = (dedans[i] ? -(versDehors[i] - 0.5) : versDedans[i] - 0.5) * pas;
  return s;
}

const dansTete = (x, y) => {
  const { rx, ry, n } = MIFFY.tete;
  return Math.abs(x / rx) ** n + Math.abs(y / ry) ** n <= 1;
};
const dansOreille = (x, y, o) => {
  const [c, s] = [Math.cos(o.penche), Math.sin(o.penche)];
  const [dx, dy] = [x - o.x, y - o.y];
  const u = dx * c + dy * s; // dans le repère de l'oreille (tournée de `penche`)
  const w = -dx * s + dy * c;
  return (u / o.rx) ** 2 + (w / o.ry) ** 2 <= 1;
};

let cache = null;
// Le champ de distance signée de la silhouette (grille de 2,5 mm), avec de quoi le lire n'importe où
// (interpolation bilinéaire) et sa pente (pour ramener un point sur le bord).
export function champMiffy() {
  if (cache) return cache;
  const pas = 0.0025;
  const { x0, y0, x1, y1 } = MIFFY.bornes;
  const nx = Math.round((x1 - x0) / pas);
  const ny = Math.round((y1 - y0) / pas);
  const centre = (i, j) => [x0 + (i + 0.5) * pas, y0 + (j + 0.5) * pas];
  const brut = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [x, y] = centre(i, j);
      brut[j * nx + i] = dansTete(x, y) || MIFFY.oreilles.some((o) => dansOreille(x, y, o)) ? 1 : 0;
    }
  }
  // fermeture : on gonfle de r puis on dégonfle de r (les creux plus étroits que 2r sont comblés)
  const r = MIFFY.fermeture;
  const s0 = signee(brut, nx, ny, pas);
  const gonfle = s0.map((d) => (d <= r ? 1 : 0));
  const s1 = signee(Uint8Array.from(gonfle), nx, ny, pas);
  const ferme = Uint8Array.from(s1, (d) => (d <= -r ? 1 : 0));
  const s = signee(ferme, nx, ny, pas);
  const lire = (x, y) => {
    const fi = Math.min(nx - 1.001, Math.max(0, (x - x0) / pas - 0.5));
    const fj = Math.min(ny - 1.001, Math.max(0, (y - y0) / pas - 0.5));
    const [i, j] = [Math.floor(fi), Math.floor(fj)];
    const [a, b] = [fi - i, fj - j];
    const k = j * nx + i;
    return (s[k] * (1 - a) + s[k + 1] * a) * (1 - b) + (s[k + nx] * (1 - a) + s[k + nx + 1] * a) * b;
  };
  const pente = (x, y) => {
    const e = pas;
    const gx = (lire(x + e, y) - lire(x - e, y)) / (2 * e);
    const gy = (lire(x, y + e) - lire(x, y - e)) / (2 * e);
    const l = Math.hypot(gx, gy) || 1;
    return [gx / l, gy / l];
  };
  cache = { lire, pente, ...MIFFY.bornes };
  return cache;
}

// Distance signée aux traits noirs du visage (les yeux et la bouche), négative dedans.
export function traitsMiffy(x, y) {
  let d = Infinity;
  for (const o of MIFFY.yeux) d = Math.min(d, (Math.hypot((x - o.x) / o.rx, (y - o.y) / o.ry) - 1) * Math.min(o.rx, o.ry));
  const b = MIFFY.bouche;
  for (const a of [b.angle, -b.angle]) {
    // un trait arrondi, centré sur la bouche, incliné de ±angle
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const [dx, dy] = [x - b.x, y - b.y];
    const t = Math.max(-b.demi, Math.min(b.demi, dx * c + dy * s));
    d = Math.min(d, Math.hypot(dx - t * c, dy - t * s) - b.trait);
  }
  return d;
}

// Distance signée (approchée) au bord d'une oreille, négative dedans (ellipse : d ≈ k0 (k0 − 1) / k1).
function distanceOreille(x, y, o) {
  const [c, s] = [Math.cos(o.penche), Math.sin(o.penche)];
  const [dx, dy] = [x - o.x, y - o.y];
  const u = dx * c + dy * s;
  const w = -dx * s + dy * c;
  const k0 = Math.hypot(u / o.rx, w / o.ry);
  const k1 = Math.hypot(u / (o.rx * o.rx), w / (o.ry * o.ry)) || 1e-9;
  return (k0 * (k0 - 1)) / k1;
}

// Le trait noir entre les oreilles : chaque oreille a son contour, et là où elles se touchent, les deux
// contours se rejoignent en un trait qui descend jusqu'au haut de la tête (au-dessus de son bord, moins une
// demi-largeur de contour). Vrai sur ce trait.
export function coutureMiffy(x, y) {
  const c = MIFFY.contour;
  const [g, d] = MIFFY.oreilles;
  if (distanceOreille(x, y, g) < -0.8 * c || distanceOreille(x, y, d) < -0.8 * c) return false; // dans le blanc d'une oreille
  const { rx, ry, n } = MIFFY.tete;
  if (Math.abs(x) >= rx) return false;
  const haut = ry * (1 - Math.abs(x / rx) ** n) ** (1 / n); // le bord du haut de la tête à cet x
  return y > haut - c / 2 && x > g.x && x < d.x;
}
