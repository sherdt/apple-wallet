FROM node:24-alpine AS web-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY web ./web
RUN npm run build:web

FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public
COPY --from=web-build /build/public/admin ./public/admin

USER 65532:65532
EXPOSE 3000
CMD ["node", "src/server.js"]
