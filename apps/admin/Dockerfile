FROM node:24-bookworm-slim AS pruner
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN pnpm add --global turbo@2.5.5
WORKDIR /workspace
COPY . .
RUN pnpm exec turbo prune @futzone/admin --docker

FROM node:24-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /workspace
COPY --from=pruner /workspace/out/json/ .
RUN pnpm fetch --frozen-lockfile
COPY --from=pruner /workspace/out/full/ .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm exec turbo run build --filter=@futzone/admin
RUN mkdir -p apps/admin/public
RUN pnpm --filter @futzone/admin deploy --prod /runtime

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/apps/admin
RUN groupadd --system --gid 1001 futzone && useradd --system --uid 1001 --gid futzone futzone
COPY --from=builder --chown=futzone:futzone /workspace/apps/admin/.next/standalone/ /app/
COPY --from=builder --chown=futzone:futzone /workspace/apps/admin/.next/static/ /app/apps/admin/.next/static/
COPY --from=builder --chown=futzone:futzone /workspace/apps/admin/public/ /app/apps/admin/public/
USER futzone
EXPOSE 3001
CMD ["node", "server.js"]
