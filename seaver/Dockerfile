ARG NODE_BUILDER_REF=docker.io/library/node:18-bullseye-slim
ARG NODE_RUNNER_REF=docker.io/library/node:18-bullseye-slim
FROM ${NODE_BUILDER_REF} AS builder
WORKDIR /app
# 使用国内 apt 源并安装构建依赖，加速 native 模块（如 sqlite3）编译
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list \
 && apt-get update \
 && apt-get install -y python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
# 使用国内 npm 源，并通过 node-gyp 使用国内 headers 镜像，强制本地编译减少 GitHub 预编译下载
ENV npm_config_registry=https://registry.npmmirror.com \
    npm_config_disturl=https://npmmirror.com/mirrors/node \
    npm_config_build_from_source=true
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm ci --prefer-offline --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM ${NODE_RUNNER_REF} AS runner
WORKDIR /app
ENV npm_config_registry=https://registry.npmmirror.com
COPY package*.json ./
COPY .npmrc .npmrc
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
ENV PORT=4000
EXPOSE 4000
CMD ["node","dist/server.js"]