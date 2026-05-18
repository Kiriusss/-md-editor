# MD Editor

一款基于 **Electron** 构建的现代化 Markdown 文档编辑器。使用 **TypeScript** 编写，采用清晰的单向数据流架构。

## 功能特性

- **单向同步架构** — 左侧编辑 Markdown 源码，右侧实时预览渲染结果
- **双击跳转源码** — 双击右侧预览任意元素，自动跳转到左侧对应源码行并高亮
- **丰富格式工具栏** — 16+ 个按钮，支持加粗、斜体、标题、代码、表格、列表等
- **实时预览** — 编辑源码即刻更新预览
- **深色/浅色主题** — 一键切换主题
- **源码编辑器** — 可选显示/隐藏源码编辑器
- **文件操作** — 新建、打开、保存、另存为
- **键盘快捷键** — 常用操作均支持快捷键
- **中英文切换** — 界面支持中英文双语言
- **未保存提醒** — 关闭前自动检测未保存的修改

## 架构说明

```
┌─────────────────────────────────────────────────────┐
│                      Toolbar                         │
├──────────────────────────┬──────────────────────────┤
│   Editor (textarea)      │    Preview (read-only)    │
│                          │                           │
│  ← 所有编辑和格式化在此    │   ← Marked 渲染 Markdown   │
│  ← 光标/选中管理          │   ← 双击跳转至对应源码行    │
│                          │                           │
└──────────────────────────┴──────────────────────────┘
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [npm](https://www.npmjs.com/) (随 Node.js 一起安装)

### 安装

```bash
# 进入项目目录
cd md-editor

# 安装依赖
npm install
```

### 运行

```bash
npm start
```

此命令会先编译 TypeScript，然后启动 Electron 应用。

### 编译

```bash
# 仅编译 TypeScript（不启动应用）
npm run compile
```

### 打包

```bash
# 构建 Windows 安装包 (electron-builder)
npm run build

# 构建 Windows 便携版 (electron-packager)
npm run build:win
```

## 使用说明

### 基本编辑

1. **开始输入** — 在左侧编辑器面板输入 Markdown 文本
2. **使用工具栏** — 点击按钮快速插入 Markdown 语法
3. **实时预览** — 右侧面板实时渲染 Markdown 结果
4. **双击跳转** — 双击右侧预览中的任意元素，左侧编辑器自动定位到对应源码行

### 格式按钮

| 分组 | 按钮 | 说明 |
|------|------|------|
| 文本样式 | **B** *I* <u>U</u> ~~S~~ 🖍️ | 加粗、斜体、下划线、删除线、高亮 |
| 标题 | H1 H2 H3 | 一级、二级、三级标题 |
| 代码 | `<>` `{ }` ❝ — | 行内代码、代码块、引用、分割线 |
| 插入 | 🔗 🖼️ ▦ ☑ | 链接、图片、表格、复选框列表 |
| 列表 | • List 1. List | 无序列表、有序列表 |

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + S` | 保存文件 |
| `Ctrl + Shift + S` | 另存为 |
| `Ctrl + O` | 打开文件 |
| `Ctrl + N` | 新建文件 |
| `Ctrl + \` | 切换源码编辑器显示/隐藏 |

### 双击跳转源码

双击右侧预览面板中的任意元素（标题、段落、表格行、列表项等），左侧编辑器会自动：
- 定位到对应的 Markdown 源码行
- 选中该行内容
- 滚动到可视区域
- 编辑器短暂高亮提示

### 文件操作

- **新建** — 创建空白文档
- **打开** — 打开 `.md` 或 `.txt` 文件
- **保存** — 保存当前文档（使用上次保存的路径）
- **另存为** — 以新名称/位置保存

## 项目结构

```
md-editor/
├── main.ts          # Electron 主进程
├── preload.ts       # 预加载脚本（上下文桥接）
├── renderer.ts      # 渲染进程（所有 UI 逻辑）
├── index.html       # 主页面模板
├── tsconfig.json    # TypeScript 配置
├── types/
│   └── global.d.ts  # 全局类型声明
├── build/           # TypeScript 编译输出（.gitignore）
├── package.json     # 项目配置
├── README.md        # 本文件
├── locale/
│   ├── zh.js        # 中文语言包
│   └── en.js        # 英文语言包
└── styles/
    ├── main.css     # 默认样式
    └── dark.css     # 深色主题样式覆盖
```

## 技术栈

- [Electron](https://www.electronjs.org/) — 跨平台桌面应用框架
- [TypeScript](https://www.typescriptlang.org/) — 类型安全的 JavaScript
- [Marked](https://marked.js.org/) — Markdown 解析器

## AI 驱动声明

本项目**完全由 AI 编写**，由在单张 RTX 5090 上运行的 **Qwen3.6-27B-NVFP4-Q4_K_M.gguf** 模型驱动。

从项目搭建、功能实现、UI 设计、国际化支持到 Bug 修复，所有代码均由该模型独立完成。

## 许可证

MIT