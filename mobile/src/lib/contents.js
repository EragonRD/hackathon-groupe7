import { authFetch } from '../auth';

// Catalogue de l'utilisateur : contenus de SON entreprise auxquels il a accès
// (endpoint /contents, distinct de /admin/contents). Chaque item :
//   { id, title, revoked, guestUpload, status, progress, playable }
// status: 'processing' | 'ready' | 'failed' · playable: HLS prêt + clé provisionnée.
export async function listMyContents() {
  const res = await authFetch('/contents');
  if (!res.ok) return [];
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Métadonnées IA d'un contenu (contrat P3-A). Statuts renvoyés par le Core :
//   200 -> prêt (données) · 202 -> en cours · 404 -> pas d'analyse · 409 -> erreur
// Normalisé en { status, data?, error? } pour l'UI.
export async function getMetadata(contentId) {
  const res = await authFetch(`/contents/${encodeURIComponent(contentId)}/metadata`);
  if (res.status === 200) return { status: 'done', data: await res.json() };
  if (res.status === 202) return { status: 'processing' };
  if (res.status === 404) return { status: 'not_analyzed' };
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    return { status: 'error', error: body?.error ?? 'Analyse en erreur' };
  }
  if (res.status === 403) return { status: 'not_analyzed' };
  return { status: 'error', error: `Réponse inattendue (${res.status})` };
}
