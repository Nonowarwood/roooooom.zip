import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { aleatoire, couette } from '../textures.js';

// Outils pour fabriquer les meubles en 3D, dans l'esprit des modèles de la
// référence : pas de textures de bois, des couleurs unies et mates, et tout le
// détail dans la géométrie (lames, tressage, charnières, vis, bords arrondis…).
// À la fin, chaque modèle est fusionné en UN maillage par matériau (`fusionner`),
// ce qui donne des fichiers légers et rapides à afficher.
// Convention : mètres, y = 0 au sol, origine au centre du meuble au sol.

// --- Matériaux : couleurs unies ---

export function creerMateriaux() {
  // Comme la référence : tout est mat (rugosité 0,9, pas de métal sauf une pointe pour les
  // pièces chromées) et les couleurs sont adoucies, pastel, mais restent reconnaissables.
  const std = (couleur, extra = {}) => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.9, metalness: 0, ...extra });
  const verre = (couleur, opacite) =>
    new THREE.MeshStandardMaterial({ color: couleur, transparent: true, opacity: opacite, roughness: 0.15, metalness: 0, depthWrite: false });
  const metal = (couleur) => std(couleur, { roughness: 0.6, metalness: 0.15 });
  const unis = {};
  const m = {
    // bois : un ton de base, un plus foncé pour les chants et les creux, un plus clair
    chene: std('#e3c08f'),
    cheneFonce: std('#cfa874'),
    cheneClair: std('#efd7ae'),
    commode: std('#e6c493'),
    bouleau: std('#f0e2b6'),
    bouleauFonce: std('#e0cf9c'),
    bouleauClair: std('#f6ecce'),
    boisFlotte: std('#b09578'),
    boisFlotteClair: std('#c7ad92'),
    acajou: std('#dcab72'),
    acajouFonce: std('#c68f55'),
    vert: std('#a8bf92'),
    vertFonce: std('#93ac7d'),
    // osier
    osier: std('#f7f3ea'),
    osierFonce: std('#e6dfcf'),
    osierPaille: std('#d8be96'),
    // carton
    carton: std('#dcc7a3'),
    cartonFonce: std('#c4ac85'),
    ruban: std('#eadcb9'),
    // tissus
    couette: std('#ffffff', { map: couette(), roughness: 0.95 }),
    ourlet: std('#c97aa0', { roughness: 0.95 }),
    drap: std('#f7f2ea', { roughness: 0.95 }),
    oreillerOrange: std('#f8bd72', { roughness: 0.95 }),
    oreillerOrangeFonce: std('#e0a255', { roughness: 0.95 }),
    oreillerRouge: std('#f0907a', { roughness: 0.95 }),
    oreillerRougeFonce: std('#d97862', { roughness: 0.95 }),
    veste: std('#cdb8a6', { roughness: 0.95 }),
    vesteFonce: std('#b8a28f', { roughness: 0.95 }),
    // plastiques
    noir: std('#3d3b4c'),
    noirMat: std('#46445a'),
    plastique: std('#5d5b72'),
    blanc: std('#fbfaf8'),
    creme: std('#f8f3ec'),
    papier: std('#f6f2ea', { side: THREE.DoubleSide }),
    encre: std('#7d7f8a'),
    // métaux et chrome : des gris-bleu clairs
    metal: metal('#c9d2d6'),
    metalFonce: metal('#a3acb4'),
    metalClair: metal('#e1e7ea'),
    chrome: metal('#d6dde1'),
    gris: std('#c8cfd3'), // tubes peints en gris clair
    grillage: metal('#b9c1c8'),
    pale: std('#6d6b80'),
    grisVert: std('#b4c4b0'),
    laiton: metal('#e0c179'),
    // verres et écran
    verre: verre('#d2e4e6', 0.22),
    verreBureau: verre('#dbeadd', 0.3),
    verreDepoli: std('#f1f3f1', { roughness: 0.6 }),
    ecran: std('#1c1c26', { roughness: 0.2 }),
    // pierre
    agate: std('#d9a3a0', { roughness: 0.5 }),
    agateClair: std('#ecccc9', { roughness: 0.5 }),
    agateFonce: std('#b08591', { roughness: 0.5 }),
    agateBleue: std('#8aa6b8', { roughness: 0.5 }),
    // matériau uni de n'importe quelle couleur (créé une seule fois par couleur)
    uni: (couleur) => (unis[couleur] ??= std(couleur)),
  };
  for (const [nom, mat] of Object.entries(m)) if (mat.isMaterial) mat.name = nom;
  return m;
}

// --- Formes ---

function ombres(m) {
  m.castShadow = !m.material.transparent;
  m.receiveShadow = true;
  return m;
}

