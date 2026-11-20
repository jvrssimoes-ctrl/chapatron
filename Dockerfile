# CHAPATRON: um único container serve o jogo (build do Vite) e o WebSocket na mesma porta.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:${PORT}/health || exit 1
CMD ["npm", "start"]
