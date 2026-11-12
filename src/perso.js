import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { chemin } from './textures.js';
import { sons } from './sons.js';

// Mode secret : un tout petit bonhomme qu'on promène dans la chambre, à la troisième personne, avec le système
// de déplacement de Deadlock, ramené à sa taille. Le bonhomme reste au centre de l'écran, la souris oriente la
// caméra, et les touches sont RELATIVES À LA CAMÉRA (Z/↑ avance vers où l'on regarde, Q/D se décale, S recule).
//   - L'endurance : 3 charges, regagnées une à une (une toutes les 4,5 s), affichées en bas de l'écran.
//   - Maj : le dash, dans la direction visée (devant soi si on ne vise rien) : une charge. Plus court mais plus
//     rapide en l'air, où il file à l'horizontale.
//   - Espace pendant un dash au sol (les barres sont bleues) : le dash-jump, un saut long et plat qui garde la
//     vitesse du dash ; une charge de plus.
//   - Ctrl (ou C) tenu : la glissade, qui ne part qu'au-dessus d'une certaine vitesse (en pratique : pendant ou
//     après un dash, ou en retombant d'un dash-jump) ; un dash qui finit en glissade ne coûte rien de plus. Lent,
//     Ctrl tenu l'accroupit (et il reste accroupi tout seul s'il n'a pas la place de se relever).
//   - Espace : sauter (gratuit) ; en l'air, le double saut (une charge) ; contre un mur en s'en éloignant, le saut
//     de mur (le premier de chaque vol est gratuit et ne prend pas le double saut, les suivants coûtent une
//     demi-charge). En retombant contre un mur qu'on pousse, il glisse le long, freiné.
//   - Il se hisse tout seul sur un rebord presque atteint (gratuit). Le saut pardonne : il part encore juste après
//     avoir quitté un rebord, et un appui juste avant d'atterrir est gardé.
// E agit sur ce qui est devant lui (porte, lumières, store, calendrier…), Échap sort. On y entre par trois clics
// rapides sur un des petits avions du mobile (voir main.js). Un clic dans la scène capte la souris ; Échap la rend,
// un second Échap quitte. Sur téléphone : un joystick pour bouger, un glissé du doigt pour regarder, et les
// boutons « Agir », « Saut », « Dash » et « Glisse » (tenu).
// Le personnage vit dans le repère de la pièce (x ouest→est, z nord→sud).
//
// Le modèle est « Frutiger aero character v2 » (public/models/perso.glb), un bonhomme vert brillant sans
// squelette : le dandinement, l'inclinaison et l'écrasement sont faits ici, en code.

// ↓↓↓ À RÉGLER ↓↓↓
// Les valeurs de Deadlock (deadlock.wiki) sont pour des héros d'environ 1,9 m ; lui en fait 0,3. Les distances et
// les vitesses sont donc multipliées par ECHELLE ; les durées et les coûts ne changent pas.
const ECHELLE = 0.3 / 1.9;
const ENDURANCE = 3; // charges (la plupart des héros en ont 3)
const RECHARGE = 4.5; // secondes pour regagner une charge, une à la fois
const DASH_SOL = 10 * ECHELLE; // distance d'un dash au sol (10 m dans Deadlock)
const DASH_EN_L_AIR = 8 * ECHELLE; // en l'air (8 m) : plus court…
const VITESSE_DASH = 14 * ECHELLE; // m/s au sol (13,9 à 14,7 selon les héros)…
const VITESSE_DASH_AIR = VITESSE_DASH * 1.2; // …et plus rapide en l'air
const SEUIL_GLISSADE = 9.6 * ECHELLE; // une glissade ne part qu'au-dessus de cette vitesse (9,6 m/s)
// La vitesse de course n'est pas publiée : elle est réglée sous le seuil de glissade (on ne glisse pas d'une
// simple course, il faut un dash), sprint hors combat compris (il n'y a jamais de combat ici).
const COURSE = 1.3; // m/s
const FROTTEMENT_GLISSADE = 0.7; // la glissade ralentit doucement : plus petit = plus loin
const ACCROUPI = 0.5; // facteur de vitesse accroupi
// Hauteur d'un saut, en mètres, à SA taille et non à l'échelle (sinon il ne monterait sur rien) : la chaise
// (0,45), le lit (0,6), le bureau (0,75) et la commode (1,0) demandent un saut d'au moins leur hauteur, moins
// le rebord (REBORD).
const HAUTEUR_SAUT = 1.15;
const DOUBLE_SAUT = 0.8; // le double saut monte de cette part de la hauteur du premier
const SAUT_DASH = 0.7; // le dash-jump, plus plat…
const ELAN_DASH_SAUT = 1.1; // …garde la vitesse du dash et la pousse un peu
const SAUT_MUR = 0.85; // le saut de mur, part de la hauteur d'un saut
const POUSSEE_MUR = 1.3; // m/s : le mur le repousse d'autant
const GLISSE_MUR = 0.5; // m/s : sa chute est limitée à ceci quand il glisse le long d'un mur
const GRAVITE = 9.8; // m/s²
const CHUTE = 1; // la pesanteur est multipliée par ceci à la descente (1 : la même qu'à la montée)
const ACCELERATION = 11; // plus c'est grand, plus il démarre et s'arrête vite au sol
const DEMI_TOUR = 1.8; // l'accélération est multipliée par ceci quand il repart dans l'autre sens
const CONTROLE_AIR = 4.5; // m/s² : à quel point on infléchit un saut (l'élan, lui, se garde)
const TOLERANCE = 0.12; // s : on peut encore sauter ce temps-là après avoir quitté un rebord en marchant
const MEMOIRE = 0.15; // s : un saut demandé jusqu'à ce temps-là avant d'atterrir part à l'atterrissage
const REBORD = 0.18; // m : en l'air, il se hisse sur un dessus qui dépasse ses pieds d'au plus ceci
const SENSIBILITE = 0.0022; // souris, radians par pixel
const TAILLE = 0.3; // hauteur du bonhomme, en mètres
// ↑↑↑

