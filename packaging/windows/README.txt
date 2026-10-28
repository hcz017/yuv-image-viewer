YUV Image Viewer - Windows 绿色版

运行要求
- Windows 10/11 x64
- WebView2 Runtime（Windows 11 已内置；Windows 10 如提示缺失，请安装
  Microsoft Edge WebView2 Runtime 后重新启动）

使用
- 双击 yuv-image-viewer.exe 启动
- 可把 .nv12 / .nv21 / .i420 / .yv12 / .p010 / .yuv 文件或目录拖进窗口
- 也可通过命令行或“打开方式”传入路径

配置
- 默认保存在 exe 同目录的 config.json
- 若 exe 所在目录不可写，自动回退到 %APPDATA%\com.houchengzhi.yuvimageviewer\config.json

说明
- 仅读取第一帧；仅支持 BT.601 / BT.709 的 Full range
- 未签名分发包首次运行可能触发 SmartScreen 提示，选择“仍要运行”即可
