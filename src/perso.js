import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { chemin } from './textures.js';
import { sons } from './sons.js';

// Mode secret : un tout petit bonhomme qu'on promène dans la chambre, à la troisième personne, avec un
// déplacement inspiré de Deadlock : le bonhomme reste au centre de l'écran, la souris oriente la caméra,
// et les touches sont RELATIVES À LA CAMÉRA (Z/↑ avance vers où l'on regarde, Q/D se décale, S recule).
// Il garde son élan (accélération, inertie, contrôle réduit en l'air), sprinte (Maj), glisse (Ctrl ou C),
// saute et fait un double saut avec un petit dash (Espace, deux fois). E agit sur ce qui est devant lui
// (porte, lumières, store, calendrier…), Échap sort. On y entre par trois clics rapides sur un des petits
// avions du mobile (voir main.js). Un clic dans la scène capte la souris ; Échap la rend, un second Échap quitte.
// Sur téléphone : un joystick pour bouger, un glissé du doigt pour regarder, et les boutons « Agir » et « Saut ».
// Le personnage vit dans le repère de la pièce (x ouest→est, z nord→sud).
//
// Le modèle est « Frutiger aero character v2 » (public/models/perso.glb), un bonhomme vert brillant sans
// squelette : le dandinement, l'inclinaison et l'écrasement sont faits ici, en code.

// ↓↓↓ À RÉGLER ↓↓↓
// Hauteur maximale d'un saut, en mètres. Pour monter dessus : la chaise (0,45), le lit (0,6), le bureau
// (0,75) et la commode (1,0) demandent un saut d'au moins leur hauteur.
const HAUTEUR_SAUT = 1.15;
const DOUBLE_SAUT = 0.8; // le second saut, en l'air, monte de cette part de la hauteur du premier
const DASH_AIR = 1.6; // m/s ajoutés dans la direction visée par le double saut
const GRAVITE = 9.8; // m/s² : moins = des sauts plus longs et plus flottants
const VITESSE = 1.1; // m/s à pied
const SPRINT = 1.75; // facteur de vitesse avec Maj
const GLISSADE = 2.9; // m/s au départ d'une glissade (Ctrl ou C pendant qu'il court)
const DUREE_GLISSADE = 0.85; // secondes
const ACCELERATION = 11; // plus c'est grand, plus il démarre et s'arrête vite au sol
const CONTROLE_AIR = 2.6; // idem en l'air : petit = il garde son élan et se redirige peu
const SENSIBILITE = 0.0022; // souris, radians par pixel
const TAILLE = 0.3; // hauteur du bonhomme, en mètres
// ↑↑↑

