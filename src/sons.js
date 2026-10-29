// Petite ambiance sonore, entièrement synthétisée avec Web Audio : aucun fichier à charger.
// - des bruitages courts pour chaque action déjà animée (interrupteurs, TV, store, pages, portes,
//   murs qui s'abaissent, mobile, caméra, petit bonhomme) ;
// - en fond, un léger souffle de pièce, à peine perceptible.
// Les navigateurs n'autorisent le son qu'après un premier geste : tout reste muet jusque-là.
// Le bouton haut-parleur (en haut à gauche, avec les murs) coupe ou remet le son ; le choix est retenu.

let ctx = null;
let sortie = null; // volume général (coupé = 0)
let bus = null; // bruitages
let fond = null; // ambiance
let bruitBlanc = null;
let actif = true;
try {
  actif = localStorage.getItem('son') !== 'coupe';
} catch {}

const VOLUME = 0.7;

function demarrer() {
  if (ctx) return;
  const Contexte = window.AudioContext || window.webkitAudioContext;
  if (!Contexte) return;
  ctx = new Contexte();
  sortie = ctx.createGain();
  sortie.gain.value = actif ? VOLUME : 0;
  // un compresseur doux : plusieurs sons en même temps ne saturent jamais
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  sortie.connect(comp).connect(ctx.destination);
  bus = ctx.createGain();
  bus.connect(sortie);
  fond = ctx.createGain();
  fond.connect(sortie);

  const n = ctx.sampleRate * 2;
  bruitBlanc = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = bruitBlanc.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  demarrerFond();
}
// le premier geste, quel qu'il soit, ouvre le son
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => {
  demarrer();
  if (ctx?.state === 'suspended' && !document.hidden) ctx.resume();
}, { capture: true });
// onglet caché : silence (et plus rien ne tourne en arrière-plan)
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});

const pret = () => ctx && ctx.state === 'running' && actif;
const hasard = (a, b) => a + Math.random() * (b - a);

// --- Briques ---
// enveloppe : monte en `attaque` jusqu'à `gain`, puis s'éteint exponentiellement jusqu'à `fin`
function enveloppe(param, t, gain, attaque, fin) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(gain, t + attaque);
  param.exponentialRampToValueAtTime(0.0001, fin);
}

// un souffle filtré (papier, tissu, air, frottement)
function souffle({ t = ctx.currentTime, duree = 0.2, type = 'bandpass', freq = 1000, freqFin = freq, q = 1, gain = 0.2, attaque = 0.005, vers = bus }) {
  const src = ctx.createBufferSource();
  src.buffer = bruitBlanc;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(freqFin, t + duree);
  const g = ctx.createGain();
  enveloppe(g.gain, t, gain, attaque, t + duree);
  src.connect(f).connect(g).connect(vers);
  src.start(t, Math.random() * 1.5);
  src.stop(t + duree + 0.05);
}

// un son tenu qui glisse d'une fréquence à l'autre (bip, cloche, coup sourd)
function ton({ t = ctx.currentTime, duree = 0.2, type = 'sine', freq = 440, freqFin = freq, gain = 0.2, attaque = 0.004, vers = bus }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freqFin, t + duree);
  const g = ctx.createGain();
  enveloppe(g.gain, t, gain, attaque, t + duree);
  o.connect(g).connect(vers);
  o.start(t);
  o.stop(t + duree + 0.05);
}

// un petit clic net (interrupteur, loquet, cliquet)
function clic(t, freq = 3200, gain = 0.25) {
  souffle({ t, duree: 0.018, freq, q: 3, gain, attaque: 0.001 });
  ton({ t, duree: 0.02, freq: freq * 0.6, freqFin: freq * 0.4, type: 'triangle', gain: gain * 0.4, attaque: 0.001 });
}

// un grincement de charnière : une dent de scie grave qui hésite, filtrée
function grincement(t, duree, hauteur = 1, gain = 0.05) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70 * hauteur, t);
  for (let k = 1; k <= 6; k++) o.frequency.linearRampToValueAtTime(hasard(55, 120) * hauteur, t + (duree * k) / 6);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900 * hauteur;
  f.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + duree * 0.25);
  g.gain.exponentialRampToValueAtTime(gain * 0.6, t + duree * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  o.connect(f).connect(g).connect(bus);
  o.start(t);
  o.stop(t + duree + 0.05);
}

