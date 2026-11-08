import * as THREE from 'three';

// --- La visite guidée ---
// Un bouton lance une présentation de la pièce : la caméra glisse d'un meuble à l'autre sans jamais s'arrêter net,
// s'attarde sur chacun en dérivant lentement, et une légende le présente. Entre deux plans elle accélère puis
// ralentit en douceur ; pendant un plan elle avance à peine. Des bandes « cinéma » encadrent l'image, un petit
// projecteur met en valeur les objets vus de près, et certains plans font un geste (fermer le rideau, allumer une
// lampe), défait à la fin du plan.
//
// Les plans (`plans`, en coordonnées de la pièce) : { partie, titre, texte, de: { camera, cible }, a: { camera,
// cible }, fov, duree (le temps passé sur le plan), transition (le temps pour y arriver), projecteur (true : on
// l'éclaire), geste: id d'une commande à basculer pendant le plan }.
//
// Le mouvement : chaque plan donne deux images clés (son début et sa fin) ; la position de la caméra, sa cible et
// son champ de vision passent par toutes les images clés selon une courbe d'Hermite cubique dans le temps. Les
// tangentes sont celles de Catmull-Rom, mais leur vitesse est bornée par la plus lente des deux portions voisines :
// la vitesse ne saute jamais, et la caméra ne dépasse jamais un point pour revenir en arrière.
export function creerVisite({ camera, controls, racine, interactions, plans, vueFinale, commandes, basculer, estAllume }) {
  const versScene = ([x, y, z]) => new THREE.Vector3(x, y, z).add(racine.position);
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- l'interface : bandes, légende, progression, boutons ---
  const el = document.createElement('div');
  el.className = 'visite';
  el.hidden = true;
  el.innerHTML = `
    <div class="visite-bande visite-haut"></div>
    <div class="visite-bande visite-bas"><div class="visite-progression"><span></span></div></div>
    <div class="visite-legende" aria-live="polite"><span class="visite-partie"></span><h2 class="visite-titre"></h2><p class="visite-texte"></p></div>
    <div class="visite-boutons">
      <span class="visite-compteur"></span>
      <button type="button" class="visite-pause" aria-label="Pause" title="Pause (Espace)"></button>
      <button type="button" class="visite-suivant" aria-label="Plan suivant" title="Plan suivant (→)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l9 7-9 7z" fill="currentColor"/><path d="M19 5v14"/></svg></button>
      <button type="button" class="visite-quitter" aria-label="Quitter la visite" title="Quitter (Échap)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const ICONE_PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const ICONE_LECTURE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>';

  // --- le projecteur de la visite : une lumière douce, sans ombre, qui suit la caméra et vise la cible. Il est
  // créé dès le chargement (intensité 0) : ajouter une lumière plus tard obligerait à recompiler les matériaux.
  const projecteur = new THREE.SpotLight('#fff0dc', 0, 0, 0.42, 1, 2);
  racine.parent.add(projecteur, projecteur.target);
  let eclat = 0;

  // --- la ligne de temps ---
  let cles = []; // { t, cam: Vector3, cible: Vector3, fov }
  let legendes = []; // { t0, t1, plan, index }
  let gestes = []; // { t0, t1, id }
  let duree = 0;
  let t = 0;
  let actif = false;
  let pause = false;
  let tangentes = null;

  function construire(depuis, premierPlan) {
    cles = [{ t: 0, cam: camera.position.clone(), cible: controls.target.clone(), fov: camera.fov }];
    legendes = [];
    gestes = [];
    let tc = 0;
    const lents = reduit ? 1.6 : 1;
    plans.slice(premierPlan).forEach((p, i) => {
      const index = premierPlan + i;
      tc += (p.transition ?? 2.2) * lents;
      const t0 = tc;
      cles.push({ t: tc, cam: versScene(p.de.camera), cible: versScene(p.de.cible), fov: p.fov ?? 50 });
      tc += (p.duree ?? 3.8) * lents;
      const a = p.a ?? p.de;
      cles.push({ t: tc, cam: versScene(a.camera), cible: versScene(a.cible ?? p.de.cible), fov: p.fov ?? 50 });
      legendes.push({ t0: t0 - 0.7, t1: tc - 0.35, plan: p, index });
      if (p.geste) gestes.push({ t0, t1: tc, id: p.geste, fait: false, defait: false });
    });
    // la sortie : retour en vue d'ensemble, de haut
    tc += 3.2 * lents;
    cles.push({ t: tc, cam: versScene(vueFinale.camera), cible: versScene(vueFinale.cible), fov: vueFinale.fov ?? 35 });
    duree = tc;
    t = depuis;
    tangentes = calculerTangentes();
  }

  // tangentes bornées (voir plus haut), pour la position, la cible et le champ de vision
  function calculerTangentes() {
    const n = cles.length;
    const vec = (champ) =>
      cles.map((k, i) => {
        if (i === 0 || i === n - 1) return new THREE.Vector3();
        const [a, b, c] = [cles[i - 1], k, cles[i + 1]];
        const v1 = b[champ].distanceTo(a[champ]) / (b.t - a.t);
        const v2 = c[champ].distanceTo(b[champ]) / (c.t - b.t);
        const dir = c[champ].clone().sub(a[champ]);
        if (dir.lengthSq() < 1e-9) return new THREE.Vector3();
        return dir.normalize().multiplyScalar(Math.min(v1, v2));
      });
    const fov = cles.map((k, i) => {
      if (i === 0 || i === n - 1) return 0;
      const [a, b, c] = [cles[i - 1], k, cles[i + 1]];
      const d1 = (b.fov - a.fov) / (b.t - a.t);
      const d2 = (c.fov - b.fov) / (c.t - b.t);
      return d1 * d2 <= 0 ? 0 : Math.sign(d1) * Math.min(Math.abs(d1), Math.abs(d2));
    });
    return { cam: vec('cam'), cible: vec('cible'), fov };
  }

  // les quatre poids d'Hermite (point de départ, sa tangente, point d'arrivée, sa tangente) ; h = la durée
  const poids = (h, s) => {
    const s2 = s * s;
    const s3 = s2 * s;
    return [2 * s3 - 3 * s2 + 1, (s3 - 2 * s2 + s) * h, -2 * s3 + 3 * s2, (s3 - s2) * h];
  };
  const tmp = new THREE.Vector3();
  function poser(temps) {
    let i = 0;
    while (i < cles.length - 2 && temps > cles[i + 1].t) i++;
    const [a, b] = [cles[i], cles[i + 1]];
    const h = b.t - a.t;
    const s = THREE.MathUtils.clamp((temps - a.t) / h, 0, 1);
    const [c0, c1, c2, c3] = poids(h, s);
    camera.position.copy(a.cam).multiplyScalar(c0).addScaledVector(tangentes.cam[i], c1).addScaledVector(b.cam, c2).addScaledVector(tangentes.cam[i + 1], c3);
    controls.target.copy(a.cible).multiplyScalar(c0).addScaledVector(tangentes.cible[i], c1).addScaledVector(b.cible, c2).addScaledVector(tangentes.cible[i + 1], c3);
    camera.fov = a.fov * c0 + tangentes.fov[i] * c1 + b.fov * c2 + tangentes.fov[i + 1] * c3;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
  }

  // --- la légende ---
  let legendeCourante = null;
  function majLegende() {
    const l = legendes.find((x) => t >= x.t0 && t < x.t1) ?? null;
    if (l === legendeCourante) return;
    legendeCourante = l;
    const boite = $('.visite-legende');
    boite.classList.remove('visible');
    if (!l) return;
    // le texte change pendant que la légende est effacée, puis elle revient
    setTimeout(() => {
      if (legendeCourante !== l) return;
      $('.visite-partie').textContent = l.plan.partie ?? '';
      $('.visite-titre').textContent = l.plan.titre;
      $('.visite-texte').textContent = l.plan.texte ?? '';
      $('.visite-compteur').textContent = `${l.index + 1} / ${plans.length}`;
      boite.classList.add('visible');
    }, 260);
  }

  // --- les gestes (rideau, lampe) : basculés au début du plan, remis comme avant à la fin ---
  const etatAvant = {};
  function majGestes() {
    for (const g of gestes) {
      if (!g.fait && t >= g.t0) {
        g.fait = true;
        if (!(g.id in etatAvant)) etatAvant[g.id] = commandes[g.id].manuel;
        if (!estAllume(g.id)) basculer(g.id);
      }
      if (g.fait && !g.defait && t >= g.t1) {
        g.defait = true;
        if (estAllume(g.id)) basculer(g.id);
      }
    }
  }

  // --- démarrer, arrêter ---
  let avant = null;
  function lancer() {
    if (actif) return;
    actif = true;
    pause = false;
    $('.visite-pause').innerHTML = ICONE_PAUSE;
    document.activeElement?.blur?.();
    interactions.bloquer(true);
    avant = { min: controls.minDistance, max: controls.maxDistance, polaire: controls.maxPolarAngle, damping: controls.enableDamping };
    controls.enabled = false;
    controls.enableDamping = false;
    controls.update(); // termine l'inertie d'un glissé
    controls.minDistance = 0.05;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI;
    for (const k of Object.keys(etatAvant)) delete etatAvant[k];
    construire(0, 0);
    legendeCourante = null;
    el.hidden = false;
    document.body.classList.add('visite-en-cours');
    requestAnimationFrame(() => el.classList.add('ouverte'));
  }
  function arreter() {
    if (!actif) return;
    actif = false;
    eclat = 0;
    projecteur.intensity = 0;
    // les gestes en cours sont défaits, et les commandes reprennent leur état d'avant la visite
    for (const [id, manuel] of Object.entries(etatAvant)) commandes[id].manuel = manuel;
    el.classList.remove('ouverte');
    $('.visite-legende').classList.remove('visible');
    setTimeout(() => {
      if (!actif) el.hidden = true;
    }, 700);
    document.body.classList.remove('visite-en-cours');
    controls.minDistance = avant.min;
    controls.maxDistance = avant.max;
    controls.maxPolarAngle = Math.max(avant.polaire, controls.getPolarAngle());
    controls.enableDamping = avant.damping;
    controls.enabled = true;
    interactions.bloquer(false);
    // retour à la vue d'ensemble par le trajet habituel (sans mouvement si on y est déjà)
    document.querySelector('#vues button')?.click();
  }
  function suivant() {
    if (!actif) return;
    const prochain = legendes.find((l) => l.t0 > t + 0.8);
    if (!prochain) return arreter();
    construire(0, prochain.index);
    // un geste en cours (rideau fermé, lampe allumée) est défait tout de suite
    for (const [id, manuel] of Object.entries(etatAvant)) commandes[id].manuel = manuel;
  }
  function basculerPause() {
    pause = !pause;
    $('.visite-pause').innerHTML = pause ? ICONE_LECTURE : ICONE_PAUSE;
  }
  $('.visite-quitter').addEventListener('click', arreter);
  $('.visite-suivant').addEventListener('click', suivant);
  $('.visite-pause').addEventListener('click', basculerPause);
  addEventListener('keydown', (e) => {
    if (!actif) return;
    if (e.key === 'Escape') arreter();
    else if (e.key === ' ') {
      e.preventDefault();
      basculerPause();
    } else if (e.key === 'ArrowRight') suivant();
  });

  // --- à chaque image (avant controls.update, qui garde la caméra là où on la pose) ---
  function maj(dt) {
    if (!actif) return;
    if (!pause) t = Math.min(duree, t + dt);
    poser(t);
    majLegende();
    majGestes();
    $('.visite-progression span').style.transform = `scaleX(${t / duree})`;
    // le projecteur : allumé sur les plans rapprochés, un peu au-dessus de l'œil
    const l = legendeCourante;
    const cible = l?.plan.projecteur && t > l.t0 + 0.5 && t < l.t1 ? 1 : 0;
    eclat += (cible - eclat) * (1 - Math.exp(-3 * dt));
    const d = camera.position.distanceTo(controls.target);
    projecteur.position.copy(camera.position).y += 0.3;
    projecteur.target.position.copy(controls.target);
    projecteur.angle = THREE.MathUtils.clamp(Math.atan(0.42 / Math.max(d, 0.3)), 0.18, 0.7);
    projecteur.intensity = eclat * 1.6 * d * d;
    if (t >= duree) arreter();
  }

  return { lancer, arreter, maj, get actif() { return actif; } };
}
