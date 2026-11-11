import * as THREE from 'three';

// La vue par les fenêtres (le Velux, la fenêtre de la lucarne) : les toits de Paris tout autour de la chambre.
// Un panorama dessiné une fois (360° de large, de 35° sous l'horizon à 35° au-dessus) : au loin une ligne de toits
// dans la brume et la tour Eiffel, puis deux rangées d'immeubles haussmanniens (façades en pierre, combles en zinc,
// lucarnes, souches de cheminée et leurs mitrons), et tout près, des toits en zinc à joints debout. Le ciel, lui, est
// calculé à chaque pixel selon l'heure (bleu le jour, orangé au lever et au coucher, nuit étoilée), avec quelques
// nuages. Chaque vitre montre le panorama dans la direction où l'on regarde à travers elle : une vue lointaine, qui
// défile quand la caméra bouge. La nuit, des fenêtres s'allument et la tour Eiffel brille.
//   materiau({ dos }) : le matériau d'une vitre (dos : la vitre est vue par sa face arrière, comme le Velux)
//   maj(f, d) : l'heure (f : 0 la nuit, 1 en plein jour ; d : la hauteur du soleil, 0 au lever et au coucher, 1 à midi)
//   store(s) : 0 ouvert, 1 fermé (la vue s'éteint derrière lui)

const LARGEUR = 3072;
const HAUTEUR = 600;

