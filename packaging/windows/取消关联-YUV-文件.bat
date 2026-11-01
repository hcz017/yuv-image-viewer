@echo off
chcp 65001 >nul

for %%E in (nv12 nv21 i420 yv12 p010 yuv) do (
  reg delete "HKCU\Software\Classes\.%%E" /f >nul 2>nul
  reg delete "HKCU\Software\Classes\YuvImageViewer.%%E" /f >nul 2>nul
)

echo 已取消 .nv12 .nv21 .i420 .yv12 .p010 .yuv 与本程序的文件关联。
pause
