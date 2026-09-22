@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在停止记账本服务...
docker compose down
echo.
echo 服务已停止。数据仍保留在 Docker 卷 ledger-mysql-data 中。
echo 如需连同数据一起删除，请执行：docker compose down -v
pause
