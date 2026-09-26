# CLI Code

[English](README.md) · **Tiếng Việt** · [中文](README.zh.md) · [日本語](README.ja.md)

📖 [Hướng dẫn sử dụng](docs/user-guide.vi.md) · [User Guide (English)](docs/user-guide.md) · [Changelog](CHANGELOG.md)

> **Terminal dành cho agent, ngay trong VS Code.** Claude Code, Codex, Copilot, opencode, Pi, Grok, Droid và 21 agent lập trình khác, mỗi agent một tab hiểu nó: hiện agent đang làm gì, mở được thứ nó nhắc tới, giữ phiên qua reload, và khởi động lại về đúng hội thoại.

![Nhiều AI CLI chạy song song trong VS Code](images/screenshots/terminals.png)

## Vì sao

Mọi agent lập trình nghiêm túc đều là một chương trình dòng lệnh. Chạy nó trong tab terminal thường thì tab đó "mù": không biết agent đang chờ bạn duyệt, không biết agent vừa sửa file nào, reload là mất, khởi động lại là quên hội thoại.

CLI Code thay tab đó bằng một giao diện sinh ra cho agent — terminal webview riêng với thanh action, trạng thái sống, output bấm được và các thông báo trong khung — còn bản thân agent chạy nguyên vẹn: cùng CLI, cùng shell, cùng MCP server và plugin.

## Bạn có gì

**Tab biết trạng thái agent.** Tab tự đổi tên theo việc bạn giao và mang một dấu: `⟳` đang chạy, `?` đang chờ bạn, `●` đã xong khi bạn ở tab khác. Agent cần bạn ở tab đang ẩn sẽ gửi thông báo kèm nút *Open tab*. Thanh action trên terminal hiện model đang dùng.

**Một giao diện bao quanh agent, không phải terminal trần.** Trên terminal là thanh action lặng theo ngôn ngữ hình ảnh của Claude: New Session (kèm bộ chọn agent), Resume, Restart, Find và menu `…` (Rename, Copy Context, Quick Command). Bên trái hiện model đang dùng, dòng trạng thái khi agent chờ bạn, và nhắc *"… changed — restart to apply"* khi agent đang chạy cũ hơn cấu hình. Rê chuột lên link thấy nó sẽ mở gì; tìm kiếm có phân biệt hoa thường và regex; khi agent thoát có lớp phủ với nút Restart, khi tiến trình mất có trang *session ended*. Font và màu theo theme VS Code; có thể bật thêm khung nhập kiểu chat dưới terminal.

**Mọi thứ agent in ra đều bấm được.** Đường dẫn file mở trong editor đúng dòng đúng cột, thư mục hiện trong Explorer (hoặc Finder/Explorer nếu ngoài workspace), URL mở trình duyệt, Markdown mở preview. Chỉ đường dẫn thật sự tồn tại mới được gạch chân. Click thường chọn trọn link để `Cmd/Ctrl + C` chép; bôi chọn và chép vẫn hoạt động cả khi Claude Code đang bắt chuột.

**Phiên không mất.** Agent chạy dưới một daemon nền, nên *Reload Window* nối lại mọi tab với đủ scrollback, tên và trạng thái. Khi thật sự cần tiến trình mới — thêm MCP server, cài plugin, cập nhật — *Restart Session* đưa 19 trong 28 agent về đúng hội thoại, và tab có cấu hình vừa đổi tự khởi động lại khi rảnh.

**Một phím tắt, shell thật của bạn.** `Cmd/Ctrl + Esc` mở bất kỳ agent nào trong 28 cạnh editor, trong thư mục dự án, bên trong shell login tương tác của bạn — `PATH`, nvm, pnpm, MCP server, y hệt terminal. `Cmd/Ctrl + Alt + K` thả file bạn đang xem vào prompt dưới dạng `@src/app.ts#L10-20`.

**Và những thứ nhỏ.** Mở lại phiên cũ, lệnh nhanh (từ settings hoặc lưu từ vùng chọn), chép 200 dòng cuối làm ngữ cảnh, tìm trong terminal, zoom theo tab, `Shift + Enter` xuống dòng, menu chuột phải theo ngữ cảnh, icon màu cho từng agent.

