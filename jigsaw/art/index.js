// Verzeichnis aller Maler (prozedurale Bilder). Ein neuer Maler: Datei anlegen und hier eintragen.
import berge from './berge.js';
import wiese from './wiese.js';
import meer from './meer.js';
import nacht from './nacht.js';
import muster from './muster.js';
import ballone from './ballone.js';
import unterwasser from './unterwasser.js';
import bluete from './bluete.js';
import wald from './wald.js';

export const painters = [berge, wiese, meer, nacht, muster, ballone, unterwasser, bluete, wald];

export function painterById(id) {
  return painters.find((p) => p.id === id) || null;
}
