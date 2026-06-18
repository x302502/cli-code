# Multi-CLI Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến extension `cli-code` thành launcher mở nhiều loại CLI coding agent qua Quick Pick menu, giữ tính năng chèn `@filepath` (HTTP port hoặc sendText).

**Architecture:** Một file `src/extension.ts` chứa registry `CLI_TOOLS` (built-in) ở đầu file và ba command (`open`, `openNew`, `addFilepath`). Quick Pick cho user chọn CLI; terminal đặt tên theo `tool.id` để phân biệt nhiều CLI; chèn filepath tra ngược CLI theo tên terminal.

**Tech Stack:** TypeScript, `vscode` API, esbuild, global `fetch`. Không thêm dependency.

**Testing note:** Extension VS Code không có unit test tự động khả thi trong môi trường này (cần electron host). Verification mỗi task = `node esbuild.js` (build) + `npx tsc --noEmit` (typecheck) pass, cộng manual test cuối cùng qua F5. Đây là giới hạn của môi trường extension, đã chốt trong spec.

**Working dir:** `/Volumes/Data/itsme/study/ai/best-clone-project/cli-code`

---

### Task 1: Định nghĩa type và registry CLI_TOOLS

**Files:**
- Modify: `src/extension.ts` (thêm vào đầu file, sau import)

- [ ] **Step 1: Thêm type `CliTool` và mảng `CLI_TOOLS` ngay sau dòng `import * as vscode`**

Thay khối:

```ts
import * as vscode from "vscode"

const TERMINAL_NAME = "cli-code"
```

thành:

```ts
import * as vscode from "vscode"

type CliTool = {
  id: string
  label: string
  description?: string
  command: string
  hasHttpApi: boolean
  portEnvVar?: string
  appendPromptPath?: string
  readyCheckPath?: string
}

const CLI_TOOLS: CliTool[] = [
  {
    id: "claude",
    label: "Claude Code",
    description: "Anthropic Claude Code CLI",
    command: "claude",
    hasHttpApi: false,
  },
  {
    id: "opencode",
    label: "opencode",
    description: "opencode TUI (HTTP-aware)",
    command: "opencode --port {port}",
    hasHttpApi: true,
    portEnvVar: "_EXTENSION_OPENCODE_PORT",
    appendPromptPath: "/tui/append-prompt",
    readyCheckPath: "/app",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    description: "Google Gemini CLI",
    command: "gemini",
    hasHttpApi: false,
  },
  {
    id: "aider",
    label: "Aider",
    description: "Aider pair-programming CLI",
    command: "aider",
    hasHttpApi: false,
  },
]
```

- [ ] **Step 2: Typecheck (sẽ còn lỗi do `TERMINAL_NAME` đã bị xóa — đó là dự kiến, sẽ sửa ở Task 2)**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && npx tsc --noEmit`
Expected: lỗi `Cannot find name 'TERMINAL_NAME'` ở các chỗ dùng nó. KHÔNG commit ở đây — file chưa nhất quán. Sang Task 2 viết lại phần `activate`.

---

### Task 2: Viết lại `activate` — command `open` và `openNew` với Quick Pick

**Files:**
- Modify: `src/extension.ts` (khối `activate` từ `registerCommand("cli-code.openNewTerminal"...)` tới hết phần đăng ký command)

- [ ] **Step 1: Thay toàn bộ khối ba `registerCommand` + `context.subscriptions.push` hiện tại**

Thay từ dòng `const openNewTerminalDisposable = ...` tới hết `context.subscriptions.push(...)` (khối đăng ký 3 command cũ) bằng:

```ts
  const openDisposable = vscode.commands.registerCommand("cli-code.open", async () => {
    const tool = await pickTool()
    if (!tool) return

    const existing = vscode.window.terminals.find((t) => t.name === tool.id)
    if (existing) {
      existing.show()
      return
    }

    await openTerminal(tool)
  })

  const openNewDisposable = vscode.commands.registerCommand("cli-code.openNew", async () => {
    const tool = await pickTool()
    if (!tool) return
    await openTerminal(tool)
  })

  const addFilepathDisposable = vscode.commands.registerCommand("cli-code.addFilepath", async () => {
    const fileRef = getActiveFile()
    if (!fileRef) return

    const terminal = vscode.window.activeTerminal
    if (!terminal) return

    const tool = CLI_TOOLS.find((t) => t.id === terminal.name)
    if (!tool) return

    if (tool.hasHttpApi && tool.portEnvVar && tool.appendPromptPath) {
      // @ts-ignore
      const port = terminal.creationOptions.env?.[tool.portEnvVar]
      if (port) {
        await appendPrompt(parseInt(port), tool.appendPromptPath, fileRef)
        terminal.show()
        return
      }
    }

    terminal.sendText(fileRef, false)
    terminal.show()
  })

  context.subscriptions.push(openDisposable, openNewDisposable, addFilepathDisposable)

  async function pickTool() {
    const picked = await vscode.window.showQuickPick(
      CLI_TOOLS.map((t) => ({ label: t.label, description: t.description, id: t.id })),
      { placeHolder: "Select a CLI to open" },
    )
    if (!picked) return
    return CLI_TOOLS.find((t) => t.id === picked.id)
  }
