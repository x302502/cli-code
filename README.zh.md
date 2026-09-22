# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · **中文** · [日本語](README.ja.md)

📖 [User Guide (English)](docs/user-guide.md) · [Changelog](CHANGELOG.md)

> **VS Code 的智能体终端。** Claude Code、Codex、Copilot、opencode、Pi、Grok、Droid 等 28 个编程智能体，每个都运行在一个懂它的标签里：显示智能体在做什么，打开它提到的东西，重载后保留会话，并能重启回同一会话。

![多个 AI CLI 在 VS Code 中并排运行](images/screenshots/terminals.png)

## 为什么

每个正经的编程智能体都是终端程序。放在普通终端标签里运行，那个标签是"瞎"的：它不知道智能体在等你批准，不知道智能体刚改了哪个文件，重载就没了，重启就忘了会话。

CLI Code 用一个为智能体而生的界面取而代之——自带操作栏、实时状态、可点击输出和框内提示的独立 webview 终端——而智能体本身原封不动：同样的 CLI、同样的 shell、同样的 MCP 服务器和插件。

## 你得到什么

**知道智能体状态的标签。** 标签按你交代的任务自动改名，并带一个标记：`⟳` 工作中，`?` 等你，`●` 你在别的标签时已完成。隐藏标签上的智能体需要你时会发出带 *Open tab* 按钮的通知。终端上方的操作栏显示正在使用的模型。

**围绕智能体的界面，而不是裸终端。** 终端上方是一条采用 Claude 视觉语言的安静操作栏：New Session（带智能体选择器）、Resume、Restart、Find，以及 `…` 菜单（Rename、Copy Context、Quick Command）。左侧显示正在使用的模型、智能体等你时的状态行，以及运行中的智能体比其配置更旧时的 *"… changed — restart to apply"* 提示。悬停链接可见它将打开什么；查找支持区分大小写和正则；智能体退出时出现带 Restart 按钮的覆盖层，进程消失时出现 *session ended* 页面。字体和颜色跟随 VS Code 主题；还可在终端下方启用聊天式输入框。

**智能体打印的一切都可点击。** 文件路径在编辑器中精确到行列打开，文件夹在资源管理器中显示（工作区之外则用 Finder/Explorer），URL 在浏览器打开，Markdown 打开预览。只有真实存在的路径才会加下划线。普通点击选中整个链接，`Cmd/Ctrl + C` 即可复制；即使 Claude Code 正捕获鼠标，选择与复制照样可用。

**会话不会丢。** 智能体运行在后台守护进程下，*Reload Window* 会把每个标签连同回滚缓冲、标题、状态一起重新接上。真需要新进程时——新增 MCP 服务器、装插件、更新——*Restart Session* 让 28 个智能体中的 19 个回到完全相同的会话，配置变化的标签会在空闲时自动重启。

**一个快捷键，你真正的 shell。** `Cmd/Ctrl + Esc` 在编辑器旁、项目目录里、你的交互式登录 shell 中打开 28 个智能体中的任何一个——`PATH`、nvm、pnpm、MCP 服务器，与终端完全一致。`Cmd/Ctrl + Alt + K` 把正在看的文件以 `@src/app.ts#L10-20` 的形式放进提示词。

**以及那些小事。** 恢复历史会话、快捷命令（来自设置或从选区保存）、复制最后 200 行作为上下文、终端内查找、按标签缩放、`Shift + Enter` 换行、随上下文变化的右键菜单、彩色智能体图标。

它是怎么知道的：CLI Code 在每个智能体自己的配置里装一个小*状态钩子*（Claude Code、Codex、Copilot、Droid、Grok、opencode、Kilo、MiMo、Pi、OMP）。它只运行一行在 CLI Code 之外什么都不做的 shell，文件先备份，一个设置即可全部移除。详见 [User Guide](docs/user-guide.md#16-status-hooks-what-lets-a-tab-know-what-the-agent-is-doing)。

## 工作原理

CLI Code **不**使用 VS Code 的集成终端。每个智能体都在一个**扩展自己的 webview 面板**中打开——一个渲染终端（xterm.js）的编辑器标签，周围是操作栏、状态标记、链接提示、搜索栏和各种提示。智能体进程本身运行在属于该 VS Code 窗口的**后台守护进程**中，所以 *Reload Window* 是重新接上而不是杀掉它。

这对你意味着：

- 标签的行为和编辑器标签一样：拖到任意列、拆分、固定、每个智能体开多个。它不会出现在终端面板里。
- VS Code 的 `terminal.*` 设置和终端快捷键不适用；CLI Code 使用你的 `editor.fontFamily` / `editor.fontSize`、你的颜色主题，以及只在 CLI Code 标签聚焦时生效的自有快捷键（见下文）。
- 智能体原样运行，在你的交互式登录 shell 里，带着你真正的 `PATH`、MCP 服务器和插件。

## 快速开始

1. 从应用市场**安装**（`Cmd/Ctrl + Shift + X` → *CLI Code*）。VS Code 1.94+，macOS 或 Linux 可获得全部功能。
2. 在普通终端里**安装并登录**你要用的智能体（`claude`、`codex`、`copilot`、`opencode`…）。CLI Code 只负责启动，不负责安装。终端里能跑的命令这里就能跑。
3. **按 `Cmd/Ctrl + Esc`**，选一个智能体，开始输入。在编辑器里按 `Cmd/Ctrl + Alt + K` 把当前文件交给它。

> ⚠️ 智能体启动时**关闭了审批提示**（`claude --dangerously-skip-permissions`、`codex --dangerously-bypass-approvals-and-sandbox`、`copilot --yolo` …），以便不间断工作。它们会不经询问地改文件、跑命令——只在你信任的仓库上使用 CLI Code，想要审批提示时请从普通终端启动智能体。

## 支持的智能体

| 智能体 | 命令 | 标签状态 | 重启 → 同一会话 | 显示模型 |
| --- | --- | :-: | :-: | :-: |
| [Claude Code](https://code.claude.com/docs/en/setup) | `claude` | ✓ | ✓ | ✓ |
| [Claude Agent Teams](https://code.claude.com/docs/en/agent-teams) | `claude` | ✓ | ✓ | ✓ |
| [Codex CLI](https://developers.openai.com/codex/cli) | `codex` | ✓ | ✓ | ✓ |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) | `copilot` | ✓ | ✓ | ✓ |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart) | `droid` | ✓ | ✓ | ✓ |
| [Grok](https://x.ai/cli) | `grok` | ✓ | ✓ | ✓ |
| [opencode](https://opencode.ai) | `opencode` | ✓ | ✓ | ✓ |
| [Kilocode](https://kilo.ai) | `kilo` | ✓ | ✓ | ✓ |
| [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code) | `mimo` | ✓ | ✓ | ✓ |
| [Pi](https://pi.dev) | `pi` | ✓ | ✓ | ✓ |
| [OMP](https://omp.sh) | `omp` | ✓ | ✓ | ✓ |
| [Command Code](https://github.com/just-every/code) | `command-code` | — | ✓ | ✓ |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) | `prime-agent` | — | ✓ | ✓ |
| [Cline](https://cline.bot) | `cline` | — | ✓ | ✓ |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html) | `kimi` | — | ✓ | — |
| [Cursor](https://cursor.com/cli) | `cursor-agent` | — | ✓ | — |
| [Amp](https://ampcode.com) | `amp` | — | ✓ | — |
| [Antigravity](https://antigravity.google) | `agy` | — | ✓ | — |
| [Goose](https://block.github.io/goose/docs/quickstart/) | `goose` | — | ✓ | — |
| [Aider](https://aider.chat/docs/) | `aider` | — | `--continue` | — |
| [Kiro](https://kiro.dev) | `kiro-cli` | — | `--continue` | — |
| [Charm / Crush](https://github.com/charmbracelet/crush) | `crush` | — | `--continue` | — |
| [Auggie](https://docs.augmentcode.com/cli/overview) | `auggie` | — | `--continue` | — |
| [Continue](https://docs.continue.dev/guides/cli) | `cn` | — | `--continue` | — |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe) | `vibe` | — | `--continue` | — |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | `qwen` | — | `--continue` | — |
| [Hermes](https://hermes-agent.nousresearch.com/docs/) | `hermes` | — | `--continue` | — |
| [Devin](https://devin.ai/cli) | `devin` | — | `--continue` | — |

*标签状态*需要状态钩子，前 11 个已有。*重启 → 同一会话* ✓ 重新打开完全相同的会话；`--continue` 使用智能体自己的"最近会话"标志。*显示模型*：操作栏能从智能体的会话文件中读到模型。选择器把 `PATH` 上找到的智能体排在前面。

## 日常使用

**打开并交出文件。** `Cmd/Ctrl + Esc` 打开或聚焦一个智能体；`Cmd/Ctrl + Shift + Esc` 再开一个它的标签；*New Session* 按钮在当前标签的目录里再开一个。`Cmd/Ctrl + Alt + K` 按编辑器的文件和选区插入 `@path`、`@path#L10` 或 `@path#L10-20`。

**读标签。** 标题 = 你起的名字（`F2`）› 打开它的快捷命令 › 智能体自己的标题（已清理）› 你的最后一条提示词（40 字符，按词截断）› 智能体名。标记：`⟳` 工作中 · `?` 等你 · `●` 隐藏时已完成。

**点击智能体打印的内容。** `Cmd/Ctrl + click` 打开文件（到 `行:列`）、文件夹和 URL；`Shift + Cmd/Ctrl + click` 用默认应用打开；悬停显示目标。右键提供 *Open File / Open Folder / Open Link*、*Open with Default App*、*Insert @path into CLI*、*Copy Link / Path*、*Find Selection*，以及 *Copy / Paste / Select All / Find in Terminal*。

**保住会话。** *Reload Window* 保留一切。*Restart Session*（↻）重启回同一会话——按钩子上报的会话 ID，否则按智能体自己存储中该目录的最新会话，再否则用智能体的 `--continue`。*Resume Session* 列出历史会话（Claude Code、Codex、Grok），其余智能体提供 *Continue latest session*。MCP/插件/钩子文件变化时，空闲标签自动重启，忙碌标签显示 *"… changed — restart to apply"* 直到你按 ↻。*Restart All Sessions* 重启所有标签。

**快捷命令。** 把提示词存进 `cliCode.quickCommands`（User 或 Workspace 设置），或选中文本后运行 *Save as Quick Command*；从操作栏的 `…` 菜单运行。它们作为一次粘贴送达，随后 Enter，除非 `"submit": false`。

## 快捷键、命令、设置

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| 打开 / 聚焦智能体 | `Cmd + Esc` | `Ctrl + Esc` |
| 在新标签中打开智能体 | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 以 `@path` 插入当前文件 | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| 提示词内换行 | `Shift + Enter` | `Shift + Enter` |
| 终端内查找 | `Cmd + F` | `Ctrl + F` \* |
| 放大 / 缩小 / 重置 | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| 重命名标签 | `F2` | `F2` |

\* Windows/Linux 上终端把 `Ctrl + F` 留给智能体——请用命令面板或右键菜单。终端快捷键只在 CLI Code 标签内生效。

命令面板（`CLI Code:`）：New Session · Resume Session · Restart Session · Restart All Sessions · Quick Command · Save as Quick Command · Rename Tab · Find in Terminal · Copy Context · Copy · Paste · Select All · Zoom In / Out / Reset · Install Status Hooks · Remove Status Hooks——外加 *Open CLI*、*Open CLI in new tab* 和 *CLI: Insert At-Mentioned*。

| 设置 | 默认 | 含义 |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | 在 `PATH` 上的所有受支持智能体中保持状态钩子；`false` 则全部移除。 |
| `cliCode.notifications` | `true` | 你没在看的标签上智能体完成或开始等待时通知。 |
| `cliCode.quickCommands` | `[]` | `{ "label", "text", "submit"? }` 条目；User 设置 = 全局，Workspace 设置 = 项目。 |
| `cliCode.composer` | `false` | 终端下方的聊天式输入框（实验性；对新标签生效）。 |

## CLI Code 会触碰什么

- **写入**：每个智能体自身配置中的状态钩子（`~/.claude/settings.json`、`~/.factory/settings.json`、`~/.codex/hooks.json` + `config.toml` 中的信任条目、`~/.copilot/hooks/cli-code.json`、`~/.grok/hooks/cli-code.json`、为 opencode/Kilo/MiMo 生成的 `cli-code-status.ts` 插件和为 Pi/OMP 生成的扩展），每个文件备份一次为 `<file>.cli-code.bak`。你自己的钩子保持不变；`cliCode.statusHooks: false` 移除全部。
- **读取**：智能体的会话存储（查找会话 ID、标题、模型），以及 MCP/插件/钩子文件的修改时间（发现过期标签）。
- **无自身网络**；没有数据通过 CLI Code 离开你的机器。

## 限制

- 关闭标签会结束其中的智能体（VS Code 无法先询问）；退出 VS Code 会结束所有会话。Reload Window 不会。
- 状态钩子和交互式 shell 启动仅限 POSIX（macOS、Linux）。Windows 上标签可用但无状态标记。
- 九个智能体没有可寻址的会话，用它们的 `--continue` 标志重启（见表）。

## FAQ

**智能体让我登录。** 正常——CLI Code 只负责启动。在任意终端登录一次即可。

**按 `Cmd + Alt + K` 没反应。** 编辑器里必须打开着文件，且有一个智能体标签处于聚焦状态。

**快捷键与其他扩展冲突。** 在 *Preferences → Keyboard Shortcuts* 中搜索 "CLI Code" 重新绑定。

**还能用 VS Code 自己的终端吗？** 能——CLI Code 只管理它自己打开的标签。

## 开发

- `bun test` —— 单元测试。
- `bun run test:integration` —— 真实的 VS Code Extension Host（一次性下载到 `.vscode-test/`）：打开/输入/关闭、gone/重启、钩子 → 状态、恢复与快捷命令、两阶段重载。macOS/Linux；绝不写入你真实的钩子文件——运行器会为它们做快照，若有变化即失败。
- `node test/e2e/status-hooks.mjs [agent…]` —— 针对本机已安装智能体的端到端测试（每个一次模型调用）。
- `bun run package:target <platform>` —— 单一平台的 VSIX；`bun run package:all` 生成全部六个。

智能体图标来自 [Orca](https://github.com/stablyai/orca)。

## 许可证

[MIT](LICENSE) © 2026 Thanh Luan