export function creerPerso({ renderer, racine, camera, controls, interactions, contour, meubles, fixes = [], cliquables, basculer, piece }) {
  const { largeur: W, profondeur: D, hauteur: H, hauteurMurBas: K, penteProfondeur: R } = piece;
  const RAYON = 0.085; // épaisseur du bonhomme pour les collisions (les bras dépassent un peu du corps)
  const CORPS_DEBOUT = TAILLE + 0.03; // hauteur occupée, pour passer sous un meuble ou se cogner la tête
  let CORPS = CORPS_DEBOUT; // plus basse pendant une glissade
  const MARCHE = 0.08; // il monte tout seul une marche de cette hauteur

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
    for (const p of m.parties ?? []) {
      const [l, h, pr] = p.forme === 'cylindre' ? [p.taille[0], p.taille[1], p.taille[0]] : p.forme === 'sphere' || p.forme === 'tore' ? [p.taille[0], p.taille[0], p.taille[0]] : p.taille;
      const bas = p.centre ? p.pos[1] - h / 2 : p.pos[1];
      const [x, z] = [m.pos[0] + p.pos[0], m.pos[1] + p.pos[2]];
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
  // son corps, à la hauteur y, touche-t-il un solide plus haut qu'une marche ?
  const bute = (x, z, y) =>
    solides.some((s) => x > s.x0 - RAYON && x < s.x1 + RAYON && z > s.z0 - RAYON && z < s.z1 + RAYON && s.haut > y + MARCHE && s.bas < y + CORPS);
  const libre = (x, z, y) => dansContour(x, z) && distanceAuxBords(x, z) >= RAYON * 0.8 && !bute(x, z, y);
  // le dessus le plus haut qui le porterait en (x, z), sans dépasser `max`
  const solSous = (x, z, max) => {
    let h = 0;
    for (const s of solides) if (s.marche && s.haut <= max && s.haut > h && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) h = s.haut;
    return h;
  };
  // hauteur du plafond au-dessus de z (la pente descend vers le sud)
  const plafond = (z) => (z <= D - R ? H : Math.max(K, H - ((z - (D - R)) * (H - K)) / R));
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
        if (libre(cx, cz, hauteur)) return { x: cx, z: cz, alt: hauteur };
      }
    }
    const [dx, dz] = DEPARTS.find(([dx, dz]) => libre(dx, dz, 0)) ?? DEPARTS[0];
    return { x: dx, z: dz, alt: 0 };
  }

  // --- Interface et commandes ---
  const el = {
    aide: document.getElementById('perso-aide'),
    action: document.getElementById('perso-action'),
    quitter: document.getElementById('perso-quitter'),
    debloquer: document.getElementById('perso-debloquer'),
    stick: document.getElementById('perso-stick'),
    pomme: document.getElementById('perso-pomme'),
    agir: document.getElementById('perso-agir'),
    saut: document.getElementById('perso-saut'),
  };
  const touches = matchMedia('(pointer: coarse)').matches;
  const touche = new Set();
  const stick = { x: 0, y: 0 }; // -1…1, haut = avancer
  let actif = false;
  let temps = 0;
  let alt = 0; // hauteur de ses pieds
  let vy = 0;
  let enAir = false;
  let airLisse = 0; // 0 au sol, 1 en l'air (lissé, pour l'étirement)
  let atterri = 1; // chronomètre de l'écrasement à l'arrivée (1 = terminé)
  let sauts = 0; // appuis sur Espace en attente (deux appuis rapides = saut puis double saut)
  let doubleFait = false; // le double saut n'a lieu qu'une fois par vol
  let glisseEn = 0; // temps restant de la glissade
  let foulee = 0; // distance parcourue depuis le dernier bruit de pas
  let veutGlisser = false;
  let coince = 0; // depuis combien de temps il est dans un meuble
  let sansProgres = 0; // depuis combien de temps il pousse sans avancer
  let squat = 1; // 1 debout, ~0,5 en glissade (lissé)
  let fovVoulu = 62;
  const vit = new THREE.Vector2(); // vitesse horizontale (x, z), avec son inertie
  let tangage = 0.3; // hauteur de la caméra autour de lui (radians au-dessus de l'horizontale)
  let distance = 0.82;
  let dernierGlisse = -10; // moment du dernier glissé de souris : la caméra ne le contrarie pas tout de suite
  let cap = 0; // direction du bonhomme : devant lui = (sin cap, cos cap), tourné vers où il va
  let capCamera = 0; // direction de la caméra, pilotée par la souris
  let verrou = false; // souris captée (pointer lock)
  const pos = new THREE.Vector3();
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
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!actif || e.metaKey || e.altKey || (e.ctrlKey && k !== 'control')) return;
    if (k === 'escape') return desactiver();
    if (k === 'control' || k === 'c') {
      e.preventDefault();
      if (!e.repeat) veutGlisser = true;
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) sauts = Math.min(2, sauts + 1);
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
    if (k === 'shift' || Object.values(NOMS_TOUCHES).some((l) => l.includes(k))) {
      e.preventDefault();
      touche.add(k);
    }
  });
  window.addEventListener('keyup', (e) => touche.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => touche.clear());
  el.quitter.addEventListener('click', () => desactiver());
  el.debloquer.addEventListener('click', () => debloquer());
  el.agir.addEventListener('click', agir);
  el.saut.addEventListener('click', () => (sauts = Math.min(2, sauts + 1)));
  // les boutons ne gardent pas le focus : Espace ne doit pas les « cliquer » à la place du saut
  for (const b of [el.quitter, el.debloquer, el.agir, el.saut]) b.addEventListener('pointerdown', (e) => e.preventDefault());

  // la souris oriente la caméra (un clic dans la scène la capte) ; sans souris captée ou au doigt, on glisse ;
  // la molette change la distance
  const canvas = controls.domElement;
  const regarder = (dx, dy, k) => {
    capCamera -= (dx || 0) * k;
    tangage = THREE.MathUtils.clamp(tangage + (dy || 0) * k * 0.8, -0.2, 1.25);
    dernierGlisse = temps;
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
    el.aide.textContent = verrou
      ? 'ZQSD : bouger · Souris : caméra · Maj : sprint · Espace : sauter (2×) · Ctrl : glisser · E : agir · R : débloquer · Échap : libérer la souris'
      : (touches ? 'Joystick : bouger · Glisse le doigt : regarder' : 'Clique dans la scène pour piloter la caméra à la souris · ZQSD : bouger · Maj : sprint · Espace : sauter (2×) · Ctrl : glisser · E : agir · R : débloquer · Échap : quitter');
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
    const [x, z] = DEPARTS.find(([x, z]) => libre(x, z, 0)) ?? DEPARTS[0];
    pos.set(x, 0, z);
    alt = vy = 0;
    enAir = false;
    sauts = 0;
    doubleFait = false;
    glisseEn = 0;
    veutGlisser = false;
    squat = 1;
    vit.set(0, 0);
    tangage = 0.3;
    distance = 1.0;
    cap = capCamera = Math.atan2(W / 2 - x, D / 2 - z);
    perso.position.copy(pos);
    perso.rotation.y = cap;
    perso.visible = true;
    texteAide();
    el.aide.hidden = false;
    el.quitter.hidden = false;
    el.debloquer.hidden = false;
    coince = sansProgres = 0;
    if (touches) el.stick.hidden = el.agir.hidden = el.saut.hidden = false;
    el.aide.classList.remove('estompee');
    setTimeout(() => el.aide.classList.add('estompee'), 7000);
  }
  function desactiver() {
    if (!actif) return;
    actif = false;
    touche.clear();
    stick.x = stick.y = 0;
    document.body.classList.remove('perso');
    perso.visible = false;
    el.aide.hidden = el.quitter.hidden = el.debloquer.hidden = el.stick.hidden = el.agir.hidden = el.saut.hidden = el.action.hidden = true;
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
  // vers où il va.
  function suivreCamera(dt) {
    const k = 1 - Math.exp(-20 * dt);
    const [sx, cz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const hy = alt + TAILLE * 0.6 * squat; // le point visé : le milieu de son corps
    const [horiz, vert] = [Math.cos(tangage) * distance, Math.sin(tangage) * distance];
    const epaule = 0.06; // vers la droite de l'écran : lui un peu à gauche du viseur
    const [rx, rz] = [-cz, sx];
    // on se rapproche de lui tant que la caméra serait dans un mur, sous le toit ou dans un meuble
    let t = 1;
    for (; t > 0.2; t -= 0.07) {
      if (cameraLibre(pos.x - sx * horiz * t + rx * epaule, Math.max(0.06, hy + vert * t), pos.z - cz * horiz * t + rz * epaule)) break;
    }
    cameraVoulue.set(pos.x - sx * horiz * t + rx * epaule, Math.max(0.06, hy + vert * t), pos.z - cz * horiz * t + rz * epaule).add(racine.position);
    regardVoulu.set(pos.x + rx * epaule * 0.5 + sx * 0.25, hy, pos.z + rz * epaule * 0.5 + cz * 0.25).add(racine.position);
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
    vy = 0;
    enAir = false;
    vit.set(0, 0);
    glisseEn = 0;
    atterri = 0; // un petit « plop » pour qu'on voie qu'il a bougé
    coince = sansProgres = 0;
  }

  // --- À chaque image ---
  function maj(dt) {
    if (!actif) return;
    temps += dt;

    // l'intention : les touches sont relatives à la caméra (avant = là où on regarde)
    let ix = (presse('droite') ? 1 : 0) - (presse('gauche') ? 1 : 0) + stick.x;
    let iz = (presse('haut') ? 1 : 0) - (presse('bas') ? 1 : 0) - stick.y;
    const n = Math.hypot(ix, iz);
    if (n > 1) [ix, iz] = [ix / n, iz / n];
    const [fx, fz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const [dirX, dirZ] = [fx * iz - fz * ix, fz * iz + fx * ix]; // devant = (fx, fz), à droite = (-fz, fx)
    const intention = Math.hypot(dirX, dirZ);
    const sprint = touche.has('shift') && intention > 0.1 && !enAir && glisseEn <= 0;

    // glissade : un élan au départ d'une course, qui s'éteint tout seul
    if (veutGlisser) {
      veutGlisser = false;
      if (!enAir && glisseEn <= 0 && vit.length() > 0.7) {
        glisseEn = DUREE_GLISSADE;
        sons.glisser();
        vit.normalize().multiplyScalar(GLISSADE);
      }
    }
    CORPS = glisseEn > 0 ? CORPS_DEBOUT * 0.5 : CORPS_DEBOUT;

    // vitesse horizontale, avec son inertie : vive au sol, presque inchangée en l'air
    if (glisseEn > 0) {
      glisseEn -= dt;
      vit.multiplyScalar(Math.exp(-1.6 * dt));
      vit.x += dirX * 1.2 * dt; // on peut un peu infléchir la glissade
      vit.y += dirZ * 1.2 * dt;
    } else {
      const vitesseVisee = VITESSE * (sprint ? SPRINT : 1);
      const rythme = enAir ? (intention > 0.05 ? CONTROLE_AIR : 0.35) : ACCELERATION * (intention > 0.05 ? 1 : 1.2);
      const k = 1 - Math.exp(-rythme * dt);
      vit.x += (dirX * vitesseVisee - vit.x) * k;
      vit.y += (dirZ * vitesseVisee - vit.y) * k;
    }
    vit.clampLength(0, 4);
    // il avance un axe après l'autre : contre un obstacle il glisse le long, et perd seulement cette vitesse-là
    const [mx, mz] = [vit.x * dt, vit.y * dt];
    if (mx !== 0) {
      if (libre(pos.x + mx, pos.z, alt)) pos.x += mx;
      else vit.x = 0;
    }
    if (mz !== 0) {
      if (libre(pos.x, pos.z + mz, alt)) pos.z += mz;
      else vit.y = 0;
    }
    const vitH = vit.length();
    // il se tourne vers où il va
    if (vitH > 0.15) {
      const ecart = THREE.MathUtils.euclideanModulo(Math.atan2(vit.x, vit.y) - cap + Math.PI, Math.PI * 2) - Math.PI;
      cap += ecart * (1 - Math.exp(-14 * dt));
    }

    // saut, puis double saut en l'air avec un petit dash dans la direction visée
    if (sauts > 0) {
      sauts--;
      if (!enAir) {
        enAir = true;
        vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT);
        glisseEn = 0;
        sons.saut(false);
      } else if (!doubleFait) {
        doubleFait = true;
        vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT * DOUBLE_SAUT);
        sons.saut(true);
        if (intention > 0.1) {
          vit.x += (dirX / intention) * DASH_AIR;
          vit.y += (dirZ / intention) * DASH_AIR;
        }
        atterri = 0; // un petit coup d'écrasement, comme une impulsion
      }
    }

    // verticalement : à pied il suit le sol (il monte une marche, ou tombe d'un rebord) ; en l'air, la pesanteur
    if (!enAir) {
      const sol = solSous(pos.x, pos.z, alt + MARCHE);
      if (sol < alt - 0.01) {
        enAir = true; // plus rien sous ses pieds
        vy = 0;
      } else {
        alt += (sol - alt) * (1 - Math.exp(-30 * dt));
        if (Math.abs(sol - alt) < 0.002) alt = sol;
      }
    }
    if (enAir) {
      vy -= GRAVITE * dt;
      let neuve = alt + vy * dt;
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
          if (vy < -2) sons.atterrir(); // pas pour une simple marche descendue
          vy = 0;
          atterri = 0; // petit écrasement à l'arrivée
        }
      }
      alt = Math.max(0, neuve);
    }

    // coincé dans un meuble (une boîte de collision approximative, un atterrissage de travers) : au bout d'un
    // instant, on le remet tout seul sur la place libre la plus proche
    if (!libre(pos.x, pos.z, alt)) {
      coince += dt;
      if (coince > 0.3) debloquer();
    } else coince = 0;
    // il pousse sans avancer : on lui rappelle la touche R
    sansProgres = intention > 0.4 && vitH < 0.08 && !enAir ? sansProgres + dt : 0;

    // démarche : il se dandine au rythme des pas, se penche en courant, se couche en glissant
    const enMarche = vitH > 0.2 && !enAir && glisseEn <= 0 ? 1 : 0;
    // un bruit de pas tous les 35 cm parcourus au sol
    if (enMarche) {
      foulee += vitH * dt;
      if (foulee > 0.35) {
        foulee = 0;
        sons.pas();
      }
    }
    allure += (enMarche - allure) * (1 - Math.exp(-12 * dt));
    phase += vitH * dt * 26;
    corps.rotation.z = Math.sin(phase) * allure * 0.16;
    const penche = (sprint ? 0.2 : 0.1) * allure - (glisseEn > 0 ? 0.5 : 0);
    corps.rotation.x += (penche - corps.rotation.x) * (1 - Math.exp(-14 * dt));
    corps.position.y = Math.abs(Math.sin(phase)) * 0.012 * allure;
    // il s'étire en montant, s'écrase en retombant ou en glissant
    airLisse += ((enAir ? 1 : 0) - airLisse) * (1 - Math.exp(-16 * dt));
    atterri = Math.min(1, atterri + dt / 0.16);
    squat += ((glisseEn > 0 ? 0.55 : 1) - squat) * (1 - Math.exp(-18 * dt));
    const ecrase = Math.sin(Math.PI * atterri) * 0.18 * (atterri < 1 ? 1 : 0);
    const etire = airLisse * 0.1 * THREE.MathUtils.clamp(Math.abs(vy) / 3, 0, 1);
    const large = 1 + ecrase * 0.6 - etire * 0.4 + (1 - squat) * 0.35;
    perso.scale.set(large, (1 - ecrase + etire) * squat, large);
    perso.position.set(pos.x, alt, pos.z);
    perso.rotation.y = cap;

    // la vue s'élargit quand il court ou glisse
    fovVoulu = 62 + (sprint && vitH > 1.2 ? 8 : 0) + (glisseEn > 0 ? 5 : 0);
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