```

- [ ] **Step 2: Typecheck (vẫn còn lỗi do `openTerminal`/`appendPrompt` signature cũ — dự kiến, sửa ở Task 3)**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && npx tsc --noEmit`
Expected: lỗi quanh `openTerminal(tool)` (chưa nhận tham số) và `appendPrompt` (sai số tham số). Không commit, sang Task 3.

---

### Task 3: Viết lại helper `openTerminal` và `appendPrompt`

**Files:**
- Modify: `src/extension.ts` (hàm `openTerminal` và `appendPrompt`)

- [ ] **Step 1: Thay hàm `openTerminal` cũ (nhận 0 tham số) bằng phiên bản nhận `tool`**

```ts
  async function openTerminal(tool: CliTool) {
    const port = tool.hasHttpApi ? Math.floor(Math.random() * (65535 - 16384 + 1)) + 16384 : undefined

    const env: Record<string, string> = { OPENCODE_CALLER: "vscode" }
    if (port && tool.portEnvVar) env[tool.portEnvVar] = port.toString()

    const terminal = vscode.window.createTerminal({
      name: tool.id,
      iconPath: {
        light: vscode.Uri.file(context.asAbsolutePath("images/button-dark.svg")),
        dark: vscode.Uri.file(context.asAbsolutePath("images/button-light.svg")),
      },
      location: {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: false,
      },
      env,
    })

    terminal.show()
    terminal.sendText(port ? tool.command.replace("{port}", port.toString()) : tool.command)

    const fileRef = getActiveFile()
    if (!fileRef) return

    if (!(tool.hasHttpApi && port && tool.readyCheckPath && tool.appendPromptPath)) return

    // Wait for the CLI HTTP server to be ready
    let tries = 10
    let connected = false
    do {
      await new Promise((resolve) => setTimeout(resolve, 200))
      try {
        await fetch(`http://localhost:${port}${tool.readyCheckPath}`)
        connected = true
        break
      } catch {}
      tries--
    } while (tries > 0)

    if (connected) {
      await appendPrompt(port, tool.appendPromptPath, `In ${fileRef}`)
      terminal.show()
    }
  }
