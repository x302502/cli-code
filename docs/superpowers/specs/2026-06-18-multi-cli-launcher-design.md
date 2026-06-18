# Multi-CLI Launcher — Design

**Date:** 2026-06-18
**Status:** Approved

## Goal

Mở rộng extension `cli-code` từ chỗ hardcode một CLI (`opencode`) thành một
launcher tổng quát: có sẵn một danh sách (registry) nhiều loại CLI coding agent,
người dùng chọn cái muốn mở qua một Quick Pick menu. Giữ nguyên tính năng chèn
`@filepath` (file + vùng chọn đang active) với cả hai cơ chế HTTP port và
`sendText` như bản gốc.

Nguồn gốc: extension kế thừa từ `sdks/vscode` của MiMo-Code (vốn fork từ
opencode), nay tách thành project độc lập `cli-code`.

## Non-Goals

- Không cho user tự thêm CLI qua `settings.json` ở bản này (dùng registry
  built-in; thêm CLI = sửa mảng `CLI_TOOLS` trong code).
- Không gán phím tắt riêng cho từng CLI (chỉ một phím mở Quick Pick).
- Không quản lý vòng đời tiến trình CLI (chỉ mở terminal và gõ lệnh).

## Data Model — CLI registry

Mỗi CLI được mô tả bởi một object, gom thành mảng `CLI_TOOLS` ở đầu
`src/extension.ts`:

```ts
type CliTool = {
  id: string                 // định danh + tên terminal, vd "claude"
  label: string              // hiển thị trong Quick Pick, vd "Claude Code"
  description?: string        // dòng phụ trong Quick Pick
  command: string            // lệnh chạy; {port} được thay nếu hasHttpApi, vd "opencode --port {port}"
  hasHttpApi: boolean        // true → chèn @filepath qua HTTP; false → sendText
  portEnvVar?: string        // tên env truyền port, vd "_EXTENSION_OPENCODE_PORT"
  appendPromptPath?: string  // endpoint append prompt, vd "/tui/append-prompt"
  readyCheckPath?: string    // endpoint poll để biết CLI sẵn sàng, vd "/app"
}
```

Registry khởi tạo gồm vài CLI phổ biến (ví dụ): `claude`, `opencode`, `gemini`,
`aider`. Chỉ `opencode` bật `hasHttpApi: true` với các path tương ứng; còn lại
dùng `sendText`.

## Components & Flow

Tất cả nằm trong một file `src/extension.ts` (CLI_TOOLS ở đầu file). Ba command
được đăng ký trong `activate`.

### Command `cli-code.open` (Cmd+Esc)

1. `vscode.window.showQuickPick(CLI_TOOLS.map(...))` cho user chọn CLI.
2. User huỷ → return.
3. Nếu đã có terminal tên trùng `tool.id` đang mở → `existing.show()` và return.
4. Ngược lại → gọi `openTerminal(tool)`.

### Command `cli-code.openNew` (Cmd+Shift+Esc)

Giống `open` nhưng bỏ qua bước 3 (luôn tạo terminal mới sau khi chọn từ Quick Pick).

### `openTerminal(tool)`

1. Nếu `tool.hasHttpApi` → random port `16384..65535`, set env `tool.portEnvVar`.
2. Tạo terminal split bên cạnh, name = `tool.id`, env gồm port (nếu có) +
   `OPENCODE_CALLER: "vscode"`.
3. `terminal.sendText(command)` với `{port}` đã thay.
4. Nếu có file đang mở:
   - `hasHttpApi`: poll `http://localhost:{port}{readyCheckPath}` tối đa 10 lần
     (200ms/lần); khi sẵn sàng → `appendPrompt(port, "In {fileRef}")`.
   - không `hasHttpApi`: bỏ qua (file sẽ được chèn thủ công qua Cmd+Alt+K).

### Command `cli-code.addFilepath` (Cmd+Alt+K)

1. `getActiveFile()` → chuỗi `@path` (+ `#L1` hoặc `#L1-5` nếu có selection).
   Không có file/selection hợp lệ → return.
2. Lấy `vscode.window.activeTerminal`. Không có → return.
3. Tra ngược CLI theo `terminal.name === tool.id`.
4. Nếu tool `hasHttpApi` và terminal có env port → POST tới
   `http://localhost:{port}{appendPromptPath}` body `{ text: fileRef }`.
5. Ngược lại → `terminal.sendText(fileRef, false)`.
6. `terminal.show()`.

### Helpers (giữ từ bản gốc)

- `appendPrompt(port, text)`: POST JSON tới endpoint append.
- `getActiveFile()`: dựng chuỗi `@relativePath` + line range từ editor active.

## Manifest (`package.json` contributes)

Ba command + ba keybinding generic:

| command | title | key |
|---|---|---|
| `cli-code.open` | Open CLI | Cmd+Esc |
| `cli-code.openNew` | Open CLI in new tab | Cmd+Shift+Esc |
| `cli-code.addFilepath` | CLI: Insert At-Mentioned | Cmd+Alt+K |

`editor/title` menu giữ nút `cli-code.openNew`.

## Error Handling

- Không file đang mở → bỏ qua chèn (early return).
- HTTP poll/POST fail → nuốt lỗi (try/catch quanh fetch), fallback sang sendText
  ở `addFilepath`.
- User huỷ Quick Pick → no-op.

## Testing

- Build: `node esbuild.js` phải pass.
- Typecheck: `tsc --noEmit` phải pass.
- Manual (F5 → Extension Development Host):
  - Cmd+Esc hiện menu, chọn CLI → terminal mở đúng lệnh.
  - Chọn lại CLI đã mở → focus terminal cũ (với `open`).
  - Cmd+Shift+Esc luôn mở terminal mới.
  - Cmd+Alt+K trong terminal CLI → chèn `@path` (HTTP với opencode, sendText với
    cái khác).

## Build / Tooling

Giữ nguyên `esbuild.js`, `tsconfig.json`, `eslint.config.mjs`. Không thêm
dependency mới (chỉ dùng `vscode` API + global `fetch`).
