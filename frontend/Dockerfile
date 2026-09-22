# ---------- Stage 1: 构建 ----------
FROM oven/bun:1-alpine AS build

WORKDIR /build

# 国内镜像，构建更快
ENV BUN_CONFIG_REGISTRY=https://registry.npmmirror.com

COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
RUN bun install --frozen-lockfile || bun install

# 前端会从 @ledger/shared 引类型，共享包必须一起进构建上下文
COPY packages/shared packages/shared
COPY frontend frontend

# build 脚本是 tsc --noEmit && vite build，类型不过镜像就构建失败
RUN cd frontend && bun run build

# ---------- Stage 2: 运行 ----------
FROM nginx:1.27-alpine

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime 2>/dev/null || true

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
