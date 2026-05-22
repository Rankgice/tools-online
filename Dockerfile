# ---------- 1) build: 用 node:20-alpine 跑 vite build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# package*.json 单独 copy + ci, 利用 layer cache: 源码变更不重装依赖
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build


# ---------- 2) runtime: nginx 静态 + 反代 /api ----------
FROM nginx:1.27-alpine

# nginx:alpine 自带 entrypoint, 启动前会用 envsubst 处理 /etc/nginx/templates/*.template
# 生成到 /etc/nginx/conf.d/, 所以这里把模板放进 templates/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html

# 后端 /api/* 反代目标; 部署时可覆盖, 例如 -e API_UPSTREAM=http://portal:8899
ENV API_UPSTREAM=http://portal:8899
# 仅限制 envsubst 替换这一个变量, 避免误吃 nginx 自带的 $host / $remote_addr 之类
ENV NGINX_ENVSUBST_FILTER='^API_'

EXPOSE 80
# 不重写 ENTRYPOINT / CMD, 沿用 nginx:alpine 的默认行为
