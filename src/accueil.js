// Menu d'accueil : à chaque arrivée sur le site, on choisit la pièce à visiter. À gauche, la pièce choisie : son nom
// en grand, son lieu, « Visiter », puis la liste de toutes les pièces (un clic en choisit une ; ← → au clavier, un
// glissé au doigt). À droite, en grand, sa scène 3D. Tout s'anime : l'arrivée en cascade, le titre qui se dévoile à
// chaque changement, le curseur qui glisse dans la liste, le fond qui dérive, la scène qui suit un peu la souris, et
// la scène qui s'avance quand on part la visiter. Le choix est rangé dans
// globalThis.PIECE, que lit src/mode.js, puis la scène est chargée : l'écran de chargement prend le relais sous le
// menu, qui s'efface.
//
// La pièce choisie est la vraie scène 3D, qui tourne lentement : cette même page ouverte dans une iframe avec
// ?miniature=<pièce> (voir plus bas). En attendant qu'elle soit chargée, on montre son image détourée
// (public/apercus/), qui laisse ensuite la place à la 3D en fondu.
// (Ce fichier n'importe rien : three.js n'est chargé qu'avec la scène.)
const chemin = (url) => import.meta.env.BASE_URL + url.slice(1); // comme dans textures.js

const pieces = [
  { piece: 'chambre', titre: 'Chambre', lieu: 'Paris', image: '/apercus/chambre.png' },
  { piece: 'reve', titre: 'Chambre de rêve', lieu: 'Paris', image: '/apercus/reve.png' },
  { piece: 'mantes', titre: 'Chambre', lieu: 'Mantes-la-Jolie', image: '/apercus/mantes.png', wip: true },
];
// la police des titres (Milky Boba) n'a pas de « ê » : un « e » de la police, coiffé d'un accent dessiné (.circ)
export const titreHtml = (t) => t.replace(/ê/g, '<span class="circ">e</span>');
const deux = (n) => String(n).padStart(2, '0');

// Chaque pièce a sa scène : Paris et la chambre de rêve partagent src/main.js, Mantes a la sienne.
const scenePiece = (piece) => (piece === 'mantes' ? import('./mantes.js') : import('./main.js'));

const parametres = new URLSearchParams(location.search);
const pieceMiniature = parametres.get('miniature');
if (parametres.has('atelier')) ouvrirAtelier();
else if (pieceMiniature) ouvrirMiniature(pieceMiniature);
else {
  ouvrirMenu();
  guetterMotSecret();
}

// --- L'atelier (src/atelier.js) : un écran caché pour inspecter les modèles de près, à la place du menu ---
function ouvrirAtelier() {
  document.body.classList.add('en-atelier');
  import('./atelier.js');
}
// Easter egg : taper « atelier » au clavier, n'importe quand (dans le menu comme dans une pièce), y mène.
function guetterMotSecret() {
  const MOT = 'atelier';
  let tape = '';
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
    if (e.target instanceof HTMLElement && e.target.closest('textarea, [contenteditable], input:not([type="range"])')) return;
    tape = (tape + e.key.toLowerCase()).slice(-MOT.length);
    if (tape === MOT) location.search = '?atelier';
  });
}

// --- Dans l'iframe d'une miniature : la scène seule, sans interface, sur fond transparent ---
function ouvrirMiniature(piece) {
  document.body.classList.add('miniature');
  globalThis.PIECE = piece;
  globalThis.MINIATURE = true;
  scenePiece(piece);
}

