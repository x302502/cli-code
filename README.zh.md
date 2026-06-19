# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · **中文** · [日本語](README.ja.md)

> 在 VS Code 侧边终端中启动并切换各种 AI 编程 CLI —— Claude Code、Codex、Gemini、opencode 等等 —— 并将你正在查看的文件直接发送给运行中的智能体。

## 为什么选择 CLI Code？

如果你使用基于终端的 AI 编程智能体，你大概会同时使用好几个。CLI Code 让你**一个快捷键**就能选中其中任意一个，在编辑器旁边的终端中打开它，并把**当前文件（含选中的行）**直接送入智能体的提示词，无需复制粘贴。

## 功能特性

- 🚀 **一键启动** —— 按下快捷键，选择一个 CLI，它就在代码旁的终端中打开。
- 🔁 **复用或新建** —— 聚焦到已运行的 CLI，或始终新开一个。
- 📎 **发送当前文件** —— 将 `@path/to/file.ts#L10-20`（含你的选区）插入到聚焦的 CLI。
- 🌐 **支持 HTTP 的 CLI** —— 对于暴露本地 API 的智能体（如 opencode），文件通过端口发送而非键入。
- 🐝 **内置 11 个 CLI** —— 用几行配置即可添加你自己的 CLI。

## 支持的 CLI

| #   | CLI                | 命令                                  |
| --- | ------------------ | ------------------------------------- |
| 1   | Claude Code        | `claude`                              |
| 2   | Codex CLI          | `codex`                               |
| 3   | Mimo               | `mimo`                                |
| 4   | opencode           | `opencode --port {port}`（支持 HTTP） |
| 5   | Gemini CLI         | `gemini`                              |
| 6   | GitHub Copilot CLI | `copilot`                             |
| 7   | Amp                | `amp`                                 |
| 8   | Droid              | `droid`                               |
| 9   | Kiro CLI           | `kiro-cli`                            |
| 10  | Antigravity        | `agy`                                 |
| 11  | CommandCode        | `commandcode`                         |

> 每个 CLI 都必须已安装且在你的 `PATH` 中。CLI Code 只负责启动命令 —— 它**不会**替你安装这些智能体。

## 安装

**从应用市场** —— 在扩展视图（`Cmd/Ctrl + Shift + X`）中搜索 **"CLI Code"**，或：

```bash
code --install-extension x302502.cli-code
```

**从 `.vsix` 文件：**

```bash
code --install-extension cli-code-0.1.0.vsix
```

## 使用方法

### 1. 打开一个 CLI

| 操作                              | macOS               | Windows / Linux      |
| --------------------------------- | ------------------- | -------------------- |
| 打开 CLI 选择器（若已运行则复用） | `Cmd + Esc`         | `Ctrl + Esc`         |
| 在**新**终端中打开 CLI            | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 将当前文件插入到聚焦的 CLI        | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

Quick Pick 会列出所有已配置的 CLI。选择其一，它就在编辑器**旁边**的终端中打开并运行对应命令。如果你使用了复用快捷键且该 CLI 已打开，CLI Code 只会聚焦到它的终端。

### 2. 发送你正在处理的文件

将光标放在某个文件中（可选地选中若干行），聚焦到 CLI 终端，然后按 `Cmd/Ctrl + Alt + K`。CLI Code 会插入如下引用：

- `@src/app.ts` —— 整个文件
- `@src/app.ts#L10` —— 单行
- `@src/app.ts#L10-20` —— 行范围

对于**支持 HTTP** 的 CLI（目前为 opencode），引用会通过智能体的本地 HTTP API 发送；其他则键入到终端。

> 这些命令也可在命令面板（`Cmd/Ctrl + Shift + P`）中使用：**Open CLI**、**Open CLI in new tab**、**CLI: Insert At-Mentioned**。

## 添加你自己的 CLI

CLI Code 由配置驱动。打开 [`src/lib/config.ts`](src/lib/config.ts) 并向 `CLI_TOOLS` 添加一项：

```ts
{
  id: "my-agent",            // 唯一 id（也是终端名称）
  label: "My Agent",         // 在选择器中显示
  description: "My coding agent CLI",
  command: "my-agent",       // shell 命令；HTTP 型 CLI 使用 "{port}"
  hasHttpApi: false,
}
```

对于支持 HTTP API 的 CLI，添加 API 字段：

```ts
{
  id: "opencode",
  label: "opencode",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_EXTENSION_OPENCODE_PORT", // CLI 读取端口所用的环境变量
  appendPromptPath: "/tui/append-prompt", // 接收文件引用的端点
  readyCheckPath: "/app",                 // 轮询直至服务就绪的端点
  extraEnv: { OPENCODE_CALLER: "vscode" },
}
```

各项的顺序即为选择器中显示的顺序。

## 开发

本项目使用 [Bun](https://bun.sh)。

```bash
bun install          # 安装依赖
bun run compile      # 类型检查 + lint + 构建到 dist/
bun run watch:esbuild # 变更时重新构建
bun test             # 运行单元测试
bun run vsix         # 打包 .vsix
```

在 VS Code 中按 `F5` 启动已加载该扩展的 **Extension Development Host**。

### 项目结构

```
src/
├── extension.ts        # 激活外壳（注册命令）
└── lib/
    ├── config.ts       # CliTool 类型 + CLI_TOOLS 注册表
    ├── commands.ts     # 命令处理器
    ├── terminal.ts     # 终端创建、工具选择、端口
    ├── http-client.ts  # 面向 API 型 CLI 的 HTTP 调用
    └── editor.ts       # 当前文件引用辅助函数
```

## 要求

- VS Code `^1.94.0`
- 你想使用的 CLI 智能体，已安装且在 `PATH` 中。

## 许可证

[MIT](LICENSE) © 2026 Thanh Luan