// Boîte à bords arrondis, posée par son centre-bas : [x, yBas, z].
export function boite([l, h, p], materiau, [x, yBas, z], { r = 0.008, nom, rot } = {}) {
  const rayon = Math.min(r, l / 2.05, h / 2.05, p / 2.05);
  // les très petites pièces et les arêtes minuscules restent de simples boîtes : 12 triangles au lieu de 108
  const simple = rayon < 0.0035 || Math.min(l, h, p) < 0.016;
  const geo = simple ? new THREE.BoxGeometry(l, h, p) : new RoundedBoxGeometry(l, h, p, 1, rayon);
  const m = new THREE.Mesh(geo, materiau);
  m.position.set(x, yBas + h / 2, z);
  if (rot) m.rotation.set(...rot);
  if (nom) m.name = nom;
  return ombres(m);
}

// Cylindre (ou cône tronqué si `dBas`) posé par son centre-bas.
export function cylindre(d, h, materiau, [x, yBas, z], { rot, centre = false, nom, dBas, segments = 16 } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, (dBas ?? d) / 2, h, segments), materiau);
  m.position.set(x, centre ? yBas : yBas + h / 2, z);
  if (rot) m.rotation.set(...rot);
  if (nom) m.name = nom;
  return ombres(m);
}

export function sphere(d, materiau, [x, y, z], { echelle } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(d / 2, d < 0.03 ? 8 : 14, d < 0.03 ? 6 : 10), materiau);
  m.position.set(x, y, z);
  if (echelle) m.scale.set(...echelle);
  return ombres(m);
}

export function tore(d, tube, materiau, [x, y, z], rot) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(d / 2, tube, 5, d > 0.2 ? 36 : 24), materiau);
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  return ombres(m);
}

// Barre ronde entre deux points : cadres, traverses, rayons…
export function barre(a, b, rayon, materiau, segments = 8) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rayon, rayon, dir.length(), segments), materiau);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return ombres(m);
}

// Tube qui suit des points (bras de lampe, supports courbes, câbles…).
export function tube(points, rayon, materiau, segments = 14) {
  const courbe = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return ombres(new THREE.Mesh(new THREE.TubeGeometry(courbe, segments, rayon, 6, false), materiau));
}

// Surface de révolution : profil = liste de [rayon, hauteur]. Visible des deux côtés.
const doubleFace = new WeakMap();
export function tourne(profil, materiau, [x, y, z], { rot, segments = 28 } = {}) {
  if (!doubleFace.has(materiau)) {
    const copie = materiau.clone();
    copie.side = THREE.DoubleSide;
    copie.name = materiau.name;
    doubleFace.set(materiau, copie);
  }
  const g = new THREE.LatheGeometry(
    profil.map(([rr, hh]) => new THREE.Vector2(rr, hh)),
    segments,
  );
  const m = new THREE.Mesh(g, doubleFace.get(materiau));
  m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  return ombres(m);
}

// Boîte « souple » : un volume très subdivisé aux bords arrondis, froissé comme du
// tissu. Sert à la couette, aux oreillers, à la veste. `uvDessus` projette la
// texture vue du dessus (true, ou [x0, x1, z0, z1] en repère du meuble).
export function tissu([l, h, p], materiau, [x, yBas, z], { r = 0.04, froissement = 0.008, graine = 1, uvDessus = false, divisions = [12, 3, 12] } = {}) {
  const geo = new THREE.BoxGeometry(l, h, p, ...divisions);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  const rayon = Math.min(r, l / 2.05, h / 2.05, p / 2.05);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -l / 2 + rayon, l / 2 - rayon),
      THREE.MathUtils.clamp(v.y, -h / 2 + rayon, h / 2 - rayon),
      THREE.MathUtils.clamp(v.z, -p / 2 + rayon, p / 2 - rayon),
    );
    v.sub(c);
    if (v.lengthSq() > 0) v.setLength(rayon);
    v.add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  // plis : quelques ondulations qui se croisent
  const r2 = aleatoire(graine);
  const ondes = Array.from({ length: 4 }, () => ({ fx: 3 + r2() * 7, fz: 3 + r2() * 7, ph: r2() * 6.28, a: 0.4 + r2() * 0.6 }));
  const n = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    let d = 0;
    for (const o of ondes) d += o.a * Math.sin(pos.getX(i) * o.fx + pos.getZ(i) * o.fz + o.ph);
    d *= (froissement / ondes.length) * 2;
    pos.setXYZ(i, pos.getX(i) + n.getX(i) * d, pos.getY(i) + n.getY(i) * d, pos.getZ(i) + n.getZ(i) * d);
  }
  geo.computeVertexNormals();
  if (uvDessus) {
    const ref = Array.isArray(uvDessus) ? uvDessus : [x - l / 2, x + l / 2, z - p / 2, z + p / 2];
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + x - ref[0]) / (ref[1] - ref[0]), (pos.getZ(i) + z - ref[2]) / (ref[3] - ref[2]));
    }
    uv.needsUpdate = true;
  }
  const m = new THREE.Mesh(geo, materiau);
  m.position.set(x, yBas + h / 2, z);
  return ombres(m);
}