Nó biết bằng cách nào: CLI Code cài một *hook trạng thái* nhỏ vào cấu hình của chính agent (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP). Hook chạy một dòng shell không làm gì khi ở ngoài CLI Code, file của bạn được sao lưu trước, và một setting gỡ sạch tất cả. Chi tiết trong [Hướng dẫn sử dụng](docs/user-guide.vi.md#16-hook-trạng-thái-thứ-làm-cho-tab-biết-agent-đang-làm-gì).

## Nó hoạt động thế nào

CLI Code **không** dùng terminal tích hợp của VS Code. Mỗi agent mở trong một **webview panel của riêng extension** — một tab editor vẽ terminal (xterm.js) và bao quanh nó là thanh action, dấu trạng thái, tooltip link, thanh tìm kiếm và các thông báo. Tiến trình agent chạy trong một **daemon nền** thuộc cửa sổ VS Code, vì thế *Reload Window* nối lại thay vì giết nó.

Điều đó có nghĩa gì với bạn:

- Tab hành xử như tab editor: kéo sang cột bất kỳ, chia đôi, ghim, mở nhiều tab cho một agent. Nó không nằm trong panel Terminal.
- Các setting `terminal.*` và phím tắt terminal của VS Code không áp dụng; CLI Code dùng `editor.fontFamily` / `editor.fontSize`, theme màu của bạn, và bộ phím tắt riêng (bên dưới) chỉ có hiệu lực khi tab CLI Code đang focus.
- Agent chạy nguyên vẹn, trong shell login tương tác của bạn, với `PATH`, MCP server và plugin thật.

## Bắt đầu nhanh

1. **Cài** từ Marketplace (`Cmd/Ctrl + Shift + X` → *CLI Code*). VS Code 1.94+, macOS hoặc Linux để có đủ tính năng.
2. **Cài và đăng nhập** các agent bạn dùng, trong terminal thường (`claude`, `codex`, `copilot`, `opencode`…). CLI Code khởi chạy chúng chứ không cài. Lệnh chạy được trong terminal là chạy được ở đây.
3. **Bấm `Cmd/Ctrl + Esc`**, chọn agent, gõ. Trong editor bấm `Cmd/Ctrl + Alt + K` để đưa file hiện tại cho agent.

> ⚠️ Agent được khởi chạy với chế độ **tắt hỏi quyền** (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`, `copilot --yolo`, …) để làm việc không bị ngắt. Chúng sẽ sửa file và chạy lệnh mà không hỏi — chỉ dùng CLI Code trên repository bạn tin, hoặc mở agent từ terminal thường khi muốn có lại hộp thoại xác nhận.

## Agent được hỗ trợ

| Agent | Lệnh | Trạng thái trên tab | Restart → đúng hội thoại | Hiện model |
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

*Trạng thái trên tab* cần hook trạng thái, hiện có cho 11 agent đầu. *Restart → đúng hội thoại* ✓ = mở lại đúng phiên; `--continue` = dùng cờ "phiên gần nhất" của chính agent. *Hiện model*: thanh action đọc được model từ file phiên của agent. Bộ chọn xếp agent có trên `PATH` lên đầu.

## Dùng hằng ngày

**Mở và đưa file.** `Cmd/Ctrl + Esc` mở hoặc focus một agent; `Cmd/Ctrl + Shift + Esc` mở thêm tab của nó; nút *New Session* mở tab trong thư mục của tab hiện tại. `Cmd/Ctrl + Alt + K` chèn `@path`, `@path#L10` hoặc `@path#L10-20` theo file và vùng chọn trong editor.

**Đọc tab.** Tên = tên bạn đặt (`F2`) › lệnh nhanh đã mở tab › tiêu đề của chính agent, đã làm sạch › prompt cuối của bạn (40 ký tự, cắt ở ranh giới từ) › tên agent. Dấu: `⟳` đang chạy · `?` chờ bạn · `●` xong khi tab ẩn.

**Bấm vào thứ agent in ra.** `Cmd/Ctrl + click` mở file (đúng `dòng:cột`), thư mục và URL; `Shift + Cmd/Ctrl + click` mở bằng app mặc định; rê chuột thấy đích. Chuột phải có *Open File / Open Folder / Open Link*, *Open with Default App*, *Insert @path into CLI*, *Copy Link / Path*, *Find Selection*, cùng *Copy / Paste / Select All / Find in Terminal*.

**Giữ hội thoại.** *Reload Window* giữ tất cả. *Restart Session* (↻) chạy lại trong cùng hội thoại — theo session id hook báo, nếu không thì phiên mới nhất trong kho của agent cho thư mục này, nếu không nữa thì `--continue` của agent. *Resume Session* liệt kê phiên cũ (Claude Code, Codex, Grok) và có *Continue latest session* cho các agent còn lại. Khi file MCP/plugin/hook đổi, tab rảnh tự khởi động lại; tab bận hiện *"… changed — restart to apply"* cho tới khi bạn bấm ↻. *Restart All Sessions* làm cho mọi tab.

**Lệnh nhanh.** Lưu prompt trong `cliCode.quickCommands` (User hoặc Workspace settings) hoặc bôi chọn rồi chạy *Save as Quick Command*; chạy từ menu `…` trên thanh action. Chúng được dán thành một khối rồi Enter, trừ khi `"submit": false`.

## Phím tắt, lệnh, cài đặt

| Việc | macOS | Windows / Linux |
| --- | --- | --- |
| Mở / focus agent | `Cmd + Esc` | `Ctrl + Esc` |
| Mở agent trong tab mới | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Chèn file hiện tại dạng `@path` | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| Xuống dòng trong prompt | `Shift + Enter` | `Shift + Enter` |
| Tìm trong terminal | `Cmd + F` | `Ctrl + F` \* |
| Zoom to / nhỏ / mặc định | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| Đổi tên tab | `F2` | `F2` |

\* Trên Windows/Linux terminal giữ `Ctrl + F` cho agent — dùng palette hoặc menu chuột phải. Phím tắt terminal chỉ có hiệu lực trong tab CLI Code.

Command Palette (`CLI Code:`): New Session · Resume Session · Restart Session · Restart All Sessions · Quick Command · Save as Quick Command · Rename Tab · Find in Terminal · Copy Context · Copy · Paste · Select All · Zoom In / Out / Reset · Install Status Hooks · Remove Status Hooks — cộng *Open CLI*, *Open CLI in new tab* và *CLI: Insert At-Mentioned*.

| Setting | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | Giữ hook trạng thái trong mọi agent được hỗ trợ có trên `PATH`; `false` gỡ hết. |
| `cliCode.notifications` | `true` | Thông báo khi agent xong hoặc bắt đầu chờ ở tab bạn không nhìn. |
| `cliCode.quickCommands` | `[]` | Các mục `{ "label", "text", "submit"? }`; User settings = toàn cục, Workspace settings = dự án. |
| `cliCode.composer` | `false` | Khung nhập kiểu chat dưới terminal (thử nghiệm; áp dụng cho tab mới). |

## CLI Code đụng vào gì

- **Ghi** hook trạng thái vào cấu hình của chính agent (`~/.claude/settings.json`, `~/.factory/settings.json`, `~/.codex/hooks.json` + mục trust trong `config.toml`, `~/.copilot/hooks/cli-code.json`, `~/.grok/hooks/cli-code.json`, plugin `cli-code-status.ts` sinh tự động cho opencode/Kilo/MiMo và extension cho Pi/OMP), sao lưu mỗi file một lần thành `<file>.cli-code.bak`. Hook của bạn giữ nguyên; `cliCode.statusHooks: false` gỡ sạch.
- **Đọc** kho phiên của agent để tìm session id, tên phiên, model, và thời gian sửa file MCP/plugin/hook để phát hiện tab cũ.
- **Không có mạng** riêng; không dữ liệu nào rời máy bạn qua CLI Code.

## Giới hạn

- Đóng tab là kết thúc agent trong tab (VS Code không cho hỏi trước); thoát VS Code là kết thúc mọi phiên. Reload Window thì không.
- Hook trạng thái và shell tương tác chỉ có trên POSIX (macOS, Linux). Trên Windows tab vẫn chạy nhưng không có dấu trạng thái.
- Chín agent không có phiên định danh được nên khởi động lại bằng cờ `--continue` (xem bảng).

## Hỏi đáp

**Agent bắt tôi đăng nhập.** Đúng — CLI Code chỉ khởi chạy nó. Đăng nhập một lần trong bất kỳ terminal nào.

**Bấm `Cmd + Alt + K` không thấy gì.** Cần có file đang mở trong editor và một tab agent đang focus.

**Phím tắt đụng extension khác.** Đổi trong *Preferences → Keyboard Shortcuts* (tìm "CLI Code").

**Vẫn dùng terminal của VS Code được chứ?** Được — CLI Code chỉ quản lý tab do nó mở.

## Phát triển

- `bun test` — unit test.
- `bun run test:integration` — Extension Host VS Code thật (tải một lần vào `.vscode-test/`): mở/gõ/đóng, gone/restart, hook → trạng thái, resume và lệnh nhanh, reload hai giai đoạn. macOS/Linux; không bao giờ ghi file hook thật — runner chụp snapshot và fail nếu file đổi.
- `node test/e2e/status-hooks.mjs [agent…]` — đầu-cuối với agent cài trên máy (mỗi agent một lượt gọi model).
- `bun run package:target <platform>` — VSIX cho một nền tảng; `bun run package:all` cho cả sáu.

Icon agent lấy từ [Orca](https://github.com/stablyai/orca).

## Giấy phép

[MIT](LICENSE) © 2026 Thanh Luan
