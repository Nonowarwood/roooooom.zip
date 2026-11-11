

// Alléger la mémoire sans rien changer à l'image. Une texture statique envoyée à la carte graphique n'a plus besoin
// de la copie que la page garde de son image (une photo décodée, un canvas, l'image d'un .glb) : on la libère.
// Seulement pour les textures déjà envoyées, qui n'ont pas bougé pendant quelques secondes et qui ne sont pas
// marquées `userData.vivante` (celles qu'on redessine : l'écran de la TV, celui du NAS…).
// Contrepartie : si la carte graphique perd le contexte (rare), ces images ne pourraient pas être renvoyées ; la page
// se recharge alors d'elle-même (voir surveillerContexte).
export function libererCopies(renderer, scene, { attente = 3000 } = {}) {
  const versions = new Map();
  scene.traverse((o) => {
    for (const m of [o.material].flat().filter(Boolean)) {
      for (const valeur of Object.values(m)) if (valeur?.isTexture && valeur.image) versions.set(valeur, valeur.version);
    }
  });
  setTimeout(() => {
    let liberees = 0;
    for (const [t, v] of versions) {
      if (t.userData.vivante || t.version !== v || t.isVideoTexture) continue;
      const p = renderer.properties.get(t);
      if (!p.__webglTexture || p.__version !== t.version) continue; // pas encore envoyée : on n'y touche pas
      if (liberer(t)) liberees++;
    }
    if (liberees) surveillerContexte(renderer);
  }, attente);
}

function liberer(t) {
  const img = t.image;
  if (!img || img.__liberee) return false;
  const [width, height] = [img.width ?? 0, img.height ?? 0];
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
  else if (img instanceof HTMLCanvasElement) img.width = img.height = 0; // libère le tampon du canvas
  // la texture garde ses dimensions, plus ses pixels (déjà sur la carte graphique)
  t.source.data = { width, height, __liberee: true };
  return true;
}

let surveille = false;
function surveillerContexte(renderer) {
  if (surveille) return;
  surveille = true;
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
}

// une texture d'un .glb identique à une autre déjà chargée (même décalque, même taille) : on garde la première
export function dedoublonner() {
  const vus = new Map();
  return (o) => {
    const m = o.material;
    if (!m?.map?.image || !/^(legendes|logo|imprime)-/.test(m.name)) return;
    const cle = `${m.name}|${m.map.image.width}x${m.map.image.height}`;
    const deja = vus.get(cle);
    if (!deja) return void vus.set(cle, m);
    if (deja === m) return;
    if (typeof ImageBitmap !== 'undefined' && m.map.image instanceof ImageBitmap) m.map.image.close();
    m.map.dispose();
    o.material = deja;
  };
}