export function creerPerso({ renderer, racine, camera, controls, interactions, contour, meubles, fixes = [], cliquables, basculer, piece, profondeurNord = 0 }) {
  const { largeur: W, profondeur: D, hauteur: H, hauteurMurBas: K, penteProfondeur: R } = piece;
  const RAYON = 0.085; // épaisseur du bonhomme pour les collisions (les bras dépassent un peu du corps)
  const CORPS_DEBOUT = TAILLE + 0.03; // hauteur occupée, pour passer sous un meuble ou se cogner la tête
  const CORPS_BAS = CORPS_DEBOUT * 0.5; // accroupi ou en glissade
  let CORPS = CORPS_DEBOUT;
  const MARCHE = 0.08; // il monte (ou descend) tout seul une marche de cette hauteur
  const PAS_PHYSIQUE = 1 / 120; // la physique avance par petits pas : la même à toute cadence, et rien ne se traverse

  // --- Le bonhomme ---
  const perso = new THREE.Group();
  perso.name = 'petit bonhomme';
  perso.visible = false;
  const corps = new THREE.Group(); // pivote autour des pieds : c'est lui qui se dandine
  perso.add(corps);
  // Look « Frutiger aero » : une gelée verte translucide et brillante, avec des reflets de studio (une
  // carte d'environnement réservée à ce matériau, la pièce n'en a pas), un vernis, et un bord plus lumineux
  // et plus opaque que le centre (effet de Fresnel) comme sur une bille de verre.
  const matPerso = new THREE.MeshPhysicalMaterial({
    color: '#14c23e',
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.25, // la carte d'environnement est créée à la première entrée dans le mode (voir activer)
    emissive: '#0a8a2c',
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.9,
    depthWrite: false, // le corps se voit à travers la tête, et inversement
  });
  matPerso.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float fresnelPerso = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2);
      gl_FragColor.rgb += vec3(0.3, 1.0, 0.6) * fresnelPerso * 0.3;
      gl_FragColor.a = clamp(gl_FragColor.a * mix(0.7, 1.15, fresnelPerso), 0.0, 1.0);`,
    );
  };
  const reservePerso = new THREE.Mesh(new THREE.SphereGeometry(TAILLE / 2, 16, 12), matPerso); // le temps du chargement
  reservePerso.position.y = TAILLE / 2;
  corps.add(reservePerso);
  new GLTFLoader().loadAsync(chemin('/models/perso.glb')).then(
    (gltf) => {
      const modele = gltf.scene;
      modele.traverse((o) => {
        if (!o.isMesh) return;
        o.material = matPerso;
        o.castShadow = true;
        o.receiveShadow = true;
        o.renderOrder = o.geometry.attributes.position.count > 1000 ? 1 : 2; // le corps d'abord, puis la tête devant
      });
      // à l'échelle de la chambre : TAILLE de haut, les pieds au sol, centré sur son axe
      const boite = new THREE.Box3().setFromObject(modele);
      const echelle = TAILLE / (boite.max.y - boite.min.y);
      const enveloppe = new THREE.Group();
      enveloppe.scale.setScalar(echelle);
      enveloppe.position.set(-((boite.min.x + boite.max.x) / 2) * echelle, -boite.min.y * echelle, -((boite.min.z + boite.max.z) / 2) * echelle);
      enveloppe.add(modele);
      corps.remove(reservePerso);
      corps.add(enveloppe);
    },
    (err) => console.warn('Modèle du petit bonhomme introuvable :', err.message),
  );
  racine.add(perso);

  // --- Le sol, les meubles et ce sur quoi il peut grimper ---
  // Chaque forme d'un meuble devient un solide : son rectangle au sol, son bas et son dessus. Un solide
  // arrête le bonhomme s'il touche son corps plus haut qu'une marche ; son dessus le porte s'il est assez
  // large (`marche`). Les murs ne sont pas des solides : le contour de la pièce s'en charge.
  const solides = [];
  const ajouter = (x0, x1, z0, z1, bas, haut, marche) => solides.push({ x0, x1, z0, z1, bas, haut, marche });
  for (const m of meubles) {
    // un meuble tourné (`rotation`) : chaque forme tourne avec lui, son rectangle au sol devient celui qui
    // l'englobe une fois tourné
    const a = m.rotation ?? 0;
    const [co, si] = [Math.cos(a), Math.sin(a)];
    for (const p of m.parties ?? []) {
      const [l0, h, pr0] = p.forme === 'cylindre' ? [p.taille[0], p.taille[1], p.taille[0]] : p.forme === 'sphere' || p.forme === 'tore' ? [p.taille[0], p.taille[0], p.taille[0]] : p.taille;
      const l = Math.abs(l0 * co) + Math.abs(pr0 * si);
      const pr = Math.abs(l0 * si) + Math.abs(pr0 * co);
      const bas = p.centre ? p.pos[1] - h / 2 : p.pos[1];
      const [x, z] = [m.pos[0] + p.pos[0] * co + p.pos[2] * si, m.pos[1] - p.pos[0] * si + p.pos[2] * co];
      const portant = !p.verre && !p.rot && p.forme !== 'sphere' && p.forme !== 'tore' && Math.min(l, pr) >= 0.07;
      ajouter(x - l / 2, x + l / 2, z - pr / 2, z + pr / 2, bas, bas + h, portant);
    }
  }
  for (const f of fixes) ajouter(f.x0, f.x1, f.z0, f.z1, f.bas, f.haut, false);

  const dansContour = (x, z) => {
    let dedans = false;
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [xi, zi] = contour[i];
      const [xj, zj] = contour[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dedans = !dedans;
    }
    return dedans;
  };
  const distanceAuxBords = (x, z) => {
    let d = Infinity;
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, az] = contour[j];
      const [bx, bz] = contour[i];
      const [ex, ez] = [bx - ax, bz - az];
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
      d = Math.min(d, Math.hypot(x - (ax + t * ex), z - (az + t * ez)));
    }
    return d;
  };
  // son corps (de hauteur c), à la hauteur y, touche-t-il un solide plus haut qu'une marche ?
  const bute = (x, z, y, c = CORPS) =>
    solides.some((s) => x > s.x0 - RAYON && x < s.x1 + RAYON && z > s.z0 - RAYON && z < s.z1 + RAYON && s.haut > y + MARCHE && s.bas < y + c);
  const libre = (x, z, y, c = CORPS) => dansContour(x, z) && distanceAuxBords(x, z) >= RAYON * 0.8 && !bute(x, z, y, c);
  // le dessus le plus haut qui le porterait en (x, z), sans dépasser `max`
  const solSous = (x, z, max) => {
    let h = 0;
    for (const s of solides) if (s.marche && s.haut <= max && s.haut > h && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) h = s.haut;
    return h;
  };
  // hauteur du plafond au-dessus de z : la pente descend vers le sud, et dans la chambre de rêve
  // (profondeurNord > 0) une seconde pente descend vers le nord
  const D2 = profondeurNord;
  const plafond = (z) => {
    if (z > D - R) return Math.max(K, H - ((z - (D - R)) * (H - K)) / R);
    if (D2 > 0 && z < -D2 + R) return Math.max(K, H - ((-D2 + R - z) * (H - K)) / R);
    return H;
  };
  // la caméra doit rester dans la pièce, sous le toit et hors des meubles
  const cameraLibre = (x, y, z) => {
    if (!dansContour(x, z) || distanceAuxBords(x, z) < 0.12 || y > plafond(z) - 0.08) return false;
    return !solides.some((s) => x > s.x0 - 0.04 && x < s.x1 + 0.04 && z > s.z0 - 0.04 && z < s.z1 + 0.04 && s.bas < y + 0.02 && s.haut > y - 0.04);
  };

  // coins de la pièce où il apparaît, et où il retourne si on ne lui trouve aucune place libre
  const DEPARTS = [[1.0, 1.4], [0.9, 1.0], [1.0, 2.9], [1.5, 1.2], [2.0, 1.4]];
  // la place libre la plus proche de (x, z) : des cercles de plus en plus larges autour de lui. Sert à le
  // sortir d'un meuble où il est resté coincé (les boîtes de collision sont approximatives).
  function trouverLibre(x, z, y, rmax = 1.6) {
    for (let r = 0; r <= rmax; r += 0.05) {
      const n = r === 0 ? 1 : Math.ceil(r * 40);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const [cx, cz] = [x + Math.cos(a) * r, z + Math.sin(a) * r];
        const hauteur = solSous(cx, cz, y + MARCHE); // au niveau où il est, ou sur le meuble qui est là
        if (libre(cx, cz, hauteur, CORPS_DEBOUT)) return { x: cx, z: cz, alt: hauteur };
      }
    }
    const [dx, dz] = DEPARTS.find(([dx, dz]) => libre(dx, dz, 0, CORPS_DEBOUT)) ?? DEPARTS[0];
    return { x: dx, z: dz, alt: 0 };
  }

  // le mur le plus proche de son corps (un bord de la pièce, ou le flanc d'un meuble à hauteur de son corps), à moins
  // de `portee` de sa surface : la normale qui en sort vers lui, et la distance
  function murProche(portee) {
    let meilleur = null;
    let d0 = RAYON + portee;
    const garder = (cx, cz) => {
      const d = Math.hypot(pos.x - cx, pos.z - cz);
      if (d > 1e-6 && d < d0) {
        d0 = d;
        meilleur = { nx: (pos.x - cx) / d, nz: (pos.z - cz) / d, d };
      }
    };
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, az] = contour[j];
      const [bx, bz] = contour[i];
      const [ex, ez] = [bx - ax, bz - az];
      const t = Math.max(0, Math.min(1, ((pos.x - ax) * ex + (pos.z - az) * ez) / (ex * ex + ez * ez)));
      garder(ax + t * ex, az + t * ez);
    }
    for (const s of solides) {
      if (s.haut <= alt + MARCHE || s.bas >= alt + CORPS) continue;
      garder(THREE.MathUtils.clamp(pos.x, s.x0, s.x1), THREE.MathUtils.clamp(pos.z, s.z0, s.z1));
    }
    return meilleur;
  }

  // --- Interface et commandes ---
  const el = {
    aide: document.getElementById('perso-aide'),
    action: document.getElementById('perso-action'),
    endurance: document.getElementById('perso-endurance'),
    quitter: document.getElementById('perso-quitter'),
    debloquer: document.getElementById('perso-debloquer'),
    stick: document.getElementById('perso-stick'),
    pomme: document.getElementById('perso-pomme'),
    agir: document.getElementById('perso-agir'),
    saut: document.getElementById('perso-saut'),
    dash: document.getElementById('perso-dash'),
    accroupi: document.getElementById('perso-accroupi'),
  };
  const boutonsTactiles = [el.stick, el.agir, el.saut, el.dash, el.accroupi];
  const touches = matchMedia('(pointer: coarse)').matches;
  // sur Mac, Ctrl + une lettre n'est pas un raccourci du navigateur : on peut tenir Ctrl (glisser, s'accroupir) en bougeant
  const mac = /Mac/.test(navigator.platform);
  const touche = new Set();
  const stick = { x: 0, y: 0 }; // -1…1, haut = avancer
  let actif = false;
  let alt = 0; // hauteur de ses pieds
  let vy = 0;
  let enAir = false;
  let airLisse = 0; // 0 au sol, 1 en l'air (lissé, pour l'étirement)
  let atterri = 1; // chronomètre de l'écrasement à l'arrivée (1 = terminé)
  let endurance = ENDURANCE; // charges d'endurance (avec la part de celle qui se recharge)
  let demandeSaut = 0; // temps restant pendant lequel un appui sur Espace attend de pouvoir partir
  let tolerance = 0; // temps restant pendant lequel il peut encore sauter après avoir quitté le sol
  let doubleFait = false; // le double saut n'a lieu qu'une fois par vol
  let mursSautes = 0; // sauts de mur depuis qu'il a quitté le sol (le premier est gratuit)
  let veutDash = false;
  let dashEn = 0; // temps restant du dash en cours
  let dashAir = false; // dash parti en l'air
  let vitesseDash = 0;
  const dirDash = new THREE.Vector2();
  let enGlissade = false;
  let contreMur = false; // il glisse le long d'un mur en retombant
  let bas = false; // accroupi (ou en glissade) : son corps est moitié moins haut
  let foulee = 0; // distance parcourue depuis le dernier bruit de pas
  let coince = 0; // depuis combien de temps il est dans un meuble
  let sansProgres = 0; // depuis combien de temps il pousse sans avancer
  let squat = 1; // 1 debout, ~0,5 accroupi ou en glissade (lissé)
  let roulis = 0; // il se penche dans les virages (lissé)
  let fovVoulu = 62;
  const vit = new THREE.Vector2(); // vitesse horizontale (x, z), avec son inertie
  const decalage = new THREE.Vector3(); // écart entre le dessin et sa vraie place, qui s'efface (quand il se hisse)
  let tangage = 0.3; // hauteur de la caméra autour de lui (radians au-dessus de l'horizontale)
  let distance = 0.82;
  let distanceLisse = distance;
  let recul = 1; // part de la distance que la caméra peut prendre sans entrer dans un mur ou un meuble (lissée)
  let transition = 0; // temps restant du vol de la caméra jusqu'à lui, à l'entrée dans le mode
  let cap = 0; // direction du bonhomme : devant lui = (sin cap, cos cap), tourné vers où il va
  let capCamera = 0; // direction de la caméra, pilotée par la souris
  let verrou = false; // souris captée (pointer lock)
  const pos = new THREE.Vector3();
  const pivot = new THREE.Vector3(); // le point que suit la caméra : le milieu de son corps, lissé
  let phase = 0;
  let allure = 0; // 0 à l'arrêt, 1 en marche (lissé)
  let cible = null; // objet sur lequel E agit
  let delaiCible = 0;
  const cameraVoulue = new THREE.Vector3();
  const regardVoulu = new THREE.Vector3();
  let fovAvant = 35;
  let minDistanceAvant = 1.2;
  let maxPolaireAvant = Math.PI / 2.2;

  const NOMS_TOUCHES = {
    haut: ['arrowup', 'z', 'w'],
    bas: ['arrowdown', 's'],
    gauche: ['arrowleft', 'q', 'a'],
    droite: ['arrowright', 'd'],
  };
  const presse = (dir) => NOMS_TOUCHES[dir].some((t) => touche.has(t));

  function agir() {
    if (!cible) return;
    if (cible.auClic) cible.auClic();
    else if (cible.interrupteur) basculer(cible.interrupteur);
  }
  const presserSaut = () => (demandeSaut = MEMOIRE);
  const presserDash = () => (veutDash = true);
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!actif || e.metaKey || e.altKey || (e.ctrlKey && k !== 'control' && !mac)) return;
    if (k === 'escape') return desactiver();
    if (k === 'shift') {
      e.preventDefault();
      if (!e.repeat) presserDash();
      return;
    }
    if (k === 'control' || k === 'c') {
      e.preventDefault();
      touche.add(k);
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) presserSaut();
      return;
    }
    if (k === 'r') {
      e.preventDefault();
      debloquer();
      return;
    }
    if (k === 'e' || k === 'enter') {
      e.preventDefault();
      if (!e.repeat) agir();
      return;
    }
    if (Object.values(NOMS_TOUCHES).some((l) => l.includes(k))) {
      e.preventDefault();
      touche.add(k);
    }
  });
  window.addEventListener('keyup', (e) => touche.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => touche.clear());
  el.quitter.addEventListener('click', () => desactiver());
  el.debloquer.addEventListener('click', () => debloquer());
  el.agir.addEventListener('click', agir);
  el.saut.addEventListener('pointerdown', presserSaut);
  el.dash.addEventListener('pointerdown', presserDash);
  // le bouton « Glisse » se tient, comme Ctrl
  el.accroupi.addEventListener('pointerdown', () => touche.add('c'));
  for (const fin of ['pointerup', 'pointercancel', 'pointerleave']) el.accroupi.addEventListener(fin, () => touche.delete('c'));
  // les boutons ne gardent pas le focus : Espace ne doit pas les « cliquer » à la place du saut
  for (const b of [el.quitter, el.debloquer, el.agir, el.saut, el.dash, el.accroupi]) b.addEventListener('pointerdown', (e) => e.preventDefault());

  // l'endurance : une barre par charge, qui se remplit ; bleues pendant un dash au sol (Espace donne alors un
  // dash-jump), rouges un instant quand il en manque
  const barres = Array.from({ length: ENDURANCE }, () => {
    const b = document.createElement('span');
    b.append(document.createElement('i'));
    el.endurance.append(b);
    return b;
  });
  let rougeJusqua = 0;
  const manque = () => (rougeJusqua = performance.now() + 350);
  function majEndurance() {
    barres.forEach((b, i) => {
      const f = THREE.MathUtils.clamp(endurance - i, 0, 1);
      b.firstChild.style.transform = `scaleX(${f.toFixed(3)})`;
      b.classList.toggle('pleine', f >= 1);
    });
    el.endurance.classList.toggle('dash', dashEn > 0 && !dashAir);
    el.endurance.classList.toggle('vide', performance.now() < rougeJusqua);
  }

  // la souris oriente la caméra (un clic dans la scène la capte) ; sans souris captée ou au doigt, on glisse ;
  // la molette change la distance
  const canvas = controls.domElement;
  const regarder = (dx, dy, k) => {
    capCamera -= (dx || 0) * k;
    tangage = THREE.MathUtils.clamp(tangage + (dy || 0) * k * 0.8, -0.2, 1.25);
  };
  let glisse = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!actif) return;
    if (e.pointerType === 'mouse' && !verrou) {
      try {
        canvas.requestPointerLock?.()?.catch?.(() => {}); // refusé (iframe, aperçu…) : on garde le glissé
      } catch {
        /* pas de souris captée : le glissé suffit */
      }
    }
    glisse = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* le pointeur a déjà été capté ou relâché */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!actif) return;
    if (verrou) return regarder(e.movementX, e.movementY, SENSIBILITE);
    if (!glisse || e.pointerId !== glisse.id) return;
    regarder(e.clientX - glisse.x, e.clientY - glisse.y, 0.006);
    glisse.x = e.clientX;
    glisse.y = e.clientY;
  });
  const finGlisse = (e) => glisse && e.pointerId === glisse.id && (glisse = null);
  canvas.addEventListener('pointerup', finGlisse);
  canvas.addEventListener('pointercancel', finGlisse);
  document.addEventListener('pointerlockchange', () => {
    verrou = document.pointerLockElement === canvas;
    texteAide();
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!actif) return;
      e.preventDefault();
      distance = THREE.MathUtils.clamp(distance * (1 + Math.sign(e.deltaY) * 0.1), 0.35, 3);
    },
    { passive: false },
  );
  function texteAide() {
    const commun = 'Maj : dash (+ Espace pendant le dash : saut long) · Espace : sauter, 2× en l’air, contre un mur en s’en éloignant · Ctrl tenu : glisser après un dash, s’accroupir sinon · E : agir · R : débloquer';
    el.aide.textContent = verrou
      ? `ZQSD : bouger · Souris : caméra · ${commun} · Échap : libérer la souris`
      : touches
        ? 'Joystick : bouger · Glisse le doigt : regarder · Dash puis Saut : saut long · Glisse (tenu) après un dash'
        : `Clique dans la scène pour piloter la caméra à la souris · ZQSD : bouger · ${commun} · Échap : quitter`;
  }

  // joystick tactile : on glisse le pouce dans le rond
  let doigt = null;
  const placerPomme = () => {
    el.pomme.style.transform = `translate(${stick.x * 34}px, ${stick.y * 34}px)`;
  };
  el.stick.addEventListener('pointerdown', (e) => {
    doigt = e.pointerId;
    el.stick.setPointerCapture(e.pointerId);
    deplacerStick(e);
  });
  el.stick.addEventListener('pointermove', (e) => e.pointerId === doigt && deplacerStick(e));
  const lacher = (e) => {
    if (e.pointerId !== doigt) return;
    doigt = null;
    stick.x = stick.y = 0;
    placerPomme();
  };
  el.stick.addEventListener('pointerup', lacher);
  el.stick.addEventListener('pointercancel', lacher);
  function deplacerStick(e) {
    const r = el.stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const n = Math.hypot(dx, dy);
    if (n > 1) [dx, dy] = [dx / n, dy / n];
    stick.x = Math.abs(dx) < 0.15 ? 0 : dx;
    stick.y = Math.abs(dy) < 0.15 ? 0 : dy;
    placerPomme();
  }

  // remet à zéro tout ce qui concerne son mouvement (entrée dans le mode, déblocage)
  function arreter() {
    vy = 0;
    enAir = false;
    vit.set(0, 0);
    demandeSaut = tolerance = dashEn = mursSautes = 0;
    doubleFait = veutDash = enGlissade = contreMur = bas = false;
    CORPS = CORPS_DEBOUT;
    decalage.set(0, 0, 0);
    coince = sansProgres = 0;
  }

  // --- Entrer / sortir ---
  function activer() {
    if (actif) return;
    actif = true;
    if (!matPerso.envMap) {
      matPerso.envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
      matPerso.needsUpdate = true;
    }
    document.activeElement?.blur?.();
    document.body.classList.add('perso');
    interactions.bloquer(true);
    controls.enabled = false;
    fovAvant = camera.fov;
    minDistanceAvant = controls.minDistance;
    maxPolaireAvant = controls.maxPolarAngle;
    controls.minDistance = 0.05;
    controls.maxPolarAngle = Math.PI;
    // départ : un coin libre, tourné vers le centre de la pièce
    const [x, z] = DEPARTS.find(([x, z]) => libre(x, z, 0, CORPS_DEBOUT)) ?? DEPARTS[0];
    pos.set(x, 0, z);
    alt = 0;
    arreter();
    endurance = ENDURANCE;
    squat = 1;
    roulis = 0;
    tangage = 0.3;
    distance = distanceLisse = 1.0;
    recul = 1;
    transition = 0.7; // la caméra vole de la vue d'ensemble jusqu'à lui
    pivot.set(x, TAILLE * 0.6, z);
    cap = capCamera = Math.atan2(W / 2 - x, D / 2 - z);
    perso.position.copy(pos);
    perso.rotation.y = cap;
    perso.visible = true;
    texteAide();
    el.aide.hidden = el.quitter.hidden = el.debloquer.hidden = el.endurance.hidden = false;
    if (touches) for (const b of boutonsTactiles) b.hidden = false;
    majEndurance();
    el.aide.classList.remove('estompee');
    setTimeout(() => el.aide.classList.add('estompee'), 9000);
  }
  function desactiver() {
    if (!actif) return;
    actif = false;
    touche.clear();
    stick.x = stick.y = 0;
    document.body.classList.remove('perso');
    perso.visible = false;
    el.aide.hidden = el.quitter.hidden = el.debloquer.hidden = el.endurance.hidden = el.action.hidden = true;
    for (const b of boutonsTactiles) b.hidden = true;
    controls.enabled = true;
    controls.minDistance = minDistanceAvant;
    controls.maxPolarAngle = maxPolaireAvant;
    interactions.bloquer(false);
    // retour à la vue d'ensemble, par le trajet habituel de la caméra
    document.exitPointerLock?.();
    document.querySelector('#vues button')?.click();
    camera.fov = fovAvant;
    camera.updateProjectionMatrix();
  }

  // --- Caméra autour de lui ---
  // Elle reste derrière lui à la distance et à l'inclinaison choisies à la souris ; il est au centre de
  // l'écran, avec un léger décalage d'épaule. Rien ne la ramène derrière son dos : c'est lui qui se tourne
  // vers où il va. La souris la tourne sans retard ; c'est le point qu'elle suit qui est lissé (un peu plus
  // mou en hauteur pendant un saut, pour que l'image ne saute pas avec lui). Un mur ou un meuble entre elle
  // et lui la rapproche aussitôt, et elle ne recule que doucement une fois l'obstacle passé.
  function suivreCamera(dt) {
    const hy = alt + TAILLE * 0.6 * squat; // le point visé : le milieu de son corps
    const kh = 1 - Math.exp(-28 * dt);
    const kv = 1 - Math.exp(-(enAir ? 6 : 14) * dt);
    pivot.x += (pos.x - pivot.x) * kh;
    pivot.z += (pos.z - pivot.z) * kh;
    pivot.y = THREE.MathUtils.clamp(pivot.y + (hy - pivot.y) * kv, hy - 0.2, hy + 0.2);
    distanceLisse += (distance - distanceLisse) * (1 - Math.exp(-10 * dt));
    const [sx, cz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const [horiz, vert] = [Math.cos(tangage) * distanceLisse, Math.sin(tangage) * distanceLisse];
    const epaule = 0.06; // vers la droite de l'écran : lui un peu à gauche du viseur
    const [rx, rz] = [-cz, sx];
    const placer = (t) => cameraVoulue.set(pivot.x - sx * horiz * t + rx * epaule, Math.max(0.06, pivot.y + vert * t), pivot.z - cz * horiz * t + rz * epaule);
    // on se rapproche de lui tant que la caméra serait dans un mur, sous le toit ou dans un meuble
    let t = 1;
    for (; t > 0.2; t -= 0.05) {
      placer(t);
      if (cameraLibre(cameraVoulue.x, cameraVoulue.y, cameraVoulue.z)) break;
    }
    // puis au plus près de l'obstacle : elle s'en approche en douceur, et non par crans
    if (t < 1 && t > 0.2) {
      let [lo, hi] = [t, t + 0.05];
      for (let i = 0; i < 4; i++) {
        const m = (lo + hi) / 2;
        placer(m);
        if (cameraLibre(cameraVoulue.x, cameraVoulue.y, cameraVoulue.z)) lo = m;
        else hi = m;
      }
      t = lo;
    }
    recul = t < recul ? t : recul + (t - recul) * (1 - Math.exp(-3 * dt));
    placer(recul).add(racine.position);
    regardVoulu.set(pivot.x + rx * epaule * 0.5 + sx * 0.25, pivot.y, pivot.z + rz * epaule * 0.5 + cz * 0.25).add(racine.position);
    // à l'entrée dans le mode, elle vole jusqu'à lui ; ensuite elle est exactement là où il faut
    const k = transition > 0 ? 1 - Math.exp(-9 * dt) : 1;
    transition -= dt;
    camera.position.lerp(cameraVoulue, k);
    controls.target.lerp(regardVoulu, k);
    camera.fov += (fovVoulu - camera.fov) * (1 - Math.exp(-6 * dt));
    camera.updateProjectionMatrix();
  }

  // ce que E fera : le meuble ou le décor actionnable le plus proche, devant les pieds du bonhomme
  const boite = new THREE.Box3();
  function chercherCible() {
    const monde = pos.clone().add(racine.position);
    let meilleur = null;
    let d0 = 0.6;
    for (const info of cliquables) {
      if (info.secret || !(info.auClic || info.interrupteur)) continue;
      boite.setFromObject(info.groupe);
      if (boite.isEmpty()) continue;
      const dx = Math.max(boite.min.x - monde.x, 0, monde.x - boite.max.x);
      const dz = Math.max(boite.min.z - monde.z, 0, monde.z - boite.max.z);
      const d = Math.hypot(dx, dz);
      if (d < d0) {
        d0 = d;
        meilleur = info;
      }
    }
    return meilleur;
  }
  const libelle = (info) => {
    const a = info.actions?.[0]?.label;
    const texte = typeof a === 'function' ? a() : a;
    return texte ?? info.nom;
  };

  // Débloquer (touche R ou bouton) : on le remet sur la place libre la plus proche, à l'arrêt
  function debloquer() {
    if (!actif) return;
    const p = trouverLibre(pos.x, pos.z, alt);
    pos.set(p.x, 0, p.z);
    alt = p.alt;
    arreter();
    atterri = 0; // un petit « plop » pour qu'on voie qu'il a bougé
  }

  // --- Les gestes ---
  const angle = (a) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI; // ramené entre -π et π
  // fait tourner un vecteur (x, z) vers la direction (dx, dz), d'au plus `max` radians, sans changer sa longueur
  const tournerVers = (v, dx, dz, max) => {
    const a = Math.atan2(v.x, v.y);
    const b = a + THREE.MathUtils.clamp(angle(Math.atan2(dx, dz) - a), -max, max);
    const l = v.length();
    v.set(Math.sin(b) * l, Math.cos(b) * l);
  };

  // le dash : une charge ; dans la direction visée, ou devant la caméra si on ne vise rien
  function lancerDash(dirX, dirZ, intention, fx, fz) {
    if (endurance < 1) return manque();
    endurance -= 1;
    enGlissade = false;
    dashAir = enAir;
    vitesseDash = dashAir ? VITESSE_DASH_AIR : VITESSE_DASH;
    dashEn = (dashAir ? DASH_EN_L_AIR : DASH_SOL) / vitesseDash;
    if (intention > 0.1) dirDash.set(dirX / intention, dirZ / intention);
    else dirDash.set(fx, fz);
    if (dashAir) vy = 0; // en l'air, il file à l'horizontale
    sons.dash();
  }

  // un saut depuis le sol ; pendant un dash au sol, c'est le dash-jump (une charge de plus, s'il en reste)
  function sauterDuSol() {
    demandeSaut = tolerance = 0;
    enAir = true;
    enGlissade = false;
    if (dashEn > 0 && !dashAir && endurance >= 1) {
      endurance -= 1;
      dashEn = 0;
      vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT * SAUT_DASH);
      vit.set(dirDash.x, dirDash.y).multiplyScalar(vitesseDash * ELAN_DASH_SAUT);
      sons.saut(true);
      atterri = 0;
      return;
    }
    dashEn = 0; // un saut simple arrête le dash, mais garde sa vitesse
    vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT);
    sons.saut(false);
  }

  // le double saut, en l'air : une charge ; il réoriente à moitié l'élan vers la direction visée
  function doubleSaut(dirX, dirZ, intention) {
    endurance -= 1;
    demandeSaut = dashEn = 0;
    doubleFait = true;
    vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT * DOUBLE_SAUT);
    if (intention > 0.1) {
      const v = vit.length();
      vit.x += ((dirX / intention) * v - vit.x) * 0.5;
      vit.y += ((dirZ / intention) * v - vit.y) * 0.5;
    }
    sons.saut(true);
    atterri = 0;
  }

  // le saut de mur : repoussé par le mur, il garde la vitesse qu'il avait le long du mur
  function sauterDuMur(mur) {
    if (mursSautes > 0) endurance -= 0.5;
    mursSautes++;
    demandeSaut = dashEn = 0;
    vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT * SAUT_MUR);
    const contre = vit.x * mur.nx + vit.y * mur.nz;
    vit.x = (vit.x - contre * mur.nx) * 0.9 + mur.nx * POUSSEE_MUR;
    vit.y = (vit.y - contre * mur.nz) * 0.9 + mur.nz * POUSSEE_MUR;
    sons.saut(true);
    atterri = 0;
  }

  // il avance de (mx, mz) s'il le peut ; sinon jusqu'au contact de l'obstacle (pas d'arrêt à quelques
  // centimètres d'un mur), et on répond false
  function avancer(mx, mz) {
    if (libre(pos.x + mx, pos.z + mz, alt)) {
      pos.x += mx;
      pos.z += mz;
      return true;
    }
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 5; i++) {
      const m = (lo + hi) / 2;
      if (libre(pos.x + mx * m, pos.z + mz * m, alt)) lo = m;
      else hi = m;
    }
    pos.x += mx * lo;
    pos.z += mz * lo;
    return false;
  }

  // en l'air, arrêté par un meuble dont le dessus est juste au-dessus de ses pieds : il se hisse dessus
  function seHisser(sx, sz) {
    const [x, z] = [pos.x + sx * (RAYON + 0.03), pos.z + sz * (RAYON + 0.03)];
    const haut = solSous(x, z, alt + REBORD);
    if (haut <= alt + 0.02 || !libre(x, z, haut, CORPS_DEBOUT)) return false;
    // le dessin, lui, rejoint sa nouvelle place en un éclair au lieu d'y sauter d'un coup
    decalage.x += pos.x - x;
    decalage.y += alt - haut;
    decalage.z += pos.z - z;
    pos.x = x;
    pos.z = z;
    alt = haut;
    enAir = false;
    vy = 0;
    doubleFait = false;
    mursSautes = 0;
    dashEn = 0;
    atterri = 0;
    sons.pas();
    return true;
  }

  // un pas de physique, de durée h
  function physique(h, dirX, dirZ, intention, fx, fz, accroupiTenu) {
    // l'endurance se recharge, une charge après l'autre
    endurance = Math.min(ENDURANCE, endurance + h / RECHARGE);
    if (veutDash) {
      veutDash = false;
      if (dashEn <= 0) lancerDash(dirX, dirZ, intention, fx, fz);
    }

    // la glissade : Ctrl tenu au sol, au-dessus du seuil, ou pendant un dash au sol (qui s'y change sans rien
    // coûter de plus) ; elle dure tant qu'on tient et qu'il lui reste de la vitesse
    let v0 = vit.length();
    if (accroupiTenu && !enAir && !enGlissade && (v0 > SEUIL_GLISSADE || (dashEn > 0 && !dashAir))) {
      // un dash qui se change en glissade lui donne sa vitesse (même s'il vient de partir)
      if (dashEn > 0) {
        vit.set(dirDash.x, dirDash.y).multiplyScalar(vitesseDash);
        v0 = vitesseDash;
      }
      dashEn = 0;
      enGlissade = true;
      sons.glisser();
    }
    if (enGlissade && (!accroupiTenu || enAir || v0 < COURSE * 0.6)) enGlissade = false;
    // accroupi : en glissade, Ctrl tenu au sol, ou s'il n'a pas la place de se relever
    bas = enGlissade || (!enAir && (accroupiTenu || bute(pos.x, pos.z, alt, CORPS_DEBOUT)));
    CORPS = bas ? CORPS_BAS : CORPS_DEBOUT;

    // vitesse horizontale
    if (dashEn > 0) {
      // le dash : une vitesse fixe, qu'on infléchit à peine
      dashEn -= h;
      if (intention > 0.1) tournerVers(dirDash, dirX, dirZ, 1.2 * h);
      vit.set(dirDash.x, dirDash.y).multiplyScalar(vitesseDash);
    } else if (enGlissade) {
      // la glissade ralentit doucement ; on la fait tourner un peu, et tirer en arrière la freine
      vit.multiplyScalar(Math.exp(-FROTTEMENT_GLISSADE * h));
      if (intention > 0.1) {
        if (Math.abs(angle(Math.atan2(dirX, dirZ) - Math.atan2(vit.x, vit.y))) > 2.2) vit.multiplyScalar(Math.exp(-3 * h));
        else tournerVers(vit, dirX, dirZ, 1.6 * h);
      }
    } else if (enAir) {
      // en l'air : on infléchit la trajectoire sans perdre l'élan (dash, dash-jump, glissade)…
      if (intention > 0.05) {
        vit.x += dirX * CONTROLE_AIR * h;
        vit.y += dirZ * CONTROLE_AIR * h;
        const max = Math.max(v0, COURSE);
        if (vit.length() > max) vit.setLength(max);
      } else vit.multiplyScalar(Math.exp(-0.35 * h));
      // …mais ce qui dépasse la course s'use peu à peu
      const v = vit.length();
      if (v > COURSE) vit.setLength(COURSE + (v - COURSE) * Math.exp(-0.4 * h));
    } else {
      // au sol : vif, et encore plus pour repartir dans l'autre sens
      const vitesseVisee = COURSE * (bas ? ACCROUPI : 1);
      let rythme = ACCELERATION * (intention > 0.05 ? 1 : 1.2);
      if (intention > 0.05 && vit.x * dirX + vit.y * dirZ < 0) rythme *= DEMI_TOUR;
      const k = 1 - Math.exp(-rythme * h);
      vit.x += (dirX * vitesseVisee - vit.x) * k;
      vit.y += (dirZ * vitesseVisee - vit.y) * k;
      if (intention <= 0.05 && vit.lengthSq() < 1e-4) vit.set(0, 0);
    }
    vit.clampLength(0, 4);

    // il avance un axe après l'autre : contre un obstacle il glisse le long, et perd seulement cette
    // vitesse-là ; en l'air, s'il pousse vers un rebord presque atteint, il se hisse dessus
    const [x0, z0] = [pos.x, pos.z];
    const [mx, mz] = [vit.x * h, vit.y * h];
    const pousseX = dashEn > 0 ? dirDash.x : dirX;
    const pousseZ = dashEn > 0 ? dirDash.y : dirZ;
    if (mx !== 0 && !avancer(mx, 0) && !(enAir && pousseX * Math.sign(mx) > 0.3 && seHisser(Math.sign(mx), 0))) vit.x = 0;
    if (mz !== 0 && !avancer(0, mz) && !(enAir && pousseZ * Math.sign(mz) > 0.3 && seHisser(0, Math.sign(mz)))) vit.y = 0;
    // un dash qui bute de face s'arrête
    if (dashEn > 0 && Math.hypot(pos.x - x0, pos.z - z0) < 0.3 * vitesseDash * h) dashEn = 0;

    // Espace : depuis le sol (ou juste après l'avoir quitté) ; en l'air, contre un mur en s'en éloignant, sinon le
    // double saut ; sous un meuble, pas de saut ; faute d'endurance, l'appui attend un instant (il partira à
    // l'atterrissage)
    if (demandeSaut > 0) {
      const mur = enAir && intention > 0.2 ? murProche(0.06) : null;
      if ((!enAir || tolerance > 0) && !bute(pos.x, pos.z, alt, CORPS_DEBOUT)) sauterDuSol();
      else if (mur && (dirX * mur.nx + dirZ * mur.nz) / intention > 0.1 && (mursSautes === 0 || endurance >= 0.5)) sauterDuMur(mur);
      else if (enAir && !doubleFait && endurance >= 1) doubleSaut(dirX, dirZ, intention);
      else {
        if (enAir && !doubleFait) manque();
        demandeSaut = Math.max(0, demandeSaut - h);
        if (enAir && !doubleFait) demandeSaut = 0; // pas d'endurance : on ne le garde pas
      }
    }

    // verticalement : à pied il suit le sol (il monte ou descend une marche, ou tombe d'un rebord) ; en l'air, la
    // pesanteur (suspendue pendant un dash en l'air), et la glissade le long d'un mur qu'il pousse en retombant
    if (!enAir) {
      tolerance = TOLERANCE;
      const sol = solSous(pos.x, pos.z, alt + MARCHE);
      if (sol < alt - MARCHE) {
        enAir = true; // plus rien sous ses pieds
        vy = 0;
        enGlissade = false;
      } else {
        alt += (sol - alt) * (1 - Math.exp(-30 * h));
        if (Math.abs(sol - alt) < 0.002) alt = sol;
      }
    } else tolerance -= h;
    contreMur = false;
    if (enAir) {
      if (dashEn > 0 && dashAir) vy = 0;
      else vy = Math.max(vy - GRAVITE * (vy < 0 ? CHUTE : 1) * h, -8);
      if (vy < 0 && intention > 0.2) {
        const mur = murProche(0.015);
        if (mur && -(dirX * mur.nx + dirZ * mur.nz) / intention > 0.3) {
          contreMur = true;
          vy = Math.max(vy, -GLISSE_MUR);
        }
      }
      let neuve = alt + vy * h;
      if (vy > 0) {
        // il se cogne la tête contre le dessous d'un meuble ou le plafond
        for (const s of solides) {
          if (s.bas > alt + CORPS - 0.01 && s.bas < neuve + CORPS && pos.x > s.x0 - RAYON * 0.6 && pos.x < s.x1 + RAYON * 0.6 && pos.z > s.z0 - RAYON * 0.6 && pos.z < s.z1 + RAYON * 0.6) {
            neuve = s.bas - CORPS;
            vy = 0;
          }
        }
        const toit = plafond(pos.z) - CORPS;
        if (neuve > toit) {
          neuve = toit;
          vy = 0;
        }
      } else {
        const sol = solSous(pos.x, pos.z, alt + 0.03);
        if (neuve <= sol) {
          neuve = sol;
          enAir = false;
          doubleFait = false;
          mursSautes = 0;
          if (dashAir) dashEn = 0;
          if (vy < -2) sons.atterrir(); // pas pour une petite chute
          vy = 0;
          atterri = 0; // petit écrasement à l'arrivée
        }
      }
      alt = Math.max(0, neuve);
    }
  }

  // --- À chaque image ---
  function maj(dt) {
    if (!actif) return;

    // l'intention : les touches sont relatives à la caméra (avant = là où on regarde)
    let ix = (presse('droite') ? 1 : 0) - (presse('gauche') ? 1 : 0) + stick.x;
    let iz = (presse('haut') ? 1 : 0) - (presse('bas') ? 1 : 0) - stick.y;
    const norme = Math.hypot(ix, iz);
    if (norme > 1) [ix, iz] = [ix / norme, iz / norme];
    const [fx, fz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const [dirX, dirZ] = [fx * iz - fz * ix, fz * iz + fx * ix]; // devant = (fx, fz), à droite = (-fz, fx)
    const intention = Math.hypot(dirX, dirZ);
    const accroupiTenu = touche.has('control') || touche.has('c');

    const pasPhysique = Math.max(1, Math.ceil(dt / PAS_PHYSIQUE));
    for (let i = 0; i < pasPhysique; i++) physique(dt / pasPhysique, dirX, dirZ, intention, fx, fz, accroupiTenu);
    majEndurance();

    const vitH = vit.length();
    // il se tourne vers où il va (contre un mur, il lui fait face), et se penche un peu dans le virage
    const capAvant = cap;
    if (vitH > 0.15) cap += angle(Math.atan2(vit.x, vit.y) - cap) * (1 - Math.exp(-(dashEn > 0 ? 22 : 14) * dt));
    const virage = dt > 0 ? (cap - capAvant) / dt : 0;
    const roulisVoulu = THREE.MathUtils.clamp(-virage * 0.045, -0.28, 0.28) * Math.min(1, vitH / COURSE) * (enAir ? 0.4 : 1);
    roulis += (roulisVoulu - roulis) * (1 - Math.exp(-10 * dt));

    // coincé dans un meuble (une boîte de collision approximative, un atterrissage de travers) : au bout d'un
    // instant, on le remet tout seul sur la place libre la plus proche
    if (!libre(pos.x, pos.z, alt)) {
      coince += dt;
      if (coince > 0.3) debloquer();
    } else coince = 0;
    // il pousse sans avancer : on lui rappelle la touche R
    sansProgres = intention > 0.4 && vitH < 0.08 && !enAir ? sansProgres + dt : 0;

    // démarche : il se dandine au rythme des pas, se penche en courant et encore plus en dash, se couche en glissant
    const enMarche = vitH > 0.2 && !enAir && !enGlissade && dashEn <= 0 ? 1 : 0;
    // un bruit de pas tous les 35 cm parcourus au sol (plus espacés accroupi)
    if (enMarche) {
      foulee += vitH * dt;
      if (foulee > (bas ? 0.5 : 0.35)) {
        foulee = 0;
        sons.pas();
      }
    }
    allure += (enMarche - allure) * (1 - Math.exp(-12 * dt));
    phase += vitH * dt * (bas ? 34 : 26);
    corps.rotation.z = Math.sin(phase) * allure * (bas ? 0.1 : 0.16) + roulis;
    const penche = 0.12 * allure + (dashEn > 0 ? 0.35 : 0) - (enGlissade ? 0.5 : 0) + (contreMur ? -0.15 : 0);
    corps.rotation.x += (penche - corps.rotation.x) * (1 - Math.exp(-14 * dt));
    corps.position.y = Math.abs(Math.sin(phase)) * 0.012 * allure;
    // il s'étire en montant et pendant un dash, s'écrase en retombant, en glissant ou accroupi
    airLisse += ((enAir ? 1 : 0) - airLisse) * (1 - Math.exp(-16 * dt));
    atterri = Math.min(1, atterri + dt / 0.16);
    squat += ((bas ? 0.55 : 1) - squat) * (1 - Math.exp(-18 * dt));
    const ecrase = Math.sin(Math.PI * atterri) * 0.18 * (atterri < 1 ? 1 : 0);
    const etire = airLisse * 0.1 * THREE.MathUtils.clamp(Math.abs(vy) / 3, 0, 1) + (dashEn > 0 ? 0.06 : 0);
    const large = 1 + ecrase * 0.6 - etire * 0.4 + (1 - squat) * 0.35;
    perso.scale.set(large, (1 - ecrase + etire) * squat, large);
    decalage.multiplyScalar(Math.exp(-22 * dt));
    perso.position.set(pos.x + decalage.x, alt + decalage.y, pos.z + decalage.z);
    perso.rotation.y = cap;

    // la vue s'élargit avec la vitesse (de la course au dash), et un peu plus en glissade
    fovVoulu = 62 + 10 * THREE.MathUtils.clamp((vitH - COURSE) / (VITESSE_DASH - COURSE), 0, 1) + (enGlissade ? 4 : 0);
    suivreCamera(dt);

    delaiCible -= dt;
    if (delaiCible <= 0) {
      delaiCible = 0.15;
      cible = chercherCible();
      const bloque = !cible && sansProgres > 1.2;
      el.action.hidden = !cible && !bloque;
      if (cible) el.action.textContent = `${touches ? '' : 'E · '}${libelle(cible)}`;
      else if (bloque) el.action.textContent = touches ? 'Bloqué ? Touche « Débloquer »' : 'Bloqué ? Appuie sur R pour te débloquer';
      el.agir.classList.toggle('pret', !!cible);
    }
  }

  return { activer, desactiver, maj, get actif() { return actif; } };
}
