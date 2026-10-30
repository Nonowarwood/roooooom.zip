// Menu d'accueil : à chaque arrivée sur le site, on choisit la pièce à visiter dans un carrousel (la pièce au
// centre, son nom en arc au-dessus, un sous-titre en arc dessous, « Visiter », et l'autre pièce floutée sur le
// côté). Le choix est rangé dans globalThis.PIECE, que lit src/mode.js, puis la scène est chargée : l'écran de
// chargement prend le relais sous le menu, qui s'efface.
//
// Chaque pièce du carrousel est la vraie scène 3D, qui tourne lentement : cette même page ouverte dans une
// iframe avec ?miniature=<pièce> (voir plus bas). En attendant qu'elle soit chargée, on montre son image
// détourée (public/apercus/), qui laisse ensuite la place à la 3D en fondu.
// (Ce fichier n'importe rien : three.js n'est chargé qu'avec la scène.)
const chemin = (url) => import.meta.env.BASE_URL + url.slice(1); // comme dans textures.js

const pieces = [
  { piece: 'chambre', titre: 'Chambre', sousTitre: 'Paris', image: '/apercus/chambre.png' },
  { piece: 'reve', titre: 'Chambre', sousTitre: 'Le mur abattu', image: '/apercus/reve.png' },
];

const pieceMiniature = new URLSearchParams(location.search).get('miniature');
if (pieceMiniature) ouvrirMiniature(pieceMiniature);
else ouvrirMenu();

// --- Dans l'iframe d'une miniature : la scène seule, sans interface, sur fond transparent ---
function ouvrirMiniature(piece) {
  document.body.classList.add('miniature');
  globalThis.PIECE = piece;
  globalThis.MINIATURE = true;
  import('./main.js');
}

// --- Le menu ---
function ouvrirMenu() {
  const el = (id) => document.getElementById(id);
  const accueil = el('accueil');
  const scene = el('accueil-scene');
  let index = 0;

  // une case par pièce : son image, puis sa scène 3D par-dessus quand elle est prête
  const cases = pieces.map((p) => {
    const div = document.createElement('div');
    div.className = 'accueil-piece';
    const img = document.createElement('img');
    img.src = chemin(p.image);
    img.alt = '';
    const iframe = document.createElement('iframe');
    iframe.src = `${location.pathname}?miniature=${p.piece}`;
    iframe.title = `Miniature 3D : ${p.titre}`;
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    div.append(img, iframe);
    // une pièce voisine, floutée sur le côté : un clic dessus y mène
    div.addEventListener('click', () => {
      const i = cases.indexOf(div);
      if (i !== index) aller(i - index);
    });
    scene.append(div);
    return div;
  });
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const i = pieces.findIndex((p) => p.piece === e.data?.miniature);
    if (i >= 0) cases[i].classList.add('vivante');
  });

  function afficher(sens = 0) {
    const p = pieces[index];
    el('accueil-nom').textContent = p.titre;
    el('titre-arc').textContent = p.titre;
    el('sous-titre-arc').textContent = p.sousTitre;
    cases.forEach((c, i) => {
      c.classList.toggle('courante', i === index);
      c.classList.toggle('gauche', i === index - 1);
      c.classList.toggle('droite', i === index + 1);
      c.classList.toggle('cachee', Math.abs(i - index) > 1);
    });
    el('precedent').disabled = index === 0;
    el('suivant').disabled = index === pieces.length - 1;
    // le texte change en douceur, du côté d'où l'on vient
    if (sens) {
      accueil.dataset.sens = sens > 0 ? 'droite' : 'gauche';
      accueil.classList.remove('glisse');
      void accueil.offsetWidth;
      accueil.classList.add('glisse');
    }
  }
  function aller(sens) {
    const i = index + sens;
    if (i < 0 || i >= pieces.length) return;
    index = i;
    afficher(sens);
  }

  el('precedent').addEventListener('click', () => aller(-1));
  el('suivant').addEventListener('click', () => aller(1));
  addEventListener('keydown', (e) => {
    if (accueil.classList.contains('fini')) return;
    if (e.key === 'ArrowLeft') aller(-1);
    else if (e.key === 'ArrowRight') aller(1);
  });
  // au doigt : un glissé horizontal change de pièce
  let depart = null;
  accueil.addEventListener('pointerdown', (e) => (depart = e.clientX));
  accueil.addEventListener('pointerup', (e) => {
    if (depart === null) return;
    const dx = e.clientX - depart;
    depart = null;
    if (Math.abs(dx) > 50) aller(dx < 0 ? 1 : -1);
  });

  el('visiter').addEventListener('click', () => {
    el('visiter').disabled = true; // un seul choix
    const p = pieces[index];
    globalThis.PIECE = p.piece;
    document.querySelector('.chargement-titre').textContent = p.titre;
    accueil.classList.add('fini');
    import('./main.js');
    // une fois le menu effacé, les miniatures s'arrêtent : la carte graphique est pour la vraie scène
    setTimeout(() => scene.replaceChildren(), 700);
  });

  afficher();
}