// --- Bruitages des actions ---
export const sons = {
  interrupteur(allume) {
    if (!pret()) return;
    const t = ctx.currentTime;
    clic(t, allume ? 3600 : 2800, 0.3);
    clic(t + 0.035, allume ? 2400 : 2000, 0.15);
  },

  tv(allume) {
    if (!pret()) return;
    const t = ctx.currentTime;
    if (allume) {
      ton({ t, duree: 0.12, freq: 70, freqFin: 45, gain: 0.25 }); // le « toc » du relais
      souffle({ t: t + 0.03, duree: 0.35, freq: 5000, freqFin: 2500, q: 0.7, gain: 0.06 }); // la neige de l'écran
      ton({ t: t + 0.05, duree: 0.4, freq: 220, freqFin: 660, gain: 0.05 });
    } else {
      ton({ t, duree: 0.28, freq: 900, freqFin: 90, gain: 0.07 });
      clic(t, 2000, 0.15);
    }
  },

  // le store du Velux : la toile qui frotte dans ses rails et le cliquet du ressort
  store(ferme) {
    if (!pret()) return;
    const t = ctx.currentTime;
    const duree = 1.1;
    souffle({ t, duree, freq: ferme ? 1600 : 700, freqFin: ferme ? 700 : 1600, q: 1.2, gain: 0.07, attaque: 0.08 });
    for (let k = 0; k < 14; k++) clic(t + 0.05 + k * 0.065 * (1 + k * 0.02), 4200, 0.05 * (1 - k / 16));
    clic(t + duree - 0.05, 1800, 0.18); // la barre arrive en butée
  },

  // une page de calendrier qui se tourne
  page() {
    if (!pret()) return;
    const t = ctx.currentTime;
    souffle({ t, duree: 0.12, freq: 3500, freqFin: 2000, q: 0.8, gain: 0.1, attaque: 0.01 });
    souffle({ t: t + 0.1, duree: 0.45, freq: 2600, freqFin: 900, q: 0.6, gain: 0.12, attaque: 0.04 });
    souffle({ t: t + 0.55, duree: 0.08, type: 'lowpass', freq: 900, gain: 0.08 }); // la page se plaque
  },

  // une couverture qui s'effondre en petits blocs : une pluie de petits tapotements
  couverture() {
    if (!pret()) return;
    const t = ctx.currentTime;
    for (let k = 0; k < 16; k++) {
      const tk = t + 0.08 + k * 0.05 + hasard(0, 0.04);
      souffle({ t: tk, duree: 0.04, freq: hasard(1800, 3600), q: 2, gain: hasard(0.03, 0.07), attaque: 0.002 });
    }
  },

  // les ouvrants : porte de la chambre, porte vitrée de la vitrine, capot du Mac
  ouvrant(type, ouvre) {
    if (!pret()) return;
    const t = ctx.currentTime;
    if (type === 'porte') {
      if (ouvre) clic(t, 1500, 0.25); // la poignée
      grincement(t + (ouvre ? 0.08 : 0), 0.8, 1, 0.035);
      if (!ouvre) {
        ton({ t: t + 0.55, duree: 0.18, freq: 90, freqFin: 50, gain: 0.3 }); // elle se referme
        clic(t + 0.56, 1800, 0.3);
      }
    } else if (type === 'vitrine') {
      grincement(t, 0.6, 1.8, 0.02);
      if (!ouvre) {
        ton({ t: t + 0.5, duree: 1.2, freq: 2637, gain: 0.03, attaque: 0.002 }); // le verre tinte
        ton({ t: t + 0.5, duree: 0.9, freq: 3951, gain: 0.015, attaque: 0.002 });
        clic(t + 0.5, 2600, 0.12);
      }
    } else {
      // le Mac : charnière douce, puis un petit « clap » magnétique à la fermeture
      souffle({ t, duree: 0.35, freq: 1200, freqFin: 600, q: 1.5, gain: 0.04, attaque: 0.03 });
      if (!ouvre) {
        ton({ t: t + 0.3, duree: 0.08, freq: 160, freqFin: 90, gain: 0.25 });
        clic(t + 0.3, 2200, 0.1);
      }
    }
  },

  // un mur (ou le toit) qui s'abaisse ou remonte : un souffle feutré qui balaie
  mur: (() => {
    let dernier = 0;
    return (descend) => {
      if (!pret()) return;
      const t = ctx.currentTime;
      if (t - dernier < 0.12) return; // plusieurs murs en même temps : un seul souffle
      dernier = t;
      souffle({ t, duree: 0.7, type: 'lowpass', freq: descend ? 900 : 250, freqFin: descend ? 200 : 900, q: 0.8, gain: 0.07, attaque: 0.12 });
      ton({ t: t + (descend ? 0.45 : 0.5), duree: 0.15, freq: 85, freqFin: 60, gain: 0.08 }); // il se pose
    };
  })(),

  // un petit avion du mobile : un « toc » de bois et quelques notes de carillon
  mobile() {
    if (!pret()) return;
    const t = ctx.currentTime;
    ton({ t, duree: 0.07, type: 'triangle', freq: 820, freqFin: 600, gain: 0.15 });
    const notes = [1568, 2093, 2349, 2637, 3136];
    for (let k = 0; k < 3; k++) {
      const f = notes[Math.floor(Math.random() * notes.length)];
      ton({ t: t + 0.06 + k * hasard(0.08, 0.16), duree: 1.6, freq: f, gain: 0.025, attaque: 0.002 });
    }
  },

  // la caméra part vers une vue : un souffle d'air très discret
  camera(duree = 1.15) {
    if (!pret()) return;
    const t = ctx.currentTime;
    souffle({ t, duree, freq: 300, freqFin: 700, q: 0.7, gain: 0.025, attaque: duree * 0.45 });
  },

  // le petit bonhomme
  saut(double) {
    if (!pret()) return;
    const f = double ? 520 : 340;
    ton({ duree: 0.16, freq: f, freqFin: f * 2, gain: 0.08 });
  },
  atterrir() {
    if (!pret()) return;
    souffle({ duree: 0.09, type: 'lowpass', freq: 500, freqFin: 150, gain: 0.18 });
    ton({ duree: 0.1, freq: 110, freqFin: 60, gain: 0.12 });
  },
  pas: (() => {
    let gauche = false;
    return () => {
      if (!pret()) return;
      gauche = !gauche;
      souffle({ duree: 0.05, type: 'lowpass', freq: gauche ? 700 : 600, freqFin: 200, gain: 0.07, attaque: 0.003 });
    };
  })(),
  glisser() {
    if (!pret()) return;
    souffle({ duree: 0.6, freq: 1400, freqFin: 500, q: 0.9, gain: 0.06, attaque: 0.02 });
  },
};

// --- Ambiance de fond ---
function demarrerFond() {
  // souffle de pièce : un bruit très grave et très bas, à peine perceptible
  const src = ctx.createBufferSource();
  src.buffer = bruitBlanc;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 220;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(f).connect(g).connect(fond);
  src.start();
}

// --- Bouton haut-parleur ---
const ICONE_SON = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fill-opacity=".22"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>';
const ICONE_MUET = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fill-opacity=".22"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>';
const svg = (d) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export function creerBoutonSon(parent) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ctrl';
  const maj = () => {
    const libelle = actif ? 'Couper le son' : 'Remettre le son';
    b.setAttribute('aria-label', libelle);
    b.title = libelle;
    b.innerHTML = svg(actif ? ICONE_SON : ICONE_MUET);
  };
  b.addEventListener('click', () => {
    actif = !actif;
    try {
      localStorage.setItem('son', actif ? 'actif' : 'coupe');
    } catch {}
    demarrer();
    if (sortie) sortie.gain.setTargetAtTime(actif ? VOLUME : 0, ctx.currentTime, 0.05);
    maj();
    sons.interrupteur(actif);
  });
  maj();
  parent.append(b);
  return b;
}
