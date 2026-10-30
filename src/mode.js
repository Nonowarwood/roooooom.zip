// La pièce choisie dans le menu d'accueil (src/accueil.js), avant que la scène ne se charge :
//   « chambre » : ma chambre telle qu'elle est ;
//   « reve » : la chambre de rêve, le mur nord abattu et la chambre voisine ajoutée (voir `voisine` dans chambre.js).
export const reve = globalThis.PIECE === 'reve';
// Miniature : la scène est affichée dans le carrousel du menu d'accueil (dans une iframe). Pas d'interface, pas
// d'intro, fond transparent ; la caméra tourne lentement autour du diorama.
export const miniature = globalThis.MINIATURE === true;
