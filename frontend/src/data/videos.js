// Catalogue de démonstration.
//
// - SAMPLE : la vraie vidéo locale (déposée dans frontend/public/sample.mp4).
//   C'est l'entrée jouable utilisée pour la démo.
// - CATALOGUE_META : un extrait des métadonnées réelles de data/videos.csv,
//   affiché pour montrer la grille. Marqué "métadonnées seulement" tant que le
//   fichier vidéo correspondant n'est pas fourni (pas de faux contenu jouable).

export const SAMPLE = {
  id: 'poc',
  title: 'Séquence de démonstration (chiffrée · Zero-Trust)',
  category: 'Présentation',
  duration_sec: null, // lu directement depuis la vidéo au chargement
  // Flux HLS CHIFFRÉ servi par le Core (même origine → tunnel). La clé AES n'est
  // délivrée que si l'utilisateur est authentifié et autorisé (Pôle 2).
  src: '/videos/poc/index.m3u8',
  session: 'demo-42c',
  playable: true,
}

// Sous-ensemble fidèle de data/videos.csv (id, titre, catégorie, durée).
export const CATALOGUE_META = [
  { id: 'v01', title: 'Vidéo 1', category: 'Marketing', duration_sec: 447 },
  { id: 'v05', title: 'Vidéo 5', category: 'Conférence', duration_sec: 534 },
  { id: 'v07', title: 'Vidéo 7', category: 'Tutoriel', duration_sec: 429 },
  { id: 'v18', title: 'Vidéo 18', category: 'Produit', duration_sec: 525 },
].map((v) => ({
  ...v,
  playable: false,
  thumb: `https://picsum.photos/seed/${v.id}/480/270`,
}))
