#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================"
echo "  记账本 Expense Tracker - Docker 一键启动"
echo "============================================"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "[错误] 没有检测到 docker 命令，请先安装 Docker。"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[错误] Docker 引擎未运行，请先启动 Docker。"
  exit 1
fi

WEB_PORT=8088
if [ -f .env ]; then
  # shellcheck disable=SC1091
  WEB_PORT="$(grep -E '^WEB_PORT=' .env | tail -1 | cut -d= -f2 || echo 8088)"
  WEB_PORT="${WEB_PORT:-8088}"
fi

echo "[1/2] 构建镜像并启动容器（首次构建需要几分钟）..."
docker compose up -d --build

echo
echo "[2/2] 当前容器状态："
docker compose ps

echo
echo "============================================"
echo "  启动完成！"
echo "  浏览器访问：http://localhost:${WEB_PORT}"
echo "  查看日志  ：docker compose logs -f"
echo "  停止服务  ：docker compose down"
echo "============================================"
