import * as THREE from 'three';

// Tout ce qui se fait à la souris ou au doigt : cliquer sur un meuble (mise en
// évidence, carte d'information, caméra qui s'approche), les vues prédéfinies et
// les interrupteurs. `maj(dt)` est à appeler à chaque image.
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
}) {
  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  const elVues = document.getElementById('vues');
  const elLumieres = document.getElementById('lumieres');
  const elCarte = document.getElementById('carte');
  const elTitre = document.getElementById('carte-titre');
  const elTexte = document.getElementById('carte-texte');
  const elActions = document.getElementById('carte-actions');

  const versScene = ([x, y, z]) => new THREE.Vector3(x, y, z).add(racine.position);
  const capitaliser = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // --- Caméra : transition douce vers une position et une cible ---
  let transition = null;
  function allerA(position, cible, duree = 1.1, fov = camera.fov) {
    transition = {
      t: 0,
      duree,
      p0: camera.position.clone(),
      c0: controls.target.clone(),
      p1: position.clone(),
      c1: cible.clone(),
      f0: camera.fov,
      f1: fov,
      // la caméra décrit un petit arc plutôt que de traverser la pièce en ligne droite
      arc: 0.25 * camera.position.distanceTo(position),
    };
  }
  // dès que la personne reprend la main, on abandonne la transition et la vue active
  controls.addEventListener('start', () => {
    transition = null;
    vueActive = null;
    majVues();
  });

  // --- Vues prédéfinies ---
  let vueActive = 'ensemble';
  const boutonsVues = new Map();
  for (const v of vues) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v.label;
    b.addEventListener('click', () => {
      deselectionner();
      vueActive = v.id;
      majVues();
      allerA(versScene(v.camera), versScene(v.cible), 1.3, v.fov ?? 35);
    });
    elVues.append(b);
    boutonsVues.set(v.id, b);
  }
  function majVues() {
    for (const [id, b] of boutonsVues) b.classList.toggle('actif', id === vueActive);
  }
  majVues();

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

  // --- Sélection d'un meuble ---
  let selection = null;
  const MEMOIRE = Symbol('surbrillance');

  function materiauxDe(objet) {
    const liste = [];
    objet.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (m.emissive && !m.userData.sansSurbrillance && !liste.includes(m)) liste.push(m);
      }
    });
    return liste;
  }

  function surbrillance(groupe, actif) {
    for (const m of materiauxDe(groupe)) {
      if (actif) {
        m[MEMOIRE] = { couleur: m.emissive.clone(), intensite: m.emissiveIntensity };
        m.emissive.set('#ffb347');
        m.emissiveIntensity = 0.3;
      } else if (m[MEMOIRE]) {
        m.emissive.copy(m[MEMOIRE].couleur);
        m.emissiveIntensity = m[MEMOIRE].intensite;
        delete m[MEMOIRE];
      }
    }
  }

  function selectionner(info) {
    deselectionner();
    selection = info;
    surbrillance(info.groupe, true);
    afficherCarte(info);
    vueActive = null;
    majVues();

    const boite = new THREE.Box3().setFromObject(info.groupe);
    const centre = boite.getCenter(new THREE.Vector3());
    const taille = boite.getSize(new THREE.Vector3());
    const distance = THREE.MathUtils.clamp(Math.max(taille.x, taille.y, taille.z) * 1.7 + 1.5, 2.2, 5);

    let direction;
    if (info.normale) {
      // décor plaqué sur un mur : on se place face à lui, côté pièce
      direction = info.normale.clone();
      direction.y = 0.15;
    } else {
      // meuble : on garde l'angle actuel, sans vue trop rasante ni trop plongeante
      direction = camera.position.clone().sub(controls.target);
      direction.y = THREE.MathUtils.clamp(direction.y / (direction.length() || 1), 0.3, 0.75) * direction.length();
    }
    direction.normalize();
    const position = centre.clone().addScaledVector(direction, distance);
    position.y = Math.max(position.y, 0.5);
    allerA(position, centre, 1.0, 42);
  }

  function deselectionner() {
    if (!selection) return;
    surbrillance(selection.groupe, false);
    selection = null;
    elCarte.hidden = true;
  }

  // --- Carte d'information ---
  let boutonCarte = null;
  function afficherCarte(info) {
    elTitre.textContent = capitaliser(info.nom);
    elTexte.textContent = info.description ?? '';
    elActions.replaceChildren();
    boutonCarte = null;
    if (info.interrupteur) {
      boutonCarte = document.createElement('button');
      boutonCarte.type = 'button';
      boutonCarte.addEventListener('click', () => basculer(info.interrupteur));
      elActions.append(boutonCarte);
      majBoutonCarte();
    }
    elCarte.hidden = false;
  }
  function majBoutonCarte() {
    if (!boutonCarte || !selection?.interrupteur) return;
    const c = commandes[selection.interrupteur];
    boutonCarte.textContent = `${estAllume(c.id) ? 'Éteindre' : 'Allumer'} · ${c.label}`;
    boutonCarte.classList.toggle('actif', estAllume(c.id));
  }
  document.getElementById('carte-fermer').addEventListener('click', deselectionner);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') deselectionner();
  });

  // --- Clic dans la scène ---
  function visible(objet) {
    for (let o = objet; o; o = o.parent) if (!o.visible) return false;
    return true;
  }
  function infoDe(objet) {
    for (let o = objet; o; o = o.parent) if (o.userData.info) return o.userData.info;
    return null;
  }

  // Renvoie ce que le pointeur vise : un meuble ou un décor, ou rien. Un mur
  // debout bloque la vue ; un mur abaissé laisse passer.
  function viser() {
    raycaster.setFromCamera(pointeur, camera);
    const objets = [];
    for (const c of cliquables) c.groupe.traverse((o) => o.isMesh && objets.push(o));
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
    if (info && info !== selection) selectionner(info);
    else if (!info) deselectionner();
  });

  // le curseur devient une main au-dessus de ce qu'on peut cliquer
  let dernierSurvol = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons || performance.now() - dernierSurvol < 60) return;
    dernierSurvol = performance.now();
    placerPointeur(e);
    canvas.style.cursor = viser() ? 'pointer' : '';
  });

  // --- À chaque image ---
  let temps = 0;
  let signature = '';
  function maj(dt) {
    temps += dt;

    if (transition) {
      transition.t += dt;
      const k = ease(Math.min(1, transition.t / transition.duree));
      camera.position.lerpVectors(transition.p0, transition.p1, k);
      camera.position.y += Math.sin(Math.PI * k) * transition.arc;
      controls.target.lerpVectors(transition.c0, transition.c1, k);
      camera.fov = THREE.MathUtils.lerp(transition.f0, transition.f1, k);
      camera.updateProjectionMatrix();
      if (transition.t >= transition.duree) transition = null;
    }

    // l'objet sélectionné respire doucement
    if (selection) {
      const intensite = 0.28 + 0.1 * Math.sin(temps * 3);
      for (const m of materiauxDe(selection.groupe)) if (m[MEMOIRE]) m.emissiveIntensity = intensite;
    }

    // boutons : on ne touche au DOM que quand quelque chose change
    const sig = Object.keys(commandes).map((id) => +estAllume(id)).join('') + (selection?.nom ?? '');
    if (sig !== signature) {
      signature = sig;
      for (const [id, b] of boutonsLumieres) b.classList.toggle('actif', estAllume(id));
      majBoutonCarte();
    }
    bAuto.classList.toggle('actif', Object.values(commandes).every((c) => c.manuel === null));
  }

  return { maj, selectionner, deselectionner };
}
