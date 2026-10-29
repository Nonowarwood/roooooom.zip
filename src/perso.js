import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { chemin } from './textures.js';

// Mode secret : un tout petit bonhomme qu'on promène dans la chambre, vue de derrière.
// On y entre par trois clics rapides sur un des petits avions du mobile (voir main.js).
// Flèches ou ZQSD pour marcher (haut/bas avance, gauche/droite tourne), Espace pour sauter, E pour agir
// sur ce qui est devant lui (porte, lumières, store, calendrier…), Échap pour sortir. La souris (ou le
// doigt) fait tourner la caméra autour de lui, la molette règle la distance. Sur téléphone : un joystick et
// deux boutons « Agir » et « Saut ». Le personnage vit dans le repère de la pièce (x ouest→est, z nord→sud).
//
// Le modèle est « Frutiger aero character v2 » (public/models/perso.glb), un bonhomme vert brillant sans
// squelette : le dandinement, l'inclinaison et l'écrasement sont faits ici, en code.

// ↓↓↓ À RÉGLER ↓↓↓
// Hauteur maximale d'un saut, en mètres. Pour monter dessus : la chaise (0,45), le lit (0,6), le bureau
// (0,75) et la commode (1,0) demandent un saut d'au moins leur hauteur.
const HAUTEUR_SAUT = 1.15;
const GRAVITE = 9.8; // m/s² : moins = des sauts plus longs et plus flottants
const VITESSE = 0.95; // m/s à pied
const TOURNE = 2.7; // rad/s
const TAILLE = 0.3; // hauteur du bonhomme, en mètres
// ↑↑↑

