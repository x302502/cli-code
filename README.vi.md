# CLI Code

[English](README.md) · **Tiếng Việt** · [中文](README.zh.md) · [日本語](README.ja.md)

> Khởi chạy và chuyển đổi giữa các AI coding CLI — Claude Code, Codex, Gemini, opencode, và nhiều hơn nữa — ngay trong terminal bên cạnh VS Code, và gửi thẳng file bạn đang xem vào agent đang chạy.

## Vì sao dùng CLI Code?

Nếu bạn dùng các AI coding agent chạy trên terminal, hẳn bạn phải xoay xở với nhiều cái cùng lúc. CLI Code cho bạn **một phím tắt** để chọn bất kỳ agent nào, mở nó trong terminal bên cạnh editor, và đẩy **file đang mở (kèm dòng đang chọn)** vào prompt của agent mà không cần copy-paste.

## Tính năng

- 🚀 **Khởi chạy một phím** — nhấn phím tắt, chọn CLI, nó mở trong terminal cạnh code của bạn.
- 🔁 **Tái sử dụng hoặc tab mới** — focus vào CLI đang chạy, hoặc luôn mở mới.
- 📎 **Gửi file đang mở** — chèn `@path/to/file.ts#L10-20` (kèm vùng chọn) vào CLI đang focus.
- 🌐 **CLI có HTTP API** — với agent có API cục bộ (vd opencode), file được gửi qua cổng thay vì gõ text.
- 🐝 **11 CLI có sẵn** — thêm CLI của riêng bạn chỉ với vài dòng config.

## Các CLI được hỗ trợ

| #   | CLI                | Lệnh                               |
| --- | ------------------ | ---------------------------------- |
| 1   | Claude Code        | `claude`                           |
| 2   | Codex CLI          | `codex`                            |
| 3   | Mimo               | `mimo`                             |
| 4   | opencode           | `opencode --port {port}` (có HTTP) |
| 5   | Gemini CLI         | `gemini`                           |
| 6   | GitHub Copilot CLI | `copilot`                          |
| 7   | Amp                | `amp`                              |
| 8   | Droid              | `droid`                            |
| 9   | Kiro CLI           | `kiro-cli`                         |
| 10  | Antigravity        | `agy`                              |
| 11  | CommandCode        | `commandcode`                      |

> Mỗi CLI phải được cài đặt và có trong `PATH` của bạn. CLI Code chỉ khởi chạy lệnh — nó **không** cài đặt các agent thay bạn.

## Cài đặt

**Từ Marketplace** — tìm **"CLI Code"** trong tab Extensions (`Cmd/Ctrl + Shift + X`), hoặc:

```bash
code --install-extension x302502.cli-code
```

**Từ file `.vsix`:**

```bash
code --install-extension cli-code-0.1.0.vsix
```

## Cách dùng

### 1. Mở một CLI

| Thao tác                                  | macOS               | Windows / Linux      |
| ----------------------------------------- | ------------------- | -------------------- |
| Mở bảng chọn CLI (tái dùng nếu đang chạy) | `Cmd + Esc`         | `Ctrl + Esc`         |
| Mở CLI trong terminal **mới**             | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Chèn file đang mở vào CLI đang focus      | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

Một Quick Pick liệt kê tất cả CLI đã cấu hình. Chọn một cái và nó mở trong terminal **bên cạnh** editor, chạy lệnh tương ứng. Nếu bạn dùng phím tái sử dụng và CLI đó đang mở, CLI Code chỉ focus vào terminal của nó.

### 2. Gửi file bạn đang làm việc

Đặt con trỏ trong một file (tùy chọn bôi đen vài dòng), focus vào terminal CLI, rồi nhấn `Cmd/Ctrl + Alt + K`. CLI Code chèn một tham chiếu như:

- `@src/app.ts` — toàn bộ file
- `@src/app.ts#L10` — một dòng
- `@src/app.ts#L10-20` — một khoảng dòng

Với CLI **có HTTP API** (hiện tại là opencode), tham chiếu được gửi qua HTTP API cục bộ của agent; còn lại thì được gõ vào terminal.

> Các lệnh cũng có trong Command Palette (`Cmd/Ctrl + Shift + P`): **Open CLI**, **Open CLI in new tab**, **CLI: Insert At-Mentioned**.

## Thêm CLI của riêng bạn

CLI Code điều khiển bằng cấu hình. Mở [`src/lib/config.ts`](src/lib/config.ts) và thêm một mục vào `CLI_TOOLS`:

```ts
{
  id: "my-agent",            // id duy nhất (cũng là tên terminal)
  label: "My Agent",         // hiển thị trong bảng chọn
  description: "My coding agent CLI",
  command: "my-agent",       // lệnh shell; dùng "{port}" cho CLI có HTTP
  hasHttpApi: false,
}
```

Với CLI có HTTP API, thêm các trường API:

```ts
{
  id: "opencode",
  label: "opencode",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_EXTENSION_OPENCODE_PORT", // biến env mà CLI đọc để lấy cổng
  appendPromptPath: "/tui/append-prompt", // endpoint nhận tham chiếu file
  readyCheckPath: "/app",                 // endpoint được poll cho tới khi server sẵn sàng
  extraEnv: { OPENCODE_CALLER: "vscode" },
}
```

Thứ tự các mục chính là thứ tự hiển thị trong bảng chọn.

## Phát triển

Dự án này dùng [Bun](https://bun.sh).

```bash
bun install          # cài dependencies
bun run compile      # type-check + lint + build vào dist/
bun run watch:esbuild # build lại khi có thay đổi
bun test             # chạy unit test
bun run vsix         # đóng gói .vsix
```

Nhấn `F5` trong VS Code để mở **Extension Development Host** với extension đã nạp.

### Cấu trúc dự án

```
src/
├── extension.ts        # vỏ activation (đăng ký command)
└── lib/
    ├── config.ts       # type CliTool + registry CLI_TOOLS
    ├── commands.ts     # các command handler
    ├── terminal.ts     # tạo terminal, chọn tool, cổng
    ├── http-client.ts  # gọi HTTP cho CLI có API
    └── editor.ts       # helper tham chiếu file đang mở
```

## Yêu cầu

- VS Code `^1.94.0`
- Các CLI agent bạn muốn dùng, đã cài và có trong `PATH`.

## Giấy phép

[MIT](LICENSE) © 2026 Thanh Luan
