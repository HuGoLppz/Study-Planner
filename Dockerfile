# Imagen de producción de Study Planner: la API sirve también el frontend compilado.
#   docker compose up -d --build     (ver README, "Todo en Docker")
# Tres etapas: compilar el cliente, instalar las dependencias de producción del servidor y una
# imagen final sin herramientas de compilación ni código fuente del cliente.

ARG NODE_IMAGE=node:24.20.0-bookworm-slim

# ---------------------------------------------------------------- cliente
FROM ${NODE_IMAGE} AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ---------------------------------------------------------------- dependencias del servidor
FROM ${NODE_IMAGE} AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------- imagen final
FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=4000 \
    SERVE_CLIENT=true \
    CLIENT_DIST=../client/dist \
    UPLOAD_DIR=uploads
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=client /app/client/dist /app/client/dist
# La carpeta de archivos tiene que existir con permisos del usuario sin privilegios.
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "src/server.js"]