export function creerPerso({ renderer, racine, camera, controls, interactions, contour, meubles, fixes = [], cliquables, basculer, piece }) {
  const { largeur: W, profondeur: D, hauteur: H, hauteurMurBas: K, penteProfondeur: R } = piece;
  const RAYON = 0.1; // épaisseur du bonhomme pour les collisions (les bras dépassent un peu du corps)
  const CORPS = TAILLE + 0.03; // hauteur occupée, pour passer sous un meuble ou se cogner la tête
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

  // --- Interface et commandes ---
  const el = {
    aide: document.getElementById('perso-aide'),
    action: document.getElementById('perso-action'),
    quitter: document.getElementById('perso-quitter'),
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
  let saute = false;
  let tangage = 0.3; // hauteur de la caméra autour de lui (radians au-dessus de l'horizontale)
  let distance = 0.82;
  let dernierGlisse = -10; // moment du dernier glissé de souris : la caméra ne le contrarie pas tout de suite
  let cap = 0; // direction du bonhomme : devant lui = (sin cap, cos cap)
  let capCamera = 0;
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
    if (!actif || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') return desactiver();
    if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) saute = true;
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
  el.agir.addEventListener('click', agir);
  el.saut.addEventListener('click', () => (saute = true));
  // les boutons ne gardent pas le focus : Espace ne doit pas les « cliquer » à la place du saut
  for (const b of [el.quitter, el.agir, el.saut]) b.addEventListener('pointerdown', (e) => e.preventDefault());

  // la souris (ou un doigt) fait tourner la caméra autour de lui ; la molette change la distance
  const canvas = controls.domElement;
  let glisse = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!actif) return;
    glisse = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!actif || !glisse || e.pointerId !== glisse.id) return;
    capCamera -= (e.clientX - glisse.x) * 0.006;
    tangage = THREE.MathUtils.clamp(tangage + (e.clientY - glisse.y) * 0.004, -0.15, 1.2);
    glisse.x = e.clientX;
    glisse.y = e.clientY;
    dernierGlisse = temps;
  });
  const finGlisse = (e) => glisse && e.pointerId === glisse.id && (glisse = null);
  canvas.addEventListener('pointerup', finGlisse);
  canvas.addEventListener('pointercancel', finGlisse);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!actif) return;
      e.preventDefault();
      distance = THREE.MathUtils.clamp(distance * (1 + Math.sign(e.deltaY) * 0.1), 0.35, 3);
    },
    { passive: false },
  );

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
    const departs = [[1.0, 1.4], [0.9, 1.0], [1.0, 2.9], [1.5, 1.2], [2.0, 1.4]];
    const [x, z] = departs.find(([x, z]) => libre(x, z, 0)) ?? departs[0];
    pos.set(x, 0, z);
    alt = vy = 0;
    enAir = false;
    saute = false;
    tangage = 0.3;
    distance = 0.82;
    cap = capCamera = Math.atan2(W / 2 - x, D / 2 - z);
    perso.position.copy(pos);
    perso.rotation.y = cap;
    perso.visible = true;
    el.aide.hidden = false;
    el.quitter.hidden = false;
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
    el.aide.hidden = el.quitter.hidden = el.stick.hidden = el.agir.hidden = el.saut.hidden = el.action.hidden = true;
    controls.enabled = true;
    controls.minDistance = minDistanceAvant;
    controls.maxPolarAngle = maxPolaireAvant;
    interactions.bloquer(false);
    // retour à la vue d'ensemble, par le trajet habituel de la caméra
    document.querySelector('#vues button')?.click();
    camera.fov = fovAvant;
    camera.updateProjectionMatrix();
  }

  // --- Caméra autour de lui ---
  // Elle se place derrière lui, à la distance et à la hauteur choisies à la souris. `suit` : elle revient
  // doucement derrière son dos quand il marche ou tourne, sauf juste après un glissé de souris.
  function suivreCamera(dt, suit) {
    const k = 1 - Math.exp(-9 * dt);
    if (suit && temps - dernierGlisse > 1) {
      const ecart = THREE.MathUtils.euclideanModulo(cap - capCamera + Math.PI, Math.PI * 2) - Math.PI;
      capCamera += ecart * (1 - Math.exp(-3.2 * dt));
    }
    const [sx, cz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const hy = alt + TAILLE * 0.75; // le point visé : sa tête
    const [horiz, vert] = [Math.cos(tangage) * distance, Math.sin(tangage) * distance];
    // on se rapproche de lui tant que la caméra serait dans un mur, sous le toit ou dans un meuble
    let t = 1;
    for (; t > 0.2; t -= 0.07) {
      if (cameraLibre(pos.x - sx * horiz * t, Math.max(0.06, hy + vert * t), pos.z - cz * horiz * t)) break;
    }
    cameraVoulue.set(pos.x - sx * horiz * t, Math.max(0.06, hy + vert * t), pos.z - cz * horiz * t).add(racine.position);
    regardVoulu.set(pos.x + sx * 0.18, hy - 0.04, pos.z + cz * 0.18).add(racine.position);
    camera.position.lerp(cameraVoulue, k);
    controls.target.lerp(regardVoulu, k);
    camera.fov += (62 - camera.fov) * k;
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

  // --- À chaque image ---
  function maj(dt) {
    if (!actif) return;
    temps += dt;
    let avance = (presse('haut') ? 1 : 0) - (presse('bas') ? 0.5 : 0) - stick.y;
    let tourne = (presse('gauche') ? 1 : 0) - (presse('droite') ? 1 : 0) - stick.x;
    avance = THREE.MathUtils.clamp(avance, -0.5, 1);
    tourne = THREE.MathUtils.clamp(tourne, -1, 1);
    cap += tourne * TOURNE * dt * (avance !== 0 ? 0.85 : 1);
    const pas = avance * VITESSE * dt;
    if (pas !== 0) {
      const [nx, nz] = [pos.x + Math.sin(cap) * pas, pos.z + Math.cos(cap) * pas];
      // si le chemin est bloqué on glisse le long de l'obstacle, un axe après l'autre
      if (libre(nx, nz, alt)) pos.set(nx, 0, nz);
      else if (libre(nx, pos.z, alt)) pos.x = nx;
      else if (libre(pos.x, nz, alt)) pos.z = nz;
    }

    // verticalement : à pied il suit le sol (il monte une marche, ou tombe d'un rebord) ; en l'air, la pesanteur
    if (saute && !enAir) {
      enAir = true;
      vy = Math.sqrt(2 * GRAVITE * HAUTEUR_SAUT);
    }
    saute = false;
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
          vy = 0;
          atterri = 0; // petit écrasement à l'arrivée
        }
      }
      alt = Math.max(0, neuve);
    }

    // démarche : il se dandine, pivote autour des pieds au rythme des pas et se penche en avançant
    const enMarche = pas !== 0 && !enAir ? 1 : 0;
    allure += (enMarche - allure) * (1 - Math.exp(-12 * dt));
    phase += Math.abs(pas) * 26 + (tourne !== 0 && !enMarche ? dt * 6 : 0);
    const balance = Math.sin(phase) * (enMarche ? allure : Math.min(1, Math.abs(tourne)) * 0.35);
    corps.rotation.z = balance * 0.16;
    corps.rotation.x = 0.1 * allure * Math.sign(avance || 1);
    corps.position.y = Math.abs(Math.sin(phase)) * 0.012 * allure;
    // il s'étire en montant et s'écrase en retombant
    airLisse += ((enAir ? 1 : 0) - airLisse) * (1 - Math.exp(-16 * dt));
    atterri = Math.min(1, atterri + dt / 0.16);
    const ecrase = Math.sin(Math.PI * atterri) * 0.18 * (atterri < 1 ? 1 : 0);
    const etire = airLisse * 0.1 * THREE.MathUtils.clamp(Math.abs(vy) / 3, 0, 1);
    perso.scale.set(1 + ecrase * 0.6 - etire * 0.4, 1 - ecrase + etire, 1 + ecrase * 0.6 - etire * 0.4);
    perso.position.set(pos.x, alt, pos.z);
    perso.rotation.y = cap;

    suivreCamera(dt, enMarche === 1 || tourne !== 0);

    delaiCible -= dt;
    if (delaiCible <= 0) {
      delaiCible = 0.15;
      cible = chercherCible();
      el.action.hidden = !cible;
      if (cible) el.action.textContent = `${touches ? '' : 'E · '}${libelle(cible)}`;
      el.agir.classList.toggle('pret', !!cible);
    }
  }


  return { activer, desactiver, maj, get actif() { return actif; } };
}
