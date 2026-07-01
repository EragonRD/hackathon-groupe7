import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

const MAX_PENDING = 100; // borne le tampon si le socket ne se connecte jamais

function socketTransport(session, { url } = {}) {
  const API = url ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

  const listeners = new Set();
  let socket = null;
  let connected = false;
  // Le socket s'ouvre de façon asynchrone (après lecture du token) : on met en
  // file les messages émis avant la connexion (dont le `join` initial) et on les
  // rejoue une fois connecté, sinon le premier `join` serait perdu -> pas de
  // resync des notes pour un participant qui rejoint.
  const pending = [];

  const flush = () => {
    if (!socket) return;
    while (pending.length) socket.emit('msg', pending.shift());
  };

  SecureStore.getItemAsync('hackathon_token').then(token => {
    socket = io(API, {
      transports: ['websocket'], // Use websocket only for React Native
      auth: { token },
      query: { session },
    });

    socket.on('connect', () => {
      connected = true;
      socket.emit('join', { session });
      flush();
    });
    socket.on('disconnect', () => {
      connected = false;
    });
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
      const full = { ...msg, session };
      if (connected && socket) {
        socket.emit('msg', full);
      } else {
        pending.push(full);
        if (pending.length > MAX_PENDING) pending.shift();
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      pending.length = 0;
      if (socket) socket.disconnect();
    },
  };
}

export function createTransport(session, opts = {}) {
  // Mobile uses socket transport exclusively
  return socketTransport(session, opts);
}
