import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'review:';

function socketTransport(session, { url } = {}) {
  const API = url ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
  
  const listeners = new Set();
  let socket = null;

  SecureStore.getItemAsync('hackathon_token').then(token => {
    socket = io(API, {
      transports: ['websocket'], // Use websocket only for React Native
      auth: { token },
      query: { session },
    });

    socket.on('connect', () => socket.emit('join', { session }));
    socket.on('msg', (data) => {
      for (const fn of listeners) fn(data);
    });
    socket.on('connect_error', (err) => {
      console.error('[collab] connexion LAN refusée :', err?.message || err);
    });
  }).catch(() => {});

  return {
    mode: 'socket',
    post(msg) {
      if (socket) socket.emit('msg', { ...msg, session });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      if (socket) socket.disconnect();
    },
  };
}

export function createTransport(session, opts = {}) {
  // Mobile uses socket transport exclusively
  return socketTransport(session, opts);
}
