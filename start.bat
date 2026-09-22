@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   记账本 Expense Tracker - Docker 一键启动
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo [错误] 没有检测到 docker 命令，请先安装 Docker Desktop。
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [错误] Docker 引擎未运行。
  echo        请先打开 Docker Desktop，等左下角显示 Engine running 后重试。
  pause
  exit /b 1
)

set WEB_PORT=8088
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    if /i "%%a"=="WEB_PORT" set WEB_PORT=%%b
  )
)

echo [1/2] 构建镜像并启动容器（首次构建需要几分钟，请耐心等待）...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [错误] 启动失败，请查看上面的日志。
  pause
  exit /b 1
)

echo.
echo [2/2] 当前容器状态：
docker compose ps

echo.
echo ============================================
echo   启动完成！
echo   浏览器访问：http://localhost:%WEB_PORT%
echo   查看日志  ：docker compose logs -f
echo   停止服务  ：stop.bat
echo ============================================
pause
