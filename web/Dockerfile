ARG NODE_BUILDER_REF=docker.io/library/node:22-alpine
ARG NGINX_BASE_REF=docker.io/library/nginx:alpine
FROM ${NODE_BUILDER_REF} AS builder
WORKDIR /app
ENV VITE_API_BASE_URL=
ENV npm_config_registry=https://registry.npmmirror.com \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=600000 \
    npm_config_timeout=600000
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm ci --prefer-offline --no-audit --no-fund
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM ${NGINX_BASE_REF}
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