// Plan vertical orienté vers +x par défaut (écran de TV, papier d'un cadre…).
export function plan(l, h, materiau, [x, y, z], { nom, rotY = Math.PI / 2 } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), materiau);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  if (nom) m.name = nom;
  m.receiveShadow = true;
  return m;
}

// Pales de ventilateur : une forme élargie vers le bout et légèrement inclinée.
// L'axe du ventilateur est x : les pales rayonnent dans le plan (y, z).
export function pales(nb, rayon, materiau, [x, y, z], { pas = 0.35 } = {}) {
  const forme = new THREE.Shape();
  forme.moveTo(0.02, -0.012);
  forme.bezierCurveTo(0.05, -0.035, rayon * 0.8, -0.05, rayon, -0.03);
  forme.lineTo(rayon, 0.03);
  forme.bezierCurveTo(rayon * 0.8, 0.05, 0.05, 0.02, 0.02, 0.012);
  forme.closePath();
  const geo = new THREE.ExtrudeGeometry(forme, { depth: 0.004, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); // longueur selon z, épaisseur selon x
  geo.rotateZ(pas); // pas de la pale
  const groupe = new THREE.Group();
  for (let i = 0; i < nb; i++) {
    const m = ombres(new THREE.Mesh(geo, materiau));
    m.rotation.x = (i * 2 * Math.PI) / nb;
    groupe.add(m);
  }
  groupe.position.set(x, y, z);
  return groupe;
}

// Grille de ventilateur : anneaux concentriques et rayons, dans le plan (y, z), axe x.
export function grille(rayon, materiau, [x, y, z], { anneaux = [1, 0.62, 0.25], rayons = 8 } = {}) {
  const g = new THREE.Group();
  anneaux.forEach((k, i) => g.add(tore(rayon * 2 * k, i === 0 ? 0.006 : 0.0035, materiau, [0, 0, 0], [0, Math.PI / 2, 0])));
  for (let i = 0; i < rayons; i++) {
    // un diamètre vertical, tourné autour de l'axe x
    g.add(cylindre(0.004, rayon * 2, materiau, [0, 0, 0], { centre: true, rot: [(i * Math.PI) / rayons, 0, 0], segments: 6 }));
  }
  g.position.set(x, y, z);
  return g;
}

// --- Fusion : un seul maillage par matériau ---
// Les maillages qui ont un nom (par exemple « ecran ») restent séparés : le programme
// les retrouve par leur nom.
export function fusionner(racine) {
  racine.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(racine.matrixWorld).invert();
  const seaux = new Map();
  const nommes = [];
  const gardes = []; // sous-groupes qui doivent rester séparés : un capot, une porte… (nom en « objet_ » ou « pivot_ »)
  const rel = new THREE.Matrix4();

  const visiter = (o) => {
    if (o !== racine && /^(objet|pivot)_/.test(o.name)) {
      gardes.push(o);
      return;
    }
    if (o.isMesh) {
      rel.multiplyMatrices(inverse, o.matrixWorld);
      let g = o.geometry.clone();
      for (const nom of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nom)) g.deleteAttribute(nom);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(rel);
      if (o.name) {
        const m = new THREE.Mesh(g, o.material);
        m.name = o.name;
        m.receiveShadow = true;
        nommes.push(m);
        return;
      }
      if (!g.index) g = mergeVertices(g, 1e-5);
      if (!seaux.has(o.material)) seaux.set(o.material, []);
      seaux.get(o.material).push(g);
    }
    o.children.forEach(visiter);
  };
  visiter(racine);

  const sortie = new THREE.Group();
  sortie.name = racine.name;
  for (const [materiau, geos] of seaux) {
    const fusion = mergeGeometries(geos, false);
    if (!fusion) throw new Error(`fusion impossible pour le matériau ${materiau.name}`);
    const m = new THREE.Mesh(fusion, materiau);
    m.castShadow = !materiau.transparent;
    m.receiveShadow = true;
    sortie.add(m);
  }
  if (nommes.length) sortie.add(...nommes);
  // chaque sous-groupe est fusionné dans son propre repère, puis replacé là où il était (même charnière)
  for (const garde of gardes) {
    const f = fusionner(garde);
    rel.multiplyMatrices(inverse, garde.matrixWorld).decompose(f.position, f.quaternion, f.scale);
    sortie.add(f);
  }
  return sortie;
}

export { RoundedBoxGeometry };
