import * as THREE from 'three';
import * as textures from './textures.js';

// L'habillage des modèles .glb : les écrans allumés, les images imprimées, les décalques. Ils ne sont pas dans les
// fichiers .glb : le programme repère leurs maillages par leur nom (src/modeles/*.js) et leur donne ici leur
// matériau. Partagé par la pièce (src/main.js) et l'atelier (src/atelier.js), pour qu'un modèle y soit le même.
//   reve : la chambre de rêve (le tapis Miffy, le Macintosh Plus allumé et la 3DS ne sont faits que pour elle)
export function creerHabillage({ reve }) {
  // Écran du Mac : une capture du site lui-même (public/textures/ecran-mac.jpg), allumée comme un écran.
  const matEcranMac = new THREE.MeshStandardMaterial({
    color: '#000000',
    emissive: '#ffffff',
    emissiveMap: textures.image('/textures/ecran-mac.jpg'),
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  matEcranMac.userData.sansSurbrillance = true;
  // Les écrans du bureau bas (chambre de rêve) : un fond d'écran chacun, allumé comme celui du Mac. Le programme
  // les repère par le nom de leur maillage dans le modèle (src/modeles/reve.js).
  const matsEcrans = Object.fromEntries(
    Object.entries({ 'ecran-moniteur': '/textures/ecran-moniteur.jpg', 'ecran-thinkpad': '/textures/ecran-thinkpad.jpg' }).map(([nom, url]) => {
      // polygonOffset : la dalle passe toujours devant le cadre de l'écran, même de loin (sans quoi elle scintille)
      const materiau = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.image(url), emissiveIntensity: 0.85, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      materiau.userData.sansSurbrillance = true;
      return [nom, materiau];
    }),
  );
  // les photocards NMIXX du bureau bas : leur image, à peine brillante
  for (const nom of ['pola1', 'pola2', 'pola3', 'carte']) {
    matsEcrans[`photocard-${nom}`] = new THREE.MeshStandardMaterial({ map: textures.image(`/textures/pc-${nom}.jpg`), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    // la carte elle-même : devant l'image du tapis (−2), derrière sa photo (−6)
    matsEcrans[`carte-${nom}`] = new THREE.MeshStandardMaterial({ color: '#f8f7f3', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  }
  // les coffrets des Season's Greetings sur l'étagère murale : leur face et leur tranche imprimées
  for (const nom of ['nmixx-face', 'nmixx-tranche', 'twice-face', 'twice-tranche']) {
    matsEcrans[`sg-${nom}`] = new THREE.MeshStandardMaterial({ map: textures.image(`/textures/sg-${nom}.jpg`), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // les pochettes des vinyles du meuble hi-fi
  for (const nom of ['yeonjun', 'machine', 'sphere', 'cortis', 'chuu']) {
    matsEcrans[`vinyle-${nom}`] = new THREE.MeshStandardMaterial({ map: textures.image(`/textures/vinyle-${nom}.jpg`), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // l'étiquette du vinyle posé sur la platine Rega : la pochette de YEONJUN « NO LABELS » montre le disque lui-même ;
  // on y découpe son étiquette blanche (« A », « PART III », la liste des titres), centrée en (0,693 ; 0,5), rayon 0,178
  {
    const t = textures.image('/textures/vinyle-yeonjun.jpg');
    t.repeat.set(0.356, 0.356);
    t.offset.set(0.693 - 0.178, 0.5 - 0.178);
    matsEcrans['etiquette-rega'] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // les deux jewel cases à plat sur la tablette du meuble hi-fi : la photo du boîtier, sous son plastique brillant
  for (const nom of ['h2h', 'lngshot']) {
    matsEcrans[`jewel-${nom}`] = new THREE.MeshStandardMaterial({ map: textures.image(`/textures/jewel-${nom}.jpg`), roughness: 0.22, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // le tapis tufté tête de Miffy : sa bouclette blanche et son contour noir, avec le relief des boucles
  if (reve) {
    const { map, relief } = textures.tapisMiffy();
    matsEcrans['imprime-miffy'] = new THREE.MeshStandardMaterial({ map, bumpMap: relief, bumpScale: 2.5, roughness: 1 });
  }
  // le Macintosh Plus, allumé : terminal du NAS, il surveille le stockage (un écran qui vit, redessiné deux fois par
  // seconde dans la boucle d'animation) ; il luit, le verre du tube reste brillant
  const moniteurNas = reve ? textures.moniteurNas() : null;
  if (moniteurNas) matsEcrans['ecran-macplus'] = new THREE.MeshStandardMaterial({ color: '#0c0d0c', emissive: '#ffffff', emissiveMap: moniteurNas.texture, emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.1 });
  // la Nintendo 3DS de la console du lit : ses deux écrans allumés sur Pokémon Lune (polygonOffset : rien n'est posé
  // dessus), le cadre imprimé de l'écran tactile, les lettres et POWER (détourés)
  if (reve) {
    const t3ds = textures.ecrans3ds();
    const ecran3ds = (map) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.9, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    matsEcrans['ecran-3ds-haut'] = ecran3ds(t3ds.haut);
    matsEcrans['ecran-3ds-bas'] = ecran3ds(t3ds.bas);
    for (const nom of ['ecran-3ds-haut', 'ecran-3ds-bas']) matsEcrans[nom].userData.sansSurbrillance = true;
    matsEcrans['imprime-3ds-cadre'] = new THREE.MeshStandardMaterial({ map: t3ds.cadre, roughness: 0.3, metalness: 0.15 });
    const marquage = (map) => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.3, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const c of ['a', 'b', 'x', 'y']) matsEcrans[`marquage-3ds-${c}`] = marquage(t3ds.lettres[c]);
    matsEcrans['marquage-3ds-power'] = marquage(t3ds.power);
    matsEcrans['marquage-3ds-power-nom'] = marquage(t3ds.powerNom);
  }
  // le coffre en osier de la TV : le dessus tressé de son couvercle (un motif de 6 cm répété) ; le logo Brandt de la TV
  {
    const { map, relief } = textures.osierTresse();
    for (const t of [map, relief]) t.repeat.set(14.5, 7.7);
    matsEcrans['osier-couvercle'] = new THREE.MeshStandardMaterial({ map, bumpMap: relief, bumpScale: 1.6, roughness: 0.9 });
    matsEcrans['marque-tv'] = new THREE.MeshStandardMaterial({ map: textures.logoBrandt(), transparent: true, alphaTest: 0.3, depthWrite: false, roughness: 0.35, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // le mini-rack NAS : le tableau de bord sur l'écran du ThinkPad, et les chiffres des deux afficheurs
  matsEcrans['ecran-thinkpad-nas'] = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.tableauDeBord(), emissiveIntensity: 0.85, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  matsEcrans['rack-lcd-ventilo'] = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.afficheur([['24°', 14, 40, 52], ['26°', 140, 40, 52], ['IN', 18, 98, 24], ['OUT', 140, 98, 24], ['▲3', 200, 98, 24]]), emissiveIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  matsEcrans['rack-lcd-onduleur'] = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: textures.afficheur([['78', 70, 62, 84], ['%', 186, 76, 30]]), emissiveIntensity: 1.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // le Macintosh Plus : la pomme arc-en-ciel et son nom, les icônes du menton (des décalques détourés)
  for (const nom of ['marque', 'icones']) {
    matsEcrans[`macplus-${nom}`] = new THREE.MeshStandardMaterial({ map: textures.image(`/textures/macplus-${nom}.png`), transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  // le drapeau punaisé au-dessus du coin hi-fi : un tissu satiné, à peine brillant
  matsEcrans['imprime-drapeau'] = new THREE.MeshStandardMaterial({ map: textures.image('/textures/drapeau-servir-le-peuple.jpg'), roughness: 0.68 });
  // le logo Arc'teryx brodé du sac à dos : le fil doré, détouré (le reste du décalque est transparent)
  matsEcrans['logo-arcteryx'] = new THREE.MeshStandardMaterial({ map: textures.image('/textures/logo-arcteryx.png'), transparent: true, alphaTest: 0.35, roughness: 0.45, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // et le tapis de souris du bureau bas : son image imprimée, mate
  // la serviette du Season's Greetings de TWICE, sous la tasse : son imprimé, sur une éponge mate
  matsEcrans['imprime-serviette'] = new THREE.MeshStandardMaterial({ map: textures.image('/textures/serviette-twice.jpg'), roughness: 1 });
  matsEcrans['tapis-souris'] = new THREE.MeshStandardMaterial({ map: textures.image('/textures/tapis-souris.jpg'), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // le sous-main du bureau du studio : ton plan bleu, imprimé sur un tissu à peine satiné (c'est la surface même du
  // tapis : pas de polygonOffset, qui le ferait passer devant le bas des objets posés dessus, vus de biais)
  matsEcrans['sous-main-plan'] = new THREE.MeshStandardMaterial({ map: textures.image('/textures/sous-main-plan.jpg'), roughness: 0.8 });

  // habille un maillage d'un modèle qui vient d'être chargé
  function habiller(o) {
    // le Mac du bureau : une capture du site dans une fenêtre de navigateur
    if (o.name === 'ecran-mac') o.material = matEcranMac;
    if (matsEcrans[o.name]) o.material = matsEcrans[o.name];
    // les légendes des claviers (ThinkPad, Dash75) et les logos du ThinkPad (dessinés dans le modèle) : toujours devant leur support
    if (o.name === 'legendes-thinkpad' || o.name === 'legendes-dash75' || o.material?.name === 'logo-thinkpad' || /^imprime-(rega|moondrop)/.test(o.name)) Object.assign(o.material, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  }
  return { matsEcrans, moniteurNas, habiller };
}