// --- Le menu ---
function ouvrirMenu() {
  const el = (id) => document.getElementById(id);
  const accueil = el('accueil');
  const scene = el('accueil-scene');
  let index = 0;

  // une case par pièce : son image, et pour la pièce au centre seulement, sa scène 3D par-dessus quand elle est prête.
  // Les pièces voisines, floutées sur les côtés, gardent leur image : trois scènes 3D à la fois pesaient près de
  // 1,9 Go de mémoire, une seule un peu plus d'1 Go.
  const cases = pieces.map((p) => {
    const div = document.createElement('div');
    div.className = 'accueil-piece';
    const img = document.createElement('img');
    if (p.image) img.src = chemin(p.image);
    img.alt = '';
    div.append(img);
    scene.append(div);
    return div;
  });
  // la liste de toutes les pièces : numéro, nom, lieu ; un clic y mène
  const lignes = pieces.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="accueil-liste-numero">${deux(i + 1)}</span><span class="accueil-liste-nom"></span><span class="accueil-liste-lieu"></span>`;
    b.style.setProperty('--rang', i);
    b.querySelector('.accueil-liste-nom').textContent = p.titre;
    b.querySelector('.accueil-liste-lieu').textContent = p.lieu;
    b.addEventListener('click', () => aller(i - index));
    el('accueil-liste').append(b);
    return b;
  });
  // la scène 3D d'une case : créée quand la pièce arrive au centre, vidée (et sa mémoire rendue) quand elle le quitte
  const animer = (i) => {
    if (cases[i].querySelector('iframe')) return;
    const p = pieces[i];
    const iframe = document.createElement('iframe');
    iframe.src = `${location.pathname}?miniature=${p.piece}`;
    iframe.title = `Miniature 3D : ${p.titre}`;
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    cases[i].append(iframe);
  };
  const endormir = (div) => {
    const iframe = div.querySelector('iframe');
    if (!iframe) return;
    div.classList.remove('vivante');
    iframe.src = 'about:blank'; // la page de la miniature se ferme tout de suite : sa scène et sa carte graphique sont rendues
    setTimeout(() => iframe.remove(), 400); // après le fondu vers l'image
  };
  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const i = pieces.findIndex((p) => p.piece === e.data?.miniature);
    // (seulement si elle est toujours au centre : on a pu passer à une autre pièce pendant qu'elle chargeait)
    if (i === index && cases[i].querySelector('iframe')) cases[i].classList.add('vivante');
  });

  function afficher(sens = 0) {
    const p = pieces[index];
    el('accueil-nom').innerHTML = titreHtml(p.titre);
    el('accueil-lieu').textContent = p.lieu;
    el('accueil-wip').hidden = !p.wip;
    cases.forEach((c, i) => (i === index ? animer(i) : endormir(c)));
    cases.forEach((c, i) => {
      c.classList.toggle('courante', i === index);
      c.classList.toggle('avant', i < index); // celles d'avant s'effacent vers la gauche, celles d'après vers la droite
    });
    lignes.forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
    // le curseur rose glisse jusqu'à la ligne choisie
    const curseur = el('accueil-liste').querySelector('.accueil-liste-curseur');
    curseur.style.transform = `translateY(${lignes[index].offsetTop + lignes[index].offsetHeight / 2}px)`;
    // le texte et la scène changent en douceur, du côté d'où l'on vient
    if (sens) {
      accueil.dataset.sens = sens > 0 ? 'droite' : 'gauche';
      accueil.classList.remove('glisse');
      void accueil.offsetWidth;
      accueil.classList.add('glisse');
    }
  }
  function aller(sens) {
    const i = index + sens;
    if (!sens || i < 0 || i >= pieces.length) return;
    index = i;
    afficher(sens);
  }

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
    document.querySelector('.chargement-titre').innerHTML = titreHtml(p.titre);
    accueil.classList.add('part', 'fini'); // la scène s'avance, le texte s'efface, le menu disparaît
    scenePiece(p.piece);
    // une fois le menu effacé, la miniature s'arrête : la carte graphique est pour la vraie scène
    setTimeout(() => {
      cases.forEach(endormir);
      setTimeout(() => scene.replaceChildren(), 450);
    }, 700);
  });

  // l'arrivée : tout entre en cascade (voir .accueil.entree dans style.css)
  accueil.classList.add('entree');
  setTimeout(() => accueil.classList.remove('entree'), 2200);
  // la scène suit un peu la souris (et le titre, plus discrètement, à l'inverse) : un léger relief
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      accueil.style.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      accueil.style.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
    });
  }
  afficher();
  // la police chargée, les lignes de la liste ont leur vraie hauteur : on recale le curseur
  document.fonts?.ready.then(() => afficher());
}
