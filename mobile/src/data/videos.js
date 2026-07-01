export const SAMPLE = {
  id: 'poc',
  title: 'Séquence de démonstration (chiffrée · Zero-Trust)',
  category: 'Présentation',
  duration_sec: null,
  src: '/videos/poc/index.m3u8',
  session: 'demo-42c',
  playable: true,
}

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
