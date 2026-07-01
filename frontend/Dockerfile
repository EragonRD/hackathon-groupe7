FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# VITE_API_URL vide = appels relatifs (/auth/login, /keys/…)
# nginx proxifie ces routes vers le backend dans le réseau Docker
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
# Temps réel MULTI-MACHINES : socket.io via la gateway (nginx proxifie /socket.io).
# Sans ça le build retombe sur BroadcastChannel = même navigateur uniquement, donc
# les invités/collaborateurs d'une AUTRE machine ne peuvent pas rejoindre la session.
ARG VITE_COLLAB_MODE="socket"
ENV VITE_COLLAB_MODE=${VITE_COLLAB_MODE}
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