```

- [ ] **Step 2: Thay hàm `appendPrompt` cũ bằng phiên bản nhận `path`**

```ts
  async function appendPrompt(port: number, path: string, text: string) {
    await fetch(`http://localhost:${port}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    })
  }
```

- [ ] **Step 3: Typecheck — giờ phải sạch**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && npx tsc --noEmit`
Expected: không lỗi (exit 0, không in gì).

- [ ] **Step 4: Build**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && node esbuild.js`
Expected: in `[watch] build started` / `[watch] build finished`, không có dòng `✘ [ERROR]`.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code
git add src/extension.ts
git commit -m "feat: multi-CLI registry + Quick Pick launcher"
```

---

### Task 4: Cập nhật manifest `package.json` (commands + keybindings + menu)

**Files:**
- Modify: `package.json` (khối `contributes`)

- [ ] **Step 1: Thay khối `commands`**

Thay mảng `"commands"` hiện tại bằng:

```json
    "commands": [
      {
        "command": "cli-code.open",
        "title": "Open CLI",
        "icon": {
          "light": "images/button-dark.svg",
          "dark": "images/button-light.svg"
        }
      },
      {
        "command": "cli-code.openNew",
        "title": "Open CLI in new tab",
        "icon": {
          "light": "images/button-dark.svg",
          "dark": "images/button-light.svg"
        }
      },
      {
        "command": "cli-code.addFilepath",
        "title": "CLI: Insert At-Mentioned"
      }
    ],
```

- [ ] **Step 2: Thay khối `menus` (nút trên editor title dùng command mới)**

```json
    "menus": {
      "editor/title": [
        {
          "command": "cli-code.openNew",
          "group": "navigation"
        }
      ]
    },
```

- [ ] **Step 3: Thay khối `keybindings`**

```json
    "keybindings": [
      {
        "command": "cli-code.open",
        "title": "Open CLI",
        "key": "cmd+escape",
        "mac": "cmd+escape",
        "win": "ctrl+escape",
        "linux": "ctrl+escape"
      },
      {
        "command": "cli-code.openNew",
        "title": "Open CLI in new tab",
        "key": "cmd+shift+escape",
        "mac": "cmd+shift+escape",
        "win": "ctrl+shift+escape",
        "linux": "ctrl+shift+escape"
      },
      {
        "command": "cli-code.addFilepath",
        "title": "CLI: Insert At-Mentioned",
        "key": "cmd+alt+k",
        "mac": "cmd+alt+k",
        "win": "ctrl+alt+K",
        "linux": "ctrl+alt+K"
      }
    ]
```

- [ ] **Step 4: Verify JSON hợp lệ + không còn command id cũ**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('json ok')" && ! grep -nE 'openTerminal|openNewTerminal|addFilepathToTerminal' package.json src/extension.ts && echo "no stale ids"`
Expected: in `json ok` rồi `no stale ids`.

- [ ] **Step 5: Build lại để chắc chắn**

Run: `cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code && node esbuild.js && npx tsc --noEmit`
Expected: build finished, typecheck không lỗi.

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code
git add package.json
git commit -m "feat: generic commands/keybindings for multi-CLI launcher"
```

---

### Task 5: Cập nhật README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Ghi đè README.md mô tả launcher mới**

```markdown
# CLI Code

A VS Code extension that launches coding CLIs (Claude Code, opencode, Gemini CLI, Aider...) in a side terminal, and lets you insert the active file path into the running CLI.

## Usage

- `Cmd/Ctrl + Esc` — open the CLI picker; focuses an existing terminal if that CLI is already running.
- `Cmd/Ctrl + Shift + Esc` — always open the chosen CLI in a new terminal.
- `Cmd/Ctrl + Alt + K` — insert the active file (`@path#L1-5`) into the focused CLI terminal. For HTTP-aware CLIs (opencode) it posts over the local port; otherwise it types the path.

## Adding a CLI

Edit the `CLI_TOOLS` array at the top of `src/extension.ts`. Each entry: `id`, `label`, `command` (`{port}` is substituted when `hasHttpApi`), and optional HTTP fields (`portEnvVar`, `appendPromptPath`, `readyCheckPath`).

## Develop

- `node esbuild.js` — build to `dist/`
- Press `F5` in VS Code to launch an Extension Development Host
- `npm run vsix` — package a `.vsix`
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/Data/itsme/study/ai/best-clone-project/cli-code
git add README.md
git commit -m "docs: README for multi-CLI launcher"
```

---

### Task 6: Manual verification (F5)

**Files:** none (manual)

- [ ] **Step 1: Mở project trong VS Code, bấm F5** → cửa sổ Extension Development Host mở.

- [ ] **Step 2: Trong cửa sổ mới, mở một file bất kỳ, bấm `Cmd+Esc`** → Quick Pick hiện 4 CLI. Chọn `Claude Code` → terminal `claude` mở bên cạnh, chạy lệnh `claude`.

- [ ] **Step 3: Bấm `Cmd+Esc` lại, chọn `Claude Code` lần nữa** → focus terminal cũ, không tạo mới.

- [ ] **Step 4: Bấm `Cmd+Shift+Esc`, chọn `opencode`** → terminal `opencode` mới mở, lệnh có `--port <số>`.

- [ ] **Step 5: Bôi đen vài dòng trong file, terminal CLI đang active, bấm `Cmd+Alt+K`** → chuỗi `@path#L..` xuất hiện (qua HTTP với opencode, hoặc gõ thẳng với claude).

- [ ] **Step 6: Ghi nhận kết quả.** Nếu mọi bước đạt → xong. Nếu lệnh CLI không tồn tại trên máy (vd chưa cài `aider`), terminal sẽ báo command not found — đó là bình thường, không phải lỗi extension.