function hasard(graine) {
  let s = graine;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function dessinerPanorama() {
  const [W, H] = [LARGEUR, HAUTEUR];
  const toits = document.createElement('canvas');
  const lumieres = document.createElement('canvas'); // rouge : fenêtres allumées la nuit ; vert : la tour Eiffel
  for (const c of [toits, lumieres]) [c.width, c.height] = [W, H];
  const g = toits.getContext('2d');
  const n = lumieres.getContext('2d');
  n.fillStyle = '#000';
  n.fillRect(0, 0, W, H);
  const alea = hasard(2027);
  const Y = (e) => ((35 - e) / 70) * H; // une élévation (en degrés) -> la rangée du canvas
  const X = (deg) => (deg / 360) * W;
  const PXD = W / 360; // pixels par degré
  // un rectangle, recopié de l'autre côté s'il déborde (le panorama fait le tour)
  const rect = (ctx, x, y, w, h) => {
    ctx.fillRect(x, y, w, h);
    if (x + w > W) ctx.fillRect(x - W, y, w, h);
  };
  const poly = (ctx, pts) => {
    for (const dx of [0, -W]) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y) : ctx.moveTo(x + dx, y)));
      ctx.closePath();
      ctx.fill();
    }
  };
  const fenetreAllumee = (x, y, w, h, p) => {
    if (alea() < p) {
      n.fillStyle = `rgb(${Math.round(150 + alea() * 105)},0,0)`;
      rect(n, x, y, w, h);
    }
  };

  // — au loin : une ligne de toits dans la brume —
  g.fillStyle = '#b9c1cf';
  for (let x = 0; x < W; ) {
    const w = 10 + alea() * 50;
    const haut = Y(0.4 + alea() * 2.2);
    rect(g, x, haut, w + 1, Y(-2) - haut);
    if (alea() < 0.25) rect(g, x + w * 0.3, haut - 6, 3, 6); // une cheminée
    x += w;
  }
  // la tour Eiffel, au loin, un peu à droite quand on regarde par la lucarne (vers le nord)
  {
    const cx = X(188);
    const [base, haut, lb] = [Y(0.2), Y(7.5), 1.3 * PXD];
    const silhouette = (ctx, k) => {
      const h = base - haut;
      ctx.beginPath();
      ctx.moveTo(cx - lb * k, base);
      ctx.quadraticCurveTo(cx - lb * 0.18 * k, base - h * 0.35, cx - 1.2 * k, base - h * 0.92);
      ctx.lineTo(cx, haut);
      ctx.lineTo(cx + 1.2 * k, base - h * 0.92);
      ctx.quadraticCurveTo(cx + lb * 0.18 * k, base - h * 0.35, cx + lb * k, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - lb * 0.45 * k, base - h * 0.27, lb * 0.9 * k, 2); // le premier étage
      ctx.fillRect(cx - lb * 0.22 * k, base - h * 0.55, lb * 0.44 * k, 2); // le deuxième
    };
    g.fillStyle = '#98a1b2';
    silhouette(g, 1);
    g.fillStyle = '#b9c1cf'; // l'arche entre les pieds
    g.beginPath();
    g.ellipse(cx, base, lb * 0.5, (base - haut) * 0.12, 0, Math.PI, 0);
    g.fill();
    // la nuit : une lueur dorée douce, les deux étages plus brillants, le phare au sommet
    n.fillStyle = 'rgb(0,95,0)';
    silhouette(n, 0.85);
    n.fillStyle = 'rgb(0,255,0)';
    const h = base - haut;
    n.fillRect(cx - lb * 0.4, base - h * 0.27, lb * 0.8, 2);
    n.fillRect(cx - lb * 0.2, base - h * 0.55, lb * 0.4, 2);
    n.fillRect(cx - 1, haut - 1, 3, 3);
  }

  // — deux rangées d'immeubles haussmanniens, la plus lointaine plus pâle —
  const rangee = ({ corniche: [c0, c1], bas, echelle, brume }) => {
    const teinte = (hex) => {
      const c = new THREE.Color(hex).lerp(new THREE.Color('#c7d0dc'), brume);
      return `#${c.getHexString()}`;
    };
    for (let x = 0; x < W; ) {
      const w = (50 + alea() * 120) * echelle;
      const eC = c0 + alea() * (c1 - c0); // la corniche
      const dR = (1 + alea() * 1.3) * echelle; // la hauteur du comble
      const [yC, yR] = [Y(eC), Y(eC + dR)];
      const recul = 7 * echelle; // le comble est en retrait de la façade
      // la façade et ses fenêtres
      g.fillStyle = teinte(alea() < 0.5 ? '#e4d9c4' : '#ddd0b8');
      rect(g, x, yC, w + 1, Y(bas) - yC);
      g.fillStyle = teinte('#cbbfa9');
      rect(g, x, yC, w + 1, 2 * echelle); // la corniche
      const [fl, fh, pasX, pasY] = [4 * echelle, 7 * echelle, 12 * echelle, 1.7 * PXD * echelle];
      for (let y = yC + 5 * echelle; y < Y(bas) - fh; y += pasY) {
        g.fillStyle = teinte('#2f3440');
        rect(g, x + 2, y + fh + 2 * echelle, w - 4, Math.max(1, echelle)); // le balcon filant
        for (let fx = x + 5 * echelle; fx < x + w - fl - 3 * echelle; fx += pasX) {
          g.fillStyle = teinte('#6c7584');
          rect(g, fx, y, fl, fh);
          fenetreAllumee(fx, y, fl, fh, 0.32);
        }
      }
      // le comble en zinc, ses lucarnes
      g.fillStyle = teinte('#8a95a5');
      poly(g, [[x + 2, yC], [x + w - 2, yC], [x + w - recul, yR], [x + recul, yR]]);
      g.fillStyle = teinte('#a9b2bf');
      rect(g, x + recul, yR, w - 2 * recul, Math.max(1, echelle));
      for (let lx = x + recul + 4 * echelle; lx < x + w - recul - 8 * echelle; lx += 20 * echelle) {
        const [lw, lh] = [6 * echelle, 7 * echelle];
        const ly = yC - lh - 2 * echelle;
        g.fillStyle = teinte('#d6ccb8');
        rect(g, lx, ly, lw, lh);
        g.fillStyle = teinte('#4d5665');
        rect(g, lx + echelle, ly + 2 * echelle, lw - 2 * echelle, lh - 3 * echelle);
        fenetreAllumee(lx + echelle, ly + 2 * echelle, lw - 2 * echelle, lh - 3 * echelle, 0.25);
      }
      // une ou deux souches de cheminée, et leurs mitrons en terre cuite
      for (let k = alea() < 0.6 ? 2 : 1; k > 0; k--) {
        const sw = (10 + alea() * 14) * echelle;
        const sx = x + recul + alea() * Math.max(1, w - 2 * recul - sw);
        const sh = (1.2 + alea() * 1.6) * PXD * echelle;
        g.fillStyle = teinte('#d4bf9d');
        rect(g, sx, yR - sh, sw, sh + (yC - yR) * 0.6);
        g.fillStyle = teinte('#bba483');
        rect(g, sx + sw * 0.65, yR - sh, sw * 0.35, sh + (yC - yR) * 0.6);
        g.fillStyle = teinte('#c4694a');
        for (let px = sx + 1.5 * echelle; px < sx + sw - 3 * echelle; px += 4.5 * echelle) rect(g, px, yR - sh - 5 * echelle, 3 * echelle, 5 * echelle);
      }
      x += w;
    }
  };
  rangee({ corniche: [-0.6, -2.8], bas: -6, echelle: 1, brume: 0.45 });
  rangee({ corniche: [-4.5, -7.5], bas: -13, echelle: 1.7, brume: 0.18 });

  // — tout près : des toits en zinc à joints debout, leurs faîtages, une grosse souche de cheminée —
  for (let x = 0; x < W; ) {
    const w = 250 + alea() * 450;
    const eT = -11 - alea() * 4;
    const pente = 40 + alea() * 40;
    g.fillStyle = '#86909e';
    poly(g, [[x, H], [x, Y(eT) + pente], [x + pente, Y(eT)], [x + w - pente, Y(eT)], [x + w, Y(eT) + pente], [x + w, H]]);
    g.fillStyle = '#a2acb9';
    rect(g, x + pente, Y(eT), w - 2 * pente, 3); // le faîtage
    g.fillStyle = '#9aa4b1';
    for (let sx = x + 14; sx < x + w - 6; sx += 15) rect(g, sx, Y(eT) + 3 + (sx < x + pente ? x + pente - sx : sx > x + w - pente ? sx - (x + w - pente) : 0), 2, H);
    x += w + 2;
  }
  {
    const [sx, sw] = [X(166), 60];
    const yT = Y(-5);
    g.fillStyle = '#d2bc98';
    rect(g, sx, yT, sw, H - yT);
    g.fillStyle = '#b39d7c';
    rect(g, sx + sw * 0.7, yT, sw * 0.3, H - yT);
    g.fillStyle = '#c9b18e';
    rect(g, sx - 3, yT, sw + 6, 5);
    g.fillStyle = '#c0644a';
    for (let k = 0; k < 6; k++) rect(g, sx + 4 + k * 9, yT - 16, 6, 16);
  }

  const texture = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.generateMipmaps = false; // pas de mipmaps : la couture du panorama (atan) ferait une ligne
    t.minFilter = THREE.LinearFilter;
    return t;
  };
  return { toits: texture(toits, true), lumieres: texture(lumieres, false) };
}

