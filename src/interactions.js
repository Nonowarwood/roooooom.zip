import * as THREE from 'three';

// Tout ce qui se fait à la souris ou au doigt : cliquer sur ce qui réagit (calendrier, store du Velux,
// lampes, télé) et la caméra qui se place en face, les vues prédéfinies et les interrupteurs. Un clic ne
// met rien en surbrillance et n'ouvre pas de fiche. `maj(dt)` est à appeler à chaque image.
export function initialiserInteractions({
  canvas,
  camera,
  controls,
  racine,
  murs,
  cliquables,
  vues,
  commandes,
  estAllume,
  basculer,
  toutAuto,
  reglages,
  limitePolaire,
}) {
  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  const elVues = document.getElementById('vues');
  const elLumieres = document.getElementById('lumieres');

  const versScene = ([x, y, z]) => new THREE.Vector3(x, y, z).add(racine.position);
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // --- Caméra : le même système de mouvement que la référence ---
  //  focusTo : déplacement entre deux vues, en arc (courbe de Bézier dont le milieu est relevé de 30 %
  //            de la distance), 1,15 s, accélération/décélération « cubique » ;
  //  goTo    : pivot doux, la caméra rattrape sa cible en coordonnées sphériques (angle par le plus court
  //            chemin), lissage exponentiel de 4 par seconde ;
  //  zoomBy  : le zoom des boutons, lissé à 6 par seconde et borné par la distance min / max.
  const LIBRE = Math.PI * 0.62; // pendant une vue intérieure, la caméra a le droit d'être plus bas
  const PAS_HORIZONTAL = Math.PI / 9; // 20° par clic sur ◀ ▶
  const PAS_VERTICAL = Math.PI / 14; // ≈ 13° par clic sur ▲ ▼
  const FACTEUR_ZOOM = 0.85;
  let focus = null;
  let vers = null;
  let zoomCible = null;
  const sph0 = new THREE.Spherical();
  const sph1 = new THREE.Spherical();
  const tmp = new THREE.Vector3();

  // l'inertie d'un glissé (rotation ou déplacement) continue d'agir après le lâcher : on la termine d'un
  // coup avant tout mouvement automatique, sinon elle pousserait la caméra pendant le trajet
  const viderInertie = () => {
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
  };
  const annuler = () => {
    focus = null;
    vers = null;
    zoomCible = null;
  };
  function focusTo(position, cible, fov = camera.fov, duree = 1.15) {
    viderInertie();
    vers = null;
    zoomCible = null;
    const p0 = camera.position.clone();
    const milieu = p0.clone().add(position).multiplyScalar(0.5).add(new THREE.Vector3(0, p0.distanceTo(position) * 0.3, 0));
    focus = { t: 0, duree, p0, p1: milieu, p2: position.clone(), s0: controls.target.clone(), s2: cible.clone(), f0: camera.fov, f1: fov };
  }
  function goTo(position, cible, fov = camera.fov) {
    viderInertie();
    focus = null;
    zoomCible = null;
    vers = { position: position.clone(), cible: cible.clone(), fov };
  }
  function zoomBy(facteur) {
    viderInertie();
    focus = null;
    vers = null;
    zoomCible = THREE.MathUtils.clamp((zoomCible ?? camera.position.distanceTo(controls.target)) * facteur, controls.minDistance, controls.maxDistance);
  }
  // compatibilité : les vues d'objets et de meubles utilisent allerA
  function allerA(position, cible, duree = 1.15, fov = camera.fov) {
    controls.maxPolarAngle = LIBRE;
    focusTo(position, cible, fov, duree);
  }

  // dès que la personne reprend la main, tout mouvement automatique s'arrête
  controls.addEventListener('start', () => {
    annuler();
    vueActive = null;
    vueGenerale = null;
    majVues();
    majMenu();
    // on garde la caméra là où elle est même si elle est plus basse que la limite normale
    controls.maxPolarAngle = Math.max(limitePolaire, controls.getPolarAngle());
  });

  // --- Vues prédéfinies ---
  const icone = (d, t = 20) =>
    `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const F = 'fill="currentColor" fill-opacity=".22"'; // remplissage pastel des logos
  const ICONES_VUES = {
    ensemble: `<path d="M12 3l8.5 4.5L12 12 3.5 7.5z" ${F}/><path d="M3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9"/>`,
    lit: `<path d="M3.5 5.5v13.5M20.5 16.5V19"/><rect x="3.5" y="12.5" width="17" height="4" rx="1.5" ${F}/><rect x="5.5" y="9" width="5" height="3.5" rx="1.7" ${F}/>`,
    bureau: `<rect x="6" y="3.5" width="12" height="8" rx="1.5" ${F}/><path d="M12 11.5V15M3 15h18M5.5 15v5.5M18.5 15v5.5"/>`,
    tv: `<rect x="3" y="5" width="18" height="12" rx="2.5" ${F}/><path d="M8 20.5l1-3.5M16 20.5l-1-3.5"/>`,
    porte: `<rect x="6" y="3" width="12" height="18" rx="1.5" ${F}/><path d="M3 21h18"/><circle cx="15" cy="12.5" r="1" fill="currentColor" stroke="none"/>`,
    velux: `<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" ${F}/><path d="M12 4.5v15M4.5 12h15"/>`,
  };
  let vueActive = 'ensemble';
  let vueGenerale = null; // 'dessus' | 'gauche' | 'droite' (menu de vues)
  const boutonsVues = new Map();
  for (const v of vues) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = icone(ICONES_VUES[v.id], 24);
    b.setAttribute('aria-label', v.label);
    b.title = v.label;
    b.addEventListener('click', () => {
      vueActive = v.id;
      eteindre();
      majVues();
      vueGenerale = null;
      majMenu();
      allerA(versScene(v.camera), versScene(v.cible), 1.15, v.fov ?? 35);
      if (v.id === 'ensemble') controls.maxPolarAngle = limitePolaire;
    });
    elVues.append(b);
    boutonsVues.set(v.id, b);
  }
  function majVues() {
    for (const [id, b] of boutonsVues) b.classList.toggle('actif', id === vueActive);
  }
  majVues();

  // --- Boutons de caméra (croix, zoom, menu de vues) et des murs ---
  const ICONES = {
    haut: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    bas: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    gauche: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
    droite: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    moins: '<path d="M5 12h14"/>',
    menu: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    dessus: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/>',
    cotegauche: '<path d="M4 20h16M7 20V8l5-4 5 4v12"/><path d="M3 12l-1 0"/>',
    coteDroit: '<path d="M4 20h16M7 20V8l5-4 5 4v12"/>',
    maison: '<path d="M3 11l9-7 9 7M5 10v9h14v-9"/>',
    mursHauts: '<path d="M4 21V9h16v12M4 9l8-6 8 6"/>',
    mursBas: '<path d="M4 21v-5h16v5M12 3v8M8 8l4 4 4-4"/>',
  };
  const bouton = (parent, nom, icn, libelle, action, classe = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `ctrl ${classe}`.trim();
    b.setAttribute('aria-label', libelle);
    b.title = libelle;
    b.innerHTML = icone(icn);
    b.addEventListener('click', action);
    parent.append(b);
    return b;
  };

  // pivote d'un pas autour de la cible
  function pivoter(dTheta, dPhi) {
    const rayon = tmp.subVectors(camera.position, controls.target);
    sph0.setFromVector3(rayon);
    sph0.theta += dTheta;
    sph0.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, sph0.phi + dPhi));
    goTo(new THREE.Vector3().setFromSpherical(sph0).add(controls.target), controls.target);
    vueActive = null;
    vueGenerale = null;
    majVues();
    majMenu();
  }
  const croix = document.getElementById('croix');
  bouton(croix, 'haut', ICONES.haut, 'Pivoter vers le haut', () => pivoter(0, -PAS_VERTICAL), 'haut');
  bouton(croix, 'gauche', ICONES.gauche, 'Pivoter à gauche', () => pivoter(-PAS_HORIZONTAL, 0), 'gauche');
  bouton(croix, 'bas', ICONES.bas, 'Pivoter vers le bas', () => pivoter(0, PAS_VERTICAL), 'bas');
  bouton(croix, 'droite', ICONES.droite, 'Pivoter à droite', () => pivoter(PAS_HORIZONTAL, 0), 'droite');

  // vues générales : de dessus, de côté (gauche, droite) et la vue libre (la vue d'ensemble)
  const CENTRE = new THREE.Vector3(0, 0.9, 0);
  const VUES_GENERALES = {
    dessus: { position: [0, 10.5, 0.001], libelle: 'Vue de dessus', icone: ICONES.dessus, polaire: limitePolaire },
    gauche: { position: [0.001, 0.8, -8.5], libelle: 'Vue de côté gauche', icone: ICONES.cotegauche, polaire: Math.PI / 2 },
    droite: { position: [0.001, 0.8, 8.5], libelle: 'Vue de côté droit', icone: ICONES.coteDroit, polaire: Math.PI / 2 },
  };
  const droite = document.getElementById('cmd-droite');
  const menu = document.createElement('div');
  menu.className = 'menu-vues';
  menu.hidden = true;
  droite.append(menu);
  const boutonsMenu = {};
  const choisirVueGenerale = (nom) => {
    if (vueGenerale === nom) nom = 'libre'; // un second clic revient à la vue libre
    if (nom === 'libre') {
      vueGenerale = null;
      vueActive = 'ensemble';
      majVues();
      majMenu();
      const ens = vues.find((v) => v.id === 'ensemble');
      controls.maxPolarAngle = limitePolaire;
      focusTo(versScene(ens.camera), versScene(ens.cible), ens.fov ?? 35);
      return;
    }
    const v = VUES_GENERALES[nom];
    vueGenerale = nom;
    vueActive = null;
    majVues();
    majMenu();
    controls.maxPolarAngle = v.polaire;
    goTo(new THREE.Vector3(...v.position), CENTRE, 35);
  };
  for (const nom of ['dessus', 'gauche', 'droite']) {
    boutonsMenu[nom] = bouton(menu, nom, VUES_GENERALES[nom].icone, VUES_GENERALES[nom].libelle, () => choisirVueGenerale(nom));
  }
  boutonsMenu.libre = bouton(menu, 'libre', ICONES.maison, 'Vue libre', () => choisirVueGenerale('libre'));
  const boutonMenu = bouton(droite, 'menu', ICONES.menu, 'Changer de vue', () => {
    menu.hidden = !menu.hidden;
    majMenu();
  });
  bouton(droite, 'plus', ICONES.plus, 'Zoom avant', () => zoomBy(FACTEUR_ZOOM));
  bouton(droite, 'moins', ICONES.moins, 'Zoom arrière', () => zoomBy(1 / FACTEUR_ZOOM));
  function majMenu() {
    for (const nom of ['dessus', 'gauche', 'droite']) boutonsMenu[nom].classList.toggle('actif', vueGenerale === nom);
    boutonsMenu.libre.classList.toggle('actif', vueGenerale === null && vueActive === 'ensemble');
    boutonMenu.classList.toggle('actif', vueGenerale !== null || !menu.hidden);
  }
  majMenu();

  // murs : tous levés ou tous baissés (un second clic revient à l'automatique)
  const cmdMurs = document.getElementById('cmd-murs');
  const bMonter = bouton(cmdMurs, 'monter', ICONES.mursHauts, 'Monter tous les murs', () => regler('up'));
  const bBaisser = bouton(cmdMurs, 'baisser', ICONES.mursBas, 'Baisser tous les murs', () => regler('down'));
  function regler(mode) {
    reglages.murs = reglages.murs === mode ? 'auto' : mode;
    bMonter.classList.toggle('actif', reglages.murs === 'up');
    bBaisser.classList.toggle('actif', reglages.murs === 'down');
  }

  // --- Interrupteurs (barre du bas) ---
  const boutonsLumieres = new Map();
  for (const c of Object.values(commandes)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="temoin"></span>${c.label}`;
    b.addEventListener('click', () => basculer(c.id));
    elLumieres.append(b);
    boutonsLumieres.set(c.id, b);
  }
  const bAuto = document.createElement('button');
  bAuto.type = 'button';
  bAuto.className = 'auto';
  bAuto.textContent = 'Auto';
  bAuto.title = 'Les lumières suivent la nuit';
  bAuto.addEventListener('click', toutAuto);
  elLumieres.append(bAuto);

  // --- Recentrer sur ce qu'on a cliqué ---
  // On se place du côté « face » de l'objet : pour un décor, la normale de son mur ; pour un meuble, le
  // côté opposé au mur le plus proche (un meuble regarde la pièce). Un décor plat est vu de face, un
  // meuble de trois quarts, du côté où se trouve déjà la caméra. La distance est calculée pour que
  // l'objet entier remplisse environ les trois quarts de l'écran.
  const demiX = -racine.position.x;
  const demiZ = -racine.position.z;
  const HAUT = new THREE.Vector3(0, 1, 0);
  let dernierCentrage = null;

  function cotePiece(centre) {
    const murs4 = [
      [centre.x + demiX, new THREE.Vector3(1, 0, 0)],
      [demiX - centre.x, new THREE.Vector3(-1, 0, 0)],
      [centre.z + demiZ, new THREE.Vector3(0, 0, 1)],
      [demiZ - centre.z, new THREE.Vector3(0, 0, -1)],
    ];
    murs4.sort((a, b) => a[0] - b[0]);
    return murs4[0][1];
  }

  // --- Petit projecteur : sur ce qu'on vient de cliquer, comme une lampe de tableau ---
  // Les photos et les objets reçoivent peu de lumière dans la pièce : le temps d'un regard de près, une
  // lumière douce, sans ombre, les éclaire. Elle s'éteint si on clique ailleurs, si on choisit une vue ou si
  // on s'éloigne. Elle reste dans la scène en permanence (intensité 0 quand elle est éteinte) : ajouter ou
  // retirer une lumière obligerait à recompiler tous les matériaux.
  const projecteur = new THREE.SpotLight('#fff0dc', 0, 0, 0.4, 1, 2);
  const scene = racine.parent;
  scene.add(projecteur, projecteur.target);
  const eclat = { v: 0, cible: 0, info: null, intensite: 0, pos: new THREE.Vector3(), centre: new THREE.Vector3(), rayon: 0, angle: 0.4 };
  const eteindre = () => {
    eclat.cible = 0;
  };
  function eclairer(info, boite, centre, position) {
    const taille = boite.getSize(new THREE.Vector3());
    if (Math.max(taille.x, taille.y, taille.z) > 1.5) return eteindre(); // un grand meuble n'a pas besoin de projecteur
    eclat.info = info;
    eclat.rayon = taille.length() / 2;
    eclat.centre.copy(centre);
    eclat.pos.copy(position).y += 0.3; // un peu au-dessus de l'œil, comme une lampe de tableau
    const d = eclat.pos.distanceTo(centre);
    eclat.angle = THREE.MathUtils.clamp(Math.atan((eclat.rayon * 2.4) / d), 0.15, 1.1); // cône large, pénombre totale : la lumière s'estompe doucement jusqu'au bord
    eclat.intensite = 1.8 * d * d; // l'éclairement au centre reste le même quelle que soit la distance
    eclat.cible = 1;
    if (eclat.v < 0.03) {
      projecteur.position.copy(eclat.pos);
      projecteur.angle = eclat.angle;
      projecteur.target.position.copy(centre);
    }
  }
  const boiteDe = (info) => {
    const b = new THREE.Box3();
    for (const g of info.groupes ?? [info.groupe]) b.expandByObject(g);
    return b;
  };

  function recentrer(info) {
    if (info.sansRecentrage) return eteindre();
    const boite = boiteDe(info);
    if (boite.isEmpty()) return;
    const centre = boite.getCenter(new THREE.Vector3());
    if (dernierCentrage === info && !focus && !vers && controls.target.distanceTo(centre) < 0.15) {
      if (eclat.info === info) eclat.cible = 1; // déjà cadré : on rallume juste le projecteur
      return;
    }

    const plat = !!info.normale;
    const face = plat ? new THREE.Vector3(info.normale.x, 0, info.normale.z).normalize() : cotePiece(centre);
    if (!plat) {
      // trois quarts, du côté de la caméra actuelle
      const vers_cam = camera.position.clone().sub(centre).setY(0);
      const cote = Math.sign(tmp.crossVectors(face, vers_cam).y) || 1;
      face.applyAxisAngle(HAUT, cote * THREE.MathUtils.degToRad(35));
    }
    const elevation = THREE.MathUtils.degToRad(plat ? 6 : info.aPlat ? 58 : 26); // à plat (magazines) : vu d'assez haut
    const dir = face.clone().multiplyScalar(Math.cos(elevation)).setY(Math.sin(elevation)).normalize();

    // distance qui fait tenir les huit coins de la boîte dans le champ de vision
    const fov = plat ? 34 : 38;
    const tanV = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    const tanH = tanV * camera.aspect;
    const droite = new THREE.Vector3().crossVectors(HAUT, dir).normalize();
    const haut = new THREE.Vector3().crossVectors(dir, droite);
    let distance = 0;
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Vector3(i & 1 ? boite.max.x : boite.min.x, i & 2 ? boite.max.y : boite.min.y, i & 4 ? boite.max.z : boite.min.z).sub(centre);
      const marge = 0.76;
      distance = Math.max(distance, c.dot(dir) + Math.max(Math.abs(c.dot(droite)) / (tanH * marge), Math.abs(c.dot(haut)) / (tanV * marge)));
    }
    distance = THREE.MathUtils.clamp(distance, info.aPlat ? 0.6 : 0.9, 7);

    const position = centre.clone().addScaledVector(dir, distance);
    position.x = THREE.MathUtils.clamp(position.x, -demiX + 0.12, demiX - 0.12);
    position.z = THREE.MathUtils.clamp(position.z, -demiZ + 0.12, demiZ - 0.12);
    position.y = THREE.MathUtils.clamp(position.y, 0.45, 2.1);
    vueActive = null;
    majVues();
    dernierCentrage = info;
    allerA(position, centre, 1.0, fov);
    eclairer(info, boite, centre, position);
  }

  // --- Clic dans la scène ---
  function visible(objet) {
    for (let o = objet; o; o = o.parent) if (!o.visible) return false;
    return true;
  }
  function infoDe(objet) {
    for (let o = objet; o; o = o.parent) if (o.userData.info) return o.userData.info;
    return null;
  }

  // Ce qui réagit au clic : une action propre (calendrier, store…) ou une lumière à allumer/éteindre.
  const reagit = (info) => !!(info.auClic || info.interrupteur || !info.sansRecentrage);

  // Renvoie ce que le pointeur vise : un meuble ou un décor, ou rien. Un mur
  // debout bloque la vue ; un mur abaissé laisse passer.
  function viser() {
    raycaster.setFromCamera(pointeur, camera);
    const objets = [];
    for (const c of cliquables) for (const g of c.groupes ?? [c.groupe]) g.traverse((o) => o.isMesh && objets.push(o));
    for (const mur of Object.values(murs)) for (const t of mur.tuiles) objets.push(t.mesh);
    for (const hit of raycaster.intersectObjects(objets, false)) {
      if (!visible(hit.object)) continue;
      const tuile = hit.object.userData.tuile;
      if (tuile) {
        if (tuile.h > 0.6) return null;
        continue;
      }
      const info = infoDe(hit.object);
      if (info) return info;
    }
    return null;
  }

  function placerPointeur(e) {
    const r = canvas.getBoundingClientRect();
    pointeur.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  let appui = null;
  canvas.addEventListener('pointerdown', (e) => {
    appui = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!appui) return;
    const court = performance.now() - appui.t < 600;
    const immobile = Math.hypot(e.clientX - appui.x, e.clientY - appui.y) < 6;
    appui = null;
    if (!court || !immobile) return; // c'était un glissement : on tournait la caméra
    placerPointeur(e);
    const info = viser();
    if (!info) return eteindre();
    recentrer(info);
    if (info.auClic) info.auClic(); // ex. le calendrier tourne sa page, le store du Velux se ferme
    else if (info.interrupteur) basculer(info.interrupteur);
  });

  // le curseur devient une main au-dessus de ce qu'on peut cliquer
  let dernierSurvol = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || performance.now() - dernierSurvol < 60) return;
    dernierSurvol = performance.now();
    placerPointeur(e);
    const info = viser();
    canvas.style.cursor = info && reagit(info) ? 'pointer' : '';
  });

  // --- À chaque image ---
  let temps = 0;
  let signature = '';
  function maj(dt) {
    temps += dt;

    // projecteur : fondu, léger glissement vers le nouvel objet, et extinction si on s'en éloigne
    if (eclat.cible > 0 && !focus && !vers) {
      const loin = controls.target.distanceTo(eclat.centre) > eclat.rayon + 0.6 || camera.position.distanceTo(eclat.centre) > 4.5;
      if (loin) eteindre();
    }
    const kEclat = 1 - Math.exp(-5 * dt);
    eclat.v += (eclat.cible - eclat.v) * kEclat;
    projecteur.intensity = eclat.v * eclat.intensite;
    projecteur.position.lerp(eclat.pos, kEclat);
    projecteur.angle += (eclat.angle - projecteur.angle) * kEclat;
    projecteur.target.position.lerp(eclat.centre, kEclat);

    if (focus) {
      focus.t = Math.min(focus.duree, focus.t + dt);
      const e = ease(focus.t / focus.duree);
      const u = 1 - e;
      camera.position.copy(focus.p0).multiplyScalar(u * u).addScaledVector(focus.p1, 2 * u * e).addScaledVector(focus.p2, e * e);
      controls.target.copy(focus.s0).lerp(focus.s2, e);
      camera.fov = THREE.MathUtils.lerp(focus.f0, focus.f1, e);
      camera.updateProjectionMatrix();
      controls.update();
      if (focus.t >= focus.duree) focus = null;
    } else if (vers) {
      const k = 1 - Math.exp(-4 * dt);
      sph0.setFromVector3(tmp.subVectors(camera.position, controls.target));
      sph1.setFromVector3(tmp.subVectors(vers.position, vers.cible));
      const dTheta = THREE.MathUtils.euclideanModulo(sph1.theta - sph0.theta + Math.PI, Math.PI * 2) - Math.PI;
      sph0.theta += dTheta * k;
      sph0.phi += (sph1.phi - sph0.phi) * k;
      sph0.radius += (sph1.radius - sph0.radius) * k;
      controls.target.set(
        THREE.MathUtils.damp(controls.target.x, vers.cible.x, 4, dt),
        THREE.MathUtils.damp(controls.target.y, vers.cible.y, 4, dt),
        THREE.MathUtils.damp(controls.target.z, vers.cible.z, 4, dt),
      );
      camera.position.setFromSpherical(sph0).add(controls.target);
      if (Math.abs(camera.fov - vers.fov) > 0.01) {
        camera.fov += (vers.fov - camera.fov) * k;
        camera.updateProjectionMatrix();
      }
      controls.update();
      if (camera.position.distanceTo(vers.position) < 0.01 && controls.target.distanceTo(vers.cible) < 0.01 && Math.abs(dTheta) < 0.001) {
        camera.position.copy(vers.position);
        controls.target.copy(vers.cible);
        camera.fov = vers.fov;
        camera.updateProjectionMatrix();
        controls.update();
        vers = null;
      }
    } else if (zoomCible !== null) {
      tmp.subVectors(camera.position, controls.target);
      const d = THREE.MathUtils.damp(tmp.length(), zoomCible, 6, dt);
      camera.position.copy(controls.target).addScaledVector(tmp.setLength(d), 1);
      controls.update();
      if (Math.abs(d - zoomCible) < 0.005) zoomCible = null;
    }

    // boutons : on ne touche au DOM que quand quelque chose change
    const sig = Object.keys(commandes).map((id) => +estAllume(id)).join('');
    if (sig !== signature) {
      signature = sig;
      for (const [id, b] of boutonsLumieres) b.classList.toggle('actif', estAllume(id));
    }
    bAuto.classList.toggle('actif', Object.values(commandes).every((c) => c.manuel === null));
  }

  return { maj };
}
