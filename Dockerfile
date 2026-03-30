# ==============================================
# ビルド引数で パッケージマネージャ と CMD パターンを切り替え
#
#   --build-arg PKG_MANAGER=npm|yarn
#   --build-arg CMD_PATTERN=direct|npm|yarn|shell
#
# 例:
#   docker build --build-arg PKG_MANAGER=yarn --build-arg CMD_PATTERN=yarn -t signal-test .
#   docker build --build-arg PKG_MANAGER=npm  --build-arg CMD_PATTERN=direct -t signal-test .
# ==============================================

ARG PKG_MANAGER=npm

# --- builder ---
FROM node:24-slim AS builder
ARG PKG_MANAGER
WORKDIR /app

RUN if [ "$PKG_MANAGER" = "yarn" ]; then corepack enable && corepack prepare yarn@4 --activate; fi

COPY package.json yarn.lock* package-lock.json* ./
RUN if [ "$PKG_MANAGER" = "yarn" ]; then yarn install; \
    else npm install; fi

COPY tsconfig.json nest-cli.json ./
COPY src/ ./src/
RUN npx nest build

# --- runtime ---
FROM node:24-slim
ARG PKG_MANAGER
ARG CMD_PATTERN=direct
WORKDIR /app

RUN if [ "$PKG_MANAGER" = "yarn" ]; then corepack enable && corepack prepare yarn@4 --activate; fi

COPY package.json yarn.lock* package-lock.json* ./
RUN if [ "$PKG_MANAGER" = "yarn" ]; then yarn install --production; \
    else npm install --omit=dev; fi

COPY --from=builder /app/dist ./dist

# CMD_PATTERN で起動方法を切り替え
# シェルの条件分岐で ENTRYPOINT を動的に設定
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'case "$CMD_PATTERN" in' >> /entrypoint.sh && \
    echo '  npm)   exec npm start ;;' >> /entrypoint.sh && \
    echo '  yarn)  exec yarn start ;;' >> /entrypoint.sh && \
    echo '  shell) exec /bin/sh -c "node dist/main" ;;' >> /entrypoint.sh && \
    echo '  *)     exec node dist/main ;;' >> /entrypoint.sh && \
    echo 'esac' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENV CMD_PATTERN=${CMD_PATTERN}
ENTRYPOINT ["/entrypoint.sh"]
