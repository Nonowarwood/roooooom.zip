// Lever et coucher du soleil réels pour un lieu et un jour donnés (formule « sunrise equation » de la
// NOAA, précise à une minute ou deux près). Les heures renvoyées sont en heure locale du navigateur,
// comme l'horloge de la page (par exemple 17,88 = 17 h 53).
//   date : un Date (le jour qui compte) ; lat, lon : en degrés (lon positive vers l'est)
// Aux latitudes polaires, le soleil peut ne pas se lever ou ne pas se coucher : on renvoie alors un jour
// de 0 h à 24 h (nuit polaire : de 12 h à 12 h, soit un jour de durée nulle).
const RAD = Math.PI / 180;

export function heuresSoleil(date, lat, lon) {
  const jj = date.getTime() / 86400000 + 2440587.5; // jour julien
  const n = Math.ceil(jj - 2451545.0 + 0.0008); // numéro du jour solaire
  const jEtoile = n - lon / 360; // à l'est, le midi solaire arrive plus tôt
  const M = (357.5291 + 0.98560028 * jEtoile) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const midi = 2451545.0 + jEtoile + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinDelta = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const delta = Math.asin(sinDelta);
  const cosOmega = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinDelta) / (Math.cos(lat * RAD) * Math.cos(delta));
  if (cosOmega > 1) return { lever: 12, coucher: 12 }; // le soleil ne se lève pas
  if (cosOmega < -1) return { lever: 0, coucher: 24 }; // le soleil ne se couche pas
  const omega = Math.acos(cosOmega) / RAD;
  const enHeures = (j) => {
    const d = new Date((j - 2440587.5) * 86400000);
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  };
  return { lever: enHeures(midi - omega / 360), coucher: enHeures(midi + omega / 360) };
}

// 17,88 -> « 17:53 »
export function formatHeure(h) {
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
