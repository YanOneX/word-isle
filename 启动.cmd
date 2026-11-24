@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未找到 Node.js，请先安装 Node 18 或更高版本。
  echo 下载地址：https://nodejs.org/
  echo.
  pause
  exit /b 1
)
echo 正在启动词屿...
node server.mjs
if errorlevel 1 pause
