# ---------- 运行镜像 ----------
# Bun 直接执行 TypeScript，不需要单独的构建阶段
FROM oven/bun:1-alpine

ENV TZ=Asia/Shanghai \
    BUN_CONFIG_REGISTRY=https://registry.npmmirror.com

RUN ln -snf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime 2>/dev/null || true

WORKDIR /app

# 先只拷 manifest，把依赖安装单独做成一层，改代码不会重装依赖
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
RUN bun install --frozen-lockfile || bun install

COPY packages/shared packages/shared
COPY server server

EXPOSE 8080

# busybox wget 自带，无需额外安装
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=15 \
  CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null 2>&1 || exit 1

CMD ["bun", "run", "server/src/index.ts"]
