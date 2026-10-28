import { defineConfig } from 'vite';

// base './' : les chemins sont relatifs, le site marche à la racine (npm run dev) comme dans
// un sous-dossier (GitHub Pages). `/models/x.glb` dans le code est ramené à la base par chemin().
export default defineConfig({ base: './' });