export function creerVueFenetres() {
  const { toits, lumieres } = dessinerPanorama();
  const communs = {
    uZenith: { value: new THREE.Color('#7fb2e5') },
    uHorizon: { value: new THREE.Color('#d9ecf7') },
    uTeinte: { value: new THREE.Color('#ffffff') },
    uJour: { value: 1 },
    uIntensite: { value: 1 },
  };
  const materiaux = [];
  const etat = { f: 1, d: 1, store: 0 };

  function materiau({ dos = false } = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: { ...communs, tToits: { value: toits }, tLumieres: { value: lumieres }, uOpacite: { value: 1 } },
      side: dos ? THREE.BackSide : THREE.FrontSide,
      vertexShader: /* glsl */ `
        varying vec3 vMonde;
        void main() {
          vec4 p = modelMatrix * vec4(position, 1.0);
          vMonde = p.xyz;
          gl_Position = projectionMatrix * viewMatrix * p;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tToits, tLumieres;
        uniform vec3 uZenith, uHorizon, uTeinte;
        uniform float uJour, uIntensite, uOpacite;
        varying vec3 vMonde;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float bruit(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
          vec3 dir = normalize(vMonde - cameraPosition);
          float e = asin(clamp(dir.y, -1.0, 1.0));
          float az = atan(dir.x, -dir.z);
          float nuit = 1.0 - uJour;
          // le ciel : de l'horizon au zénith, quelques nuages qui s'étirent, des étoiles la nuit
          vec3 ciel = mix(uHorizon, uZenith, pow(clamp(e / 1.1, 0.0, 1.0), 0.6));
          vec2 q = vec2(az * 2.2, e * 9.0);
          float nuage = bruit(q) * 0.55 + bruit(q * 2.3 + 7.1) * 0.3 + bruit(q * 5.1 + 3.3) * 0.15;
          nuage = smoothstep(0.55, 0.85, nuage) * smoothstep(0.02, 0.25, e);
          ciel = mix(ciel, mix(uHorizon * 1.08, vec3(0.16, 0.18, 0.28), nuit), nuage * 0.6);
          vec2 g = vec2(az, e) * 70.0;
          float etoile = step(0.988, h21(floor(g))) * smoothstep(0.32, 0.0, length(fract(g) - 0.5)) * smoothstep(0.05, 0.2, e);
          ciel += etoile * nuit * (1.0 - nuage) * 0.9;
          // les toits : le panorama, éclairé selon l'heure, ses fenêtres allumées la nuit et la tour Eiffel dorée
          vec2 uv = vec2(az / 6.2831853 + 0.5, clamp((degrees(e) + 35.0) / 70.0, 0.002, 0.998));
          vec4 toit = texture2D(tToits, uv);
          vec3 l = texture2D(tLumieres, uv).rgb;
          vec3 bati = mix(toit.rgb * vec3(0.09, 0.1, 0.16), toit.rgb * uTeinte, uJour);
          bati += (l.r * vec3(1.0, 0.74, 0.4) * 1.1 + l.g * vec3(1.0, 0.7, 0.3) * 1.1) * smoothstep(0.35, 0.9, nuit);
          vec3 c = mix(ciel, bati, toit.a);
          gl_FragColor = vec4(c * uIntensite, uOpacite);
          // pas de tone mapping : dehors, les couleurs restent franches (le jour y est plus vif que dans la pièce)
          #include <colorspace_fragment>
        }`,
    });
    m.userData.sansSurbrillance = true;
    // les murs s'effacent en baissant l'opacité de leurs matériaux : la vitre suit
    m.onBeforeRender = () => {
      m.uniforms.uOpacite.value = m.opacity;
    };
    materiaux.push(m);
    return m;
  }

  // les couleurs de l'heure : plein jour, soleil rasant, nuit
  const [ZJ, HJ, ZR, HR, ZN, HN] = ['#78ade6', '#d6eaf6', '#6f7fb8', '#f4b48a', '#0a1029', '#27315a'].map((c) => new THREE.Color(c));
  const a = new THREE.Color();
  function appliquer() {
    const { f, d } = etat;
    const rasant = Math.pow(1 - d, 3) * f; // près du lever ou du coucher
    communs.uZenith.value.copy(ZN).lerp(a.copy(ZJ).lerp(ZR, rasant), f);
    communs.uHorizon.value.copy(HN).lerp(a.copy(HJ).lerp(HR, rasant), f);
    communs.uTeinte.value.set('#ffffff').lerp(a.set('#ffc49c'), rasant).multiplyScalar(0.8 + 0.2 * d);
    communs.uJour.value = f;
    communs.uIntensite.value = 1 - 0.95 * etat.store;
  }
  appliquer();
  return {
    materiau,
    maj(f, d) {
      Object.assign(etat, { f, d });
      appliquer();
    },
    store(s) {
      etat.store = s;
      appliquer();
    },
  };
}
