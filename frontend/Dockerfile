# ---------- Stage 1: 构建 ----------
FROM oven/bun:1-alpine AS build

WORKDIR /build

# 国内镜像，构建更快（对应原来的 npm config set registry）
ENV BUN_CONFIG_REGISTRY=https://registry.npmmirror.com

# bun.lock 存在就按锁定版本装；仓库里还没有时 bun 会自行解析并生成
COPY package.json bun.lock* ./
RUN bun install

COPY . .
# build 脚本是 tsc --noEmit && vite build，类型不过镜像就构建失败
RUN bun run build

# ---------- Stage 2: 运行 ----------
FROM nginx:1.27-alpine

ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime 2>/dev/null || true

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
