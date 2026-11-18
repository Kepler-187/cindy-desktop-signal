# Cindy 状态红绿灯

Windows 桌面悬浮灯，用红、黄、绿分别显示需要处理、进行中和已完成的 Cindy 任务。三盏灯可以同时点亮，支持本机任务和伙伴状态。

## 安装

从 [Releases](https://github.com/Kepler-187/cindy-desktop-signal/releases) 下载 .cindy 安装包，拖入 Windows 版 Cindy（0.1.137 或以上）并启用。桌面组件已随包提供。

## 使用

- 悬停灯罩查看任务列表，点击灯罩固定面板，点击任务跳到对应对话。
- 拖动灯体移动位置，靠近屏幕边缘松手可吸附。
- 在插件设置中分别调整灯体和信息面板大小。拖动信息面板滑块时，桌面会打开实际面板供预览。
- 监控范围默认当天，也可选近两天或三天。面板的「清空」只清除当前提示。

## 构建

在 Windows 上运行 build.ps1，用系统的 .NET Framework C# 编译器将 Signal.cs 编译为 plugin/node/Signal.exe。使用 Cindy 的插件打包工具打包 plugin 目录。
