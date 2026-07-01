import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'hackathon_token';

export async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
    }
    throw new Error('Identifiant ou mot de passe incorrect.');
  }
  
  const data = await res.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) {
    await SecureStore.setItemAsync('hackathon_refresh', data.refreshToken);
  }
  return data.user;
}

export async function logout() {
  const rt = await SecureStore.getItemAsync('hackathon_refresh');
  if (rt) {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync('hackathon_refresh');
}

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getClaims() {
  const t = await getToken();
  if (!t) return null;
  try {
    const payload = t.split('.')[1];
    // atob is not available globally in RN by default unless polyfilled, 
    // but we can use a simple base64 decoder or just fetch /auth/me. 
    // Since we need it sync, we can use a simple base64 decode if needed,
    // but in RN, we can use Buffer.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Polyfill for atob
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function atob(input) {
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 == 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (let bc = 0, bs = 0, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

export async function getRole() {
  const claims = await getClaims();
  return claims?.role ?? null;
}

export async function getCompanyId() {
  const claims = await getClaims();
  return claims?.companyId ?? null;
}

export async function isAdmin() {
  const role = await getRole();
  return ['admin', 'superadmin'].includes(role);
}

export async function isSuperAdmin() {
  const role = await getRole();
  return role === 'superadmin';
}

export async function mustChangePwd() {
  const claims = await getClaims();
  return Boolean(claims?.mustChangePassword);
}

export async function me() {
  if (!(await getToken())) return null;
  try {
    const res = await authFetch('/auth/me');
    if (!res.ok) {
      await logout();
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword, newPassword) {
  const res = await authFetch('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    let serverMsg = null;
    try {
      const data = await res.json();
      serverMsg = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    } catch {}
    if (res.status === 401) throw new Error('Mot de passe actuel incorrect.');
    throw new Error(serverMsg || 'Impossible de changer le mot de passe.');
  }
  const data = await res.json();
  await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) {
    await SecureStore.setItemAsync('hackathon_refresh', data.refreshToken);
  }
  return data.user;
}

export async function authFetch(path, options = {}) {
  let token = await getToken();
  let res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  
  if (res.status === 401 && token) {
    // Try to refresh token
    const rt = await SecureStore.getItemAsync('hackathon_refresh');
    if (rt) {
      try {
        const refreshRes = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
          if (data.refreshToken) {
            await SecureStore.setItemAsync('hackathon_refresh', data.refreshToken);
          }
          token = data.accessToken;
          // Re-attempt original request
          res = await fetch(`${API}${path}`, {
            ...options,
            headers: {
              ...(options.headers ?? {}),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
        }
      } catch (e) {}
    }
    
    if (res.status === 401) {
      await logout();
      DeviceEventEmitter.emit('auth:expired');
    }
  }
  return res;
}
