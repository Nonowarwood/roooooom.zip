// Compresse la géométrie des modèles .glb de public/models en Draco (KHR_draco_mesh_compression) : 3 à 10 fois
// moins lourds à télécharger. Le site sait les lire (DRACOLoader dans src/main.js et src/atelier.js).
// Rien d'autre ne change : les noms des nœuds, des maillages et des matériaux (dont dépendent l'habillage, les
// animations « pivot_ » et les objets cliquables « objet_ »), les textures et la hiérarchie restent tels quels.
// À lancer après chaque export depuis modeles.html : `npm run compresser` (les fichiers déjà compressés sont sautés ;
// `npm run compresser -- tv` ne traite que tv.glb). Le bonhomme (perso.glb) n'est pas compressé : src/perso.js le
// charge sans décodeur Draco.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const DOSSIER = new URL('../public/models/', import.meta.url).pathname;
const SAUTES = new Set(['perso.glb']);
const choix = process.argv.slice(2).map((n) => (n.endsWith('.glb') ? n : `${n}.glb`));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

let [avant, apres] = [0, 0];
for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith('.glb')).sort()) {
  if (SAUTES.has(nom) || (choix.length && !choix.includes(nom))) continue;
  const chemin = join(DOSSIER, nom);
  const doc = await io.read(chemin);
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_draco_mesh_compression')) {
    console.log(`${nom} : déjà compressé`);
    continue;
  }
  const taille = statSync(chemin).size;
  // 16 bits pour les positions (au dixième de millimètre sur un meuble d'un mètre : les décalques posés à
  // 0,4 mm de leur support restent devant), 12 pour les UV, 10 pour les normales
  await doc.transform(draco({ method: 'edgebreaker', quantizePosition: 16, quantizeTexcoord: 12, quantizeNormal: 10, quantizeColor: 8, quantizeGeneric: 12 }));
  await io.write(chemin, doc);
  const nouvelle = statSync(chemin).size;
  avant += taille;
  apres += nouvelle;
  console.log(`${nom} : ${Math.round(taille / 1024)} Ko -> ${Math.round(nouvelle / 1024)} Ko`);
}
if (avant) console.log(`total : ${(avant / 1048576).toFixed(1)} Mo -> ${(apres / 1048576).toFixed(1)} Mo`);
