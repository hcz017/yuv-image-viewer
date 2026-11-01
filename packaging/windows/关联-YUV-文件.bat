@echo off
chcp 65001 >nul
setlocal
set "EXE=%~dp0yuv-image-viewer.exe"

if not exist "%EXE%" (
  echo 未找到 %EXE%
  echo 请将本脚本与 yuv-image-viewer.exe 放在同一目录后重试。
  pause
  exit /b 1
)

for %%E in (nv12 nv21 i420 yv12 p010 yuv) do (
  reg add "HKCU\Software\Classes\.%%E" /ve /d "YuvImageViewer.%%E" /f >nul
  reg add "HKCU\Software\Classes\YuvImageViewer.%%E" /ve /d "YUV 图像 (.%%E)" /f >nul
  reg add "HKCU\Software\Classes\YuvImageViewer.%%E\DefaultIcon" /ve /d "\"%EXE%\",0" /f >nul
  reg add "HKCU\Software\Classes\YuvImageViewer.%%E\shell\open\command" /ve /d "\"%EXE%\" \"%%1\"" /f >nul
)

echo 已完成 .nv12 .nv21 .i420 .yv12 .p010 .yuv 的文件关联（仅当前用户，无需管理员权限）。
echo 双击以上格式的文件将使用本程序打开。
echo 若图标未刷新，请注销重新登录或重启资源管理器。
pause
