import { authFetch, getToken } from '../auth';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function listUsers() {
  const res = await authFetch('/admin/users');
  return res.ok ? res.json() : [];
}

export async function listContents() {
  const res = await authFetch('/admin/contents');
  return res.ok ? res.json() : [];
}

export async function revokeContent(id) {
  const res = await authFetch(`/admin/contents/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
  if (!res.ok) throw new Error('Révocation échouée');
}

export async function restoreContent(id) {
  const res = await authFetch(`/admin/contents/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error('Restauration échouée');
}

export async function deleteContent(id) {
  const res = await authFetch(`/admin/contents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Suppression échouée');
}

// Lien d'invité temporaire pour un contenu. ttl ∈ '15m' | '1h' | '24h'.
export async function inviteGuest(contentId, ttl = '24h') {
  const res = await authFetch(`/contents/${encodeURIComponent(contentId)}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl }),
  });
  if (!res.ok) throw new Error("Lien d'invitation indisponible");
  return res.json(); // { token, shareUrl, expiresAt }
}

// Upload vidéo (multipart) avec progression via XHR — l'API upload progress de
// fetch n'est pas fiable en React Native.
export async function uploadVideo({ uri, name, title, onProgress }) {
  const token = await getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/admin/contents/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(null);
        }
      } else {
        reject(new Error(xhr.status === 413 ? 'Fichier trop volumineux (max 1 Go).' : "Échec de l'upload."));
      }
    };
    xhr.onerror = () => reject(new Error('Upload échoué (réseau).'));
    const form = new FormData();
    form.append('file', { uri, name: name || 'video.mp4', type: 'video/mp4' });
    if (title) form.append('title', title);
    xhr.send(form);
  });
}
