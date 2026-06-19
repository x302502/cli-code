# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · **中文** · [日本語](README.ja.md)

> 在代码旁边的终端中打开你喜爱的 AI 编程助手，并用一个快捷键把你正在查看的文件直接送进去。

![多个 AI CLI 在 VS Code 中并排运行](images/screenshots/terminals.png)

## 它能做什么？

许多 AI 编程工具运行在终端里：**Claude Code、Codex、Gemini、opencode** 等等。如果你同时使用不止一个，来回切换会很麻烦。

**CLI Code** 让它们全都触手可及，只需一个快捷键：

- 按一个键 → 选择一个助手 → 它在**编辑器旁边**的终端中打开。
- 按另一个键 → 把**你正在查看的文件**（以及你选中的行）送入助手的提示词。无需复制粘贴。

## 快速开始

### 1. 安装

在 VS Code 中打开**扩展**视图（`Cmd/Ctrl + Shift + X`），搜索 **CLI Code**，点击 **Install**。

![CLI Code 在 VS Code 应用市场](images/screenshots/marketplace.png)

### 2. 安装你想用的助手

CLI Code 只负责**启动**助手 —— 它不会安装它们。请确保你想用的助手已安装并能从终端运行。开箱即支持以下助手：

| 助手                                                                                       | 终端命令      |
| ------------------------------------------------------------------------------------------ | ------------- |
| [Claude Code](https://code.claude.com/docs/en/setup)                                       | `claude`      |
| [Codex CLI](https://developers.openai.com/codex/cli)                                       | `codex`       |
| [Mimo](https://github.com/XiaomiMiMo/MiMo-Code)                                            | `mimo`        |
| [Antigravity](https://antigravity.google)                                                  | `agy`         |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) | `copilot`     |
| [opencode](https://opencode.ai)                                                            | `opencode`    |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)                                  | `gemini`      |
| [Amp](https://ampcode.com)                                                                 | `amp`         |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart)                            | `droid`       |
| [Kiro CLI](https://kiro.dev)                                                               | `kiro-cli`    |
| [CommandCode](https://github.com/just-every/code)                                          | `commandcode` |

> ⚠️ **先安装*并*登录。** 大多数助手在运行前需要先完成身份验证 —— `claude`
> （登录 Anthropic 账号）、`codex`（OpenAI 登录 / API key）、`gemini`（Google
> 登录）等等。请在普通终端中先运行每个工具一次，完成其登录流程，并确认它能启动。
>
> 💡 提示：如果某个命令在普通终端里能运行，那它在这里也能运行。

## 如何使用

### 打开一个助手

按 **`Cmd + Esc`**（macOS）或 **`Ctrl + Esc`**（Windows / Linux）。

弹出的菜单会列出所有助手。选择其一 —— 它会在旁边的终端中打开并开始运行。如果该助手已经打开，快捷键只会跳回到它。

![列出所有助手的 CLI 选择器](images/screenshots/picker-highlighted.png)

> 想要一个全新会话而不是复用已打开的？使用 **`Cmd/Ctrl + Shift + Esc`**。

你也可以从编辑器工具栏打开 —— 找到 CLI Code 图标（已圈出）：

![编辑器工具栏上的 CLI Code 图标](images/screenshots/toolbar-highlighted.png)

### 发送你正在处理的文件

1. 点击进入某个文件（可选地**选中几行**）。
2. 点击助手的终端使其获得焦点。
3. 按 **`Cmd + Alt + K`**（macOS）或 **`Ctrl + Alt + K`**（Windows / Linux）。

CLI Code 会把对你文件的引用插入到提示词中：

| 你做了什么     | 它插入               |
| -------------- | -------------------- |
| 刚打开一个文件 | `@src/app.ts`        |
| 选中了一行     | `@src/app.ts#L10`    |
| 选中了多行     | `@src/app.ts#L10-20` |

现在只需输入你的问题 —— 助手已经知道你指的是哪个文件（和哪些行）。

## 快捷键

| 操作                | macOS               | Windows / Linux      |
| ------------------- | ------------------- | -------------------- |
| 打开 / 聚焦一个助手 | `Cmd + Esc`         | `Ctrl + Esc`         |
| 在新终端中打开助手  | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 把当前文件发送给它  | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

这三个命令也可在命令面板（`Cmd/Ctrl + Shift + P`）中找到：**Open CLI**、**Open CLI in new tab**、**CLI: Insert At-Mentioned**。

## 常见问题

**菜单打开了，但终端显示 "command not found"。**
该助手未安装或不在 `PATH` 中。打开普通终端，检查命令（如 `claude`）能否运行。如果不能，请先安装该工具。

**助手打开了，但要求我登录。**
这是正常的 —— CLI Code 只负责启动工具，不处理身份验证。在任意终端中完成该助手自己的登录流程一次，之后它会记住你。

**按 `Cmd + Alt + K` 没有反应。**
请确保（1）编辑器中有打开的文件，并且（2）助手的终端处于焦点状态。文件引用会进入当前活动的 CLI 终端。

**快捷键与其他功能冲突。**
在 VS Code 中重新绑定：**Preferences → Keyboard Shortcuts**，搜索 "CLI"，设置你自己的按键。

## 许可证

[MIT](LICENSE) © 2026 Thanh Luan
