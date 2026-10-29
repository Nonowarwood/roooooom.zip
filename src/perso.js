import * as THREE from 'three';

// Mode secret : un tout petit bonhomme pastel qu'on promène dans la chambre, vue de derrière.
// On y entre par trois clics rapides sur un des petits avions du mobile (voir main.js).
// Flèches ou ZQSD pour marcher (haut/bas avance, gauche/droite tourne), E pour agir sur ce qui est
// devant lui (porte, lumières, store, calendrier…), Échap pour sortir. Sur téléphone : un joystick et
// un bouton « Agir ». Le personnage vit dans le repère de la pièce (x ouest→est, z nord→sud).
export function creerPerso({ racine, camera, controls, interactions, contour, meubles, cliquables, basculer, piece }) {
  const { largeur: W, profondeur: D, hauteur: H, hauteurMurBas: K, penteProfondeur: R } = piece;
  const RAYON = 0.075; // épaisseur du bonhomme pour les collisions
  const VITESSE = 0.95; // m/s
  const TOURNE = 2.7; // rad/s

  // --- Le bonhomme : formes rondes, couleurs pastel, comme le reste de la pièce ---
  const mat = (couleur, extra = {}) => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, ...extra });
  const corpsMat = mat('#a6dcc8');
  const peauMat = mat('#ffe2cf');
  const cheveuxMat = mat('#5e4866');
  const piedMat = mat('#f0a8b0');
  const noir = mat('#2a2230', { roughness: 0.5 });
  const joueMat = mat('#f6b0b8');

  const ombrer = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const forme = (geo, materiau, x, y, z) => {
    const m = ombrer(new THREE.Mesh(geo, materiau));
    m.position.set(x, y, z);
    return m;
  };

  const perso = new THREE.Group();
  perso.name = 'petit bonhomme';
  perso.visible = false;
  const corps = new THREE.Group(); // tout ce qui se balance, au-dessus des pieds
  perso.add(corps);
  corps.add(forme(new THREE.CapsuleGeometry(0.05, 0.07, 4, 12), corpsMat, 0, 0.135, 0));
  corps.add(forme(new THREE.SphereGeometry(0.068, 20, 16), peauMat, 0, 0.255, 0));
  // calotte de cheveux, un petit épi et une frange
  const calotte = forme(new THREE.SphereGeometry(0.073, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), cheveuxMat, 0, 0.262, -0.004);
  calotte.rotation.x = -0.25;
  corps.add(calotte);
  corps.add(forme(new THREE.SphereGeometry(0.02, 10, 8), cheveuxMat, 0.012, 0.335, -0.005));
  // visage vers +z : deux yeux, deux joues
  for (const sx of [-1, 1]) {
    corps.add(forme(new THREE.SphereGeometry(0.0085, 8, 8), noir, sx * 0.027, 0.252, 0.062));
    const joue = forme(new THREE.SphereGeometry(0.011, 8, 6), joueMat, sx * 0.043, 0.234, 0.053);
    joue.scale.set(1, 0.7, 0.4);
    corps.add(joue);
  }
  // bras et jambes : un pivot à l'épaule / à la hanche, pour balancer
  const membre = (rayon, longueur, materiau, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(forme(new THREE.CapsuleGeometry(rayon, longueur, 3, 8), materiau, 0, -longueur / 2 - rayon * 0.5, 0));
    return pivot;
  };
  const bras = [membre(0.0165, 0.05, corpsMat, -0.064, 0.17), membre(0.0165, 0.05, corpsMat, 0.064, 0.17)];
  const jambes = [membre(0.02, 0.04, peauMat, -0.027, 0.075), membre(0.02, 0.04, peauMat, 0.027, 0.075)];
  for (const j of jambes) j.add(forme(new THREE.SphereGeometry(0.026, 10, 8), piedMat, 0, -0.074, 0.012));
  corps.add(...bras);
  perso.add(...jambes);
  racine.add(perso);

  // --- Où il peut marcher : le contour de la pièce, moins les meubles posés au sol ---
  // Pour chaque meuble : le rectangle des pièces qui touchent le bas (moins de 40 cm du sol) et la hauteur
  // de son sommet (la caméra, derrière lui, ne doit pas entrer dans un meuble plus haut qu'elle).
  const obstacles = [];
  for (const m of meubles) {
    let [x0, x1, z0, z1, haut] = [Infinity, -Infinity, Infinity, -Infinity, 0];
    for (const p of m.parties ?? []) {
      const [l, h, pr] = p.forme === 'cylindre' ? [p.taille[0], p.taille[1], p.taille[0]] : p.forme === 'sphere' || p.forme === 'tore' ? [p.taille[0], p.taille[0], p.taille[0]] : p.taille;
      const bas = p.centre ? p.pos[1] - h / 2 : p.pos[1];
      haut = Math.max(haut, bas + h);
      if (bas > 0.4) continue;
      x0 = Math.min(x0, m.pos[0] + p.pos[0] - l / 2);
      x1 = Math.max(x1, m.pos[0] + p.pos[0] + l / 2);
      z0 = Math.min(z0, m.pos[1] + p.pos[2] - pr / 2);
      z1 = Math.max(z1, m.pos[1] + p.pos[2] + pr / 2);
    }
    if (x0 < x1) obstacles.push({ nom: m.nom, x0, x1, z0, z1, haut });
  }

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
  const libre = (x, z, r = RAYON) => {
    if (!dansContour(x, z) || distanceAuxBords(x, z) < r) return false;
    return !obstacles.some((o) => x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r);
  };
  // hauteur du plafond au-dessus de z (la pente descend vers le sud)
  const plafond = (z) => (z <= D - R ? H : Math.max(K, H - ((z - (D - R)) * (H - K)) / R));
  // la caméra, elle, doit rester dans la pièce, sous le toit et hors des meubles plus hauts qu'elle
  const cameraLibre = (x, y, z) => {
    if (!dansContour(x, z) || distanceAuxBords(x, z) < 0.12 || y > plafond(z) - 0.08) return false;
    return !obstacles.some((o) => o.haut > y - 0.04 && x > o.x0 - 0.05 && x < o.x1 + 0.05 && z > o.z0 - 0.05 && z < o.z1 + 0.05);
  };

  // --- Interface et commandes ---
  const el = {
    aide: document.getElementById('perso-aide'),
    action: document.getElementById('perso-action'),
    quitter: document.getElementById('perso-quitter'),
    stick: document.getElementById('perso-stick'),
    pomme: document.getElementById('perso-pomme'),
    agir: document.getElementById('perso-agir'),
  };
  const touches = matchMedia('(pointer: coarse)').matches;
  const touche = new Set();
  const stick = { x: 0, y: 0 }; // -1…1, haut = avancer
  let actif = false;
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
    if (k === 'e' || k === 'enter' || k === ' ') {
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
    const [x, z] = departs.find(([x, z]) => libre(x, z)) ?? departs[0];
    pos.set(x, 0, z);
    cap = capCamera = Math.atan2(W / 2 - x, D / 2 - z);
    perso.position.copy(pos);
    perso.rotation.y = cap;
    perso.visible = true;
    el.aide.hidden = false;
    el.quitter.hidden = false;
    if (touches) el.stick.hidden = el.agir.hidden = false;
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
    el.aide.hidden = el.quitter.hidden = el.stick.hidden = el.agir.hidden = el.action.hidden = true;
    controls.enabled = true;
    controls.minDistance = minDistanceAvant;
    controls.maxPolarAngle = maxPolaireAvant;
    interactions.bloquer(false);
    // retour à la vue d'ensemble, par le trajet habituel de la caméra
    document.querySelector('#vues button')?.click();
    camera.fov = fovAvant;
    camera.updateProjectionMatrix();
  }

  // --- Caméra derrière lui ---
  function suivreCamera(dt, brusque = false) {
    const k = brusque ? 1 : 1 - Math.exp(-9 * dt);
    const ecart = THREE.MathUtils.euclideanModulo(cap - capCamera + Math.PI, Math.PI * 2) - Math.PI;
    capCamera += ecart * (brusque ? 1 : 1 - Math.exp(-4.5 * dt));
    const [sx, cz] = [Math.sin(capCamera), Math.cos(capCamera)];
    const tete = { x: pos.x, y: 0.22, z: pos.z };
    // on recule derrière lui, en se rapprochant tant que la caméra serait dans un mur ou un meuble
    const recul = 0.82;
    const hauteur = 0.5;
    let t = 1;
    for (; t > 0.25; t -= 0.08) {
      if (cameraLibre(tete.x - sx * recul * t, hauteur, tete.z - cz * recul * t)) break;
    }
    cameraVoulue.set(tete.x - sx * recul * t, hauteur * (0.6 + 0.4 * t), tete.z - cz * recul * t).add(racine.position);
    regardVoulu.set(pos.x + sx * 0.3, 0.2, pos.z + cz * 0.3).add(racine.position);
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
    let avance = (presse('haut') ? 1 : 0) - (presse('bas') ? 0.5 : 0) - stick.y;
    let tourne = (presse('gauche') ? 1 : 0) - (presse('droite') ? 1 : 0) - stick.x;
    avance = THREE.MathUtils.clamp(avance, -0.5, 1);
    tourne = THREE.MathUtils.clamp(tourne, -1, 1);
    cap += tourne * TOURNE * dt * (avance !== 0 ? 0.85 : 1);
    const pas = avance * VITESSE * dt;
    if (pas !== 0) {
      const [nx, nz] = [pos.x + Math.sin(cap) * pas, pos.z + Math.cos(cap) * pas];
      // si le chemin est bloqué on glisse le long de l'obstacle, un axe après l'autre
      if (libre(nx, nz)) pos.set(nx, 0, nz);
      else if (libre(nx, pos.z)) pos.x = nx;
      else if (libre(pos.x, nz)) pos.z = nz;
    }
    // démarche : les jambes et les bras se balancent selon la distance parcourue
    const enMarche = pas !== 0 ? 1 : 0;
    allure += (enMarche - allure) * (1 - Math.exp(-12 * dt));
    phase += Math.abs(pas) * 26 + (tourne !== 0 && !enMarche ? dt * 6 : 0);
    const balance = Math.sin(phase) * 0.85 * (enMarche ? allure : Math.min(1, Math.abs(tourne)) * 0.4);
    jambes[0].rotation.x = balance;
    jambes[1].rotation.x = -balance;
    bras[0].rotation.x = -balance * 0.9;
    bras[1].rotation.x = balance * 0.9;
    corps.position.y = Math.abs(Math.sin(phase)) * 0.008 * allure;
    corps.rotation.z = Math.sin(phase) * 0.05 * allure;
    perso.position.copy(pos);
    // tourne sans à-coup vers la direction voulue
    perso.rotation.y = cap;

    suivreCamera(dt);

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
