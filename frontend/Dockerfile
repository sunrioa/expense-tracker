# ---------- Stage 1: 构建 ----------
FROM node:22-alpine AS build

WORKDIR /build

# 国内 npm 镜像，构建更快
RUN npm config set registry https://registry.npmmirror.com

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

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
