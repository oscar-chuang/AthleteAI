FROM node:24-alpine AS builder
WORKDIR /workspace

RUN corepack enable

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy packages the API server depends on
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the API server (esbuild bundles TypeScript → dist/index.mjs)
RUN pnpm --filter @workspace/api-server run build

# ---- Runtime stage ----
FROM node:24-alpine
WORKDIR /workspace

RUN corepack enable

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/ ./lib/
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /workspace/artifacts/api-server/dist ./artifacts/api-server/dist

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
