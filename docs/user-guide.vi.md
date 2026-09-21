# CLI Code — Hướng dẫn sử dụng (0.2.0)

CLI Code chạy các trợ lý lập trình AI — Claude Code, Codex, Copilot, opencode, Pi và 23 công cụ
khác — ngay trong VS Code, mỗi trợ lý một tab terminal riêng: tab biết agent đang làm gì và có thể
đưa bạn về đúng hội thoại cũ sau khi khởi động lại.

Tài liệu này mô tả đầy đủ mọi tính năng. Bản tóm tắt: [README.vi.md](../README.vi.md); thay đổi theo
phiên bản: [CHANGELOG.md](../CHANGELOG.md). Bản tiếng Anh: [user-guide.md](user-guide.md).

**Mục lục**

1. [Yêu cầu và cài đặt](#1-yêu-cầu-và-cài-đặt)
2. [Các trợ lý được hỗ trợ](#2-các-trợ-lý-được-hỗ-trợ)
3. [Mở một trợ lý](#3-mở-một-trợ-lý)
4. [Tab terminal](#4-tab-terminal)
5. [Thao tác trong terminal](#5-thao-tác-trong-terminal)
6. [Link và chuột](#6-link-và-chuột)
7. [Menu chuột phải](#7-menu-chuột-phải)
8. [Phiên: reload, restart, resume](#8-phiên-reload-restart-resume)
9. [Hook trạng thái](#9-hook-trạng-thái)
10. [Lệnh nhanh](#10-lệnh-nhanh)
11. [Cài đặt](#11-cài-đặt)
12. [Danh sách lệnh](#12-danh-sách-lệnh)
13. [Phím tắt](#13-phím-tắt)
14. [CLI Code đụng vào gì trên máy bạn](#14-cli-code-đụng-vào-gì-trên-máy-bạn)
15. [Khắc phục sự cố](#15-khắc-phục-sự-cố)
16. [Hỏi đáp](#16-hỏi-đáp)
17. [Gỡ cài đặt](#17-gỡ-cài-đặt)

---

## 1. Yêu cầu và cài đặt

- **VS Code 1.94 trở lên**.
- **macOS hoặc Linux** để có đủ tính năng. Trên Windows terminal vẫn chạy nhưng không có hook
  trạng thái và không chạy qua shell tương tác (xem [Giới hạn](#windows)).
- Các trợ lý phải được cài và đăng nhập sẵn. CLI Code chỉ khởi chạy chúng. Lệnh nào chạy được
  trong terminal thường thì chạy được ở đây.

**Cài từ Marketplace:** Extensions (`Cmd/Ctrl + Shift + X`) → tìm *CLI Code* → Install. Hoặc cài
file `.vsix` đúng nền tảng: `code --install-extension cli-code-0.2.0-<platform>.vsix`.

**Lần chạy đầu.** Ngay khi kích hoạt, extension tìm các trợ lý có trên `PATH` và cài một *hook trạng
thái* nhỏ vào từng trợ lý tìm thấy (chi tiết ở [§9](#9-hook-trạng-thái)). Ngoài ra không làm gì
cho tới khi bạn mở một trợ lý.

> ⚠️ **Trợ lý được khởi chạy với chế độ bỏ qua xác nhận.** Mỗi CLI chạy kèm cờ bỏ qua của nó
> (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`,
> `copilot --yolo`, …) nên agent sửa file và chạy lệnh **không hỏi trước**. Chỉ dùng CLI Code trên
> repository bạn tin tưởng.

## 2. Các trợ lý được hỗ trợ

| Trợ lý | Lệnh CLI Code chạy | Trạng thái trên tab | Restart → đúng hội thoại | Hiện model |
| --- | --- | :-: | :-: | :-: |
| Claude Code | `claude --dangerously-skip-permissions` | ✓ hook | ✓ (session id từ hook) | ✓ |
| Claude Agent Teams | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude …` | ✓ hook | ✓ | ✓ |
| Codex CLI | `codex --dangerously-bypass-approvals-and-sandbox` | ✓ hook | ✓ | ✓ |
| GitHub Copilot CLI | `copilot --yolo` | ✓ hook | ✓ | ✓ |
| Droid (Factory) | `droid` | ✓ hook | ✓ | ✓ |
| Grok | `grok --permission-mode bypassPermissions` | ✓ hook | ✓ | ✓ |
| opencode | `opencode --port <port> --auto` | ✓ plugin | ✓ | ✓ |
| Kilocode | `kilo` | ✓ plugin | ✓ | ✓ |
| MiMo Code | `mimo` | ✓ plugin | ✓ | ✓ |
| Pi | `pi` | ✓ extension | ✓ | ✓ |
| OMP | `omp` | ✓ extension | ✓ | ✓ |
| Command Code | `command-code --yolo` | — | ✓ (kho phiên) | ✓ |
| Prime Agent | `prime-agent` | — | ✓ | ✓ |
| Cline | `cline --auto-approve true` | — | ✓ | ✓ |
| Kimi | `kimi --yolo` | — | ✓ | — |
| Cursor | `cursor-agent --yolo` | — | ✓ | — |
| Amp | `amp --dangerously-allow-all` | — | ✓ | — |
| Antigravity | `agy --dangerously-skip-permissions` | — | ✓ | — |
| Goose | `GOOSE_MODE=auto goose` | — | ✓ | — |
| Aider | `aider --yes-always` | — | `--restore-chat-history` | — |
| Kiro | `kiro-cli --trust-all-tools` | — | `--continue` | — |
| Charm / Crush | `crush --yolo` | — | `--continue` | — |
| Auggie | `auggie` | — | `--continue` | — |
| Continue | `cn --allow "*"` | — | `--resume` (gần nhất) | — |
| Mistral Vibe | `vibe --agent auto-approve` | — | `--continue` | — |
| Qwen Code | `qwen --approval-mode yolo` | — | `--continue` | — |
| Hermes | `hermes --yolo` | — | `--continue` | — |
| Devin | `devin --permission-mode bypass` | — | `--continue` | — |

- **Trạng thái trên tab**: "hook / plugin / extension" = CLI Code cài hook trạng thái vào CLI đó
  ([§9](#9-hook-trạng-thái)), tab hiện đúng *đang chạy / đang chờ / xong*. "—" = chưa có hook cho
  CLI đó: tab chỉ hiện tiêu đề, không có trạng thái.
- **Restart → đúng hội thoại**: ✓ = Restart Session mở lại đúng phiên ([§8.2](#82-restart-session));
  `--continue` = dùng cờ "tiếp tục phiên gần nhất" của chính CLI, không phải CLI nào cũng giới hạn
  theo thư mục.
- **Hiện model**: thanh action hiện model CLI đang dùng, đọc từ file phiên của chính CLI.

Bộ chọn liệt kê trợ lý có trên `PATH` dưới mục **Installed**, còn lại dưới **Not installed**.

## 3. Mở một trợ lý

| Việc | Cách làm |
| --- | --- |
| Mở hoặc focus một trợ lý | `Cmd + Esc` (macOS) / `Ctrl + Esc` → chọn trong danh sách. Nếu trợ lý đó đã có tab, phím tắt nhảy tới tab đó. |
| Mở thêm tab cùng trợ lý | `Cmd/Ctrl + Shift + Esc`, nút **Open CLI in new tab** trên thanh tiêu đề editor, hoặc **New Session** trên thanh action (mở trong thư mục của tab hiện tại). |
| Gửi file đang mở | Focus terminal, bấm `Cmd + Alt + K` / `Ctrl + Alt + K`. CLI Code gõ `@src/app.ts`, `@src/app.ts#L10` hoặc `@src/app.ts#L10-20` tùy vùng chọn. |
| Mở lại hội thoại cũ | Command Palette → **CLI Code: Resume Session** ([§8.3](#83-resume-session)). |

Trợ lý khởi động trong thư mục đầu tiên của workspace (hoặc thư mục home nếu không có workspace),
bên trong **shell login tương tác** của bạn (`$SHELL -ilc …`): `PATH`, `nvm`, `pnpm`, `pyenv` và
mọi thứ trong `.zshrc` / `.bashrc` giống hệt một tab terminal — MCP server chạy qua `npx` dùng
đúng node.

## 4. Tab terminal

### 4.1 Tiêu đề

Tab hiện, theo thứ tự ưu tiên:

1. tên bạn tự đặt bằng **Rename Tab** (`F2`);
2. nhãn của lệnh nhanh đã mở tab;
3. tiêu đề do CLI tự đặt (Claude Code, Codex, Cline, …) sau khi bỏ glyph trạng thái, spinner và dấu
   nhắc — dạng `<task> | <thư mục>` của Codex vẫn giữ tên thư mục kể cả khi chưa có tóm tắt task;
4. prompt bạn vừa gõ: dòng đầu, bỏ URL, tối đa **40 ký tự**, cắt tại ranh giới từ và thêm `…`;
5. tên trợ lý.

### 4.2 Glyph trạng thái và thông báo

Tiền tố trên tiêu đề tab cho biết trạng thái agent:

| Tiền tố | Ý nghĩa |
| --- | --- |
| `⟳ ` | đang xử lý prompt |
| `? ` | đang chờ bạn — xin quyền hoặc hỏi |
| `● ` | xong (hoặc bắt đầu chờ) khi tab đang ẩn; mất khi bạn nhìn vào tab |
| không | rảnh |

Khi agent xong việc hoặc bắt đầu chờ **ở tab bạn không nhìn**, VS Code hiện thông báo kèm nút
**Open tab** (`cliCode.notifications`). Trạng thái cần hook ([§9](#9-hook-trạng-thái)); CLI chưa có
hook thì không hiện trạng thái.

### 4.3 Thanh action

Một thanh lặng nằm trên terminal, cùng màu nền, icon sát mép phải:

| Icon | Hành động |
| --- | --- |
| 💬+ | **New Session** — chọn CLI, mở thêm tab trong thư mục của tab này |
| 🕘 | **Resume Session** — các phiên cũ của workspace |
| ↻ | **Restart Session** — cùng hội thoại, tiến trình mới ([§8.2](#82-restart-session)) |
| 🔍 | **Find** trong terminal |
| … | **Rename Tab** (`F2`), **Copy Context**, **Quick Command** |

Bên trái thanh hiện:

- **model** CLI đang dùng (`claude-opus-5`, `gpt-5.6-luna`, …) — đọc từ kho phiên của CLI 3 giây
  sau khi mở tab và mỗi 30 giây; ẩn với CLI không ghi model;
- `● Waiting for your confirmation` / `● Blocked — needs your attention` khi agent chờ bạn;
- `● <file> changed — restart to apply` / `● CLI Code was updated — restart to apply` khi CLI đang
  chạy cũ hơn cấu hình của nó ([§8.5](#85-tab-cũ)).

### 4.4 Khi CLI thoát

Nếu tiến trình CLI kết thúc (gõ `/exit`, crash, …), tab hiện lớp phủ *"Process exited (code N)"*
với nút **Restart**. Nếu sau reload tab quay lại nhưng phiên đã mất (đã thoát VS Code, daemon bị
kill), tab hiện *"Session … has ended"* với nút **Restart**. Cả hai đều restart về đúng hội thoại
nếu CLI hỗ trợ.

## 5. Thao tác trong terminal

| Việc | Cách làm |
| --- | --- |
| Xuống dòng trong prompt | `Shift + Enter` (gửi `ESC CR`, quy ước `/terminal-setup` của Claude Code) |
| Dán | `Cmd/Ctrl + V` hoặc chuột phải **Paste**. Văn bản nhiều dòng tới dưới dạng một bracketed paste. Dán trên **100 KB** sẽ hỏi trước. |
| Sao chép | bôi chọn rồi `Cmd/Ctrl + C` hoặc chuột phải **Copy**. CLI ghi clipboard (OSC 52) cũng đi qua clipboard của VS Code (tới 1 MB). |
| Chọn tất cả | chuột phải **Select All** |
| Tìm | `Cmd/Ctrl + F` mở thanh tìm (phân biệt hoa thường `Aa`, biểu thức chính quy `.*`, bộ đếm, Enter / Shift+Enter để nhảy). Trên Windows / Linux terminal đang focus nuốt `Ctrl + F`; dùng palette hoặc menu chuột phải. |
| Zoom chữ | `Cmd/Ctrl + =`, `Cmd/Ctrl + -`, `Cmd/Ctrl + 0` (theo tab) |
| Copy Context | chép 200 dòng cuối của terminal — tiện dán sang trợ lý khác |
| Đổi tên tab | `F2` khi tab đang focus |

Terminal dùng font của editor (`editor.fontFamily` / `editor.fontSize`) và theo theme màu của bạn.

## 6. Link và chuột

### 6.1 Cái gì thành link

- URL (`https://…`) và hyperlink OSC 8 (Claude Code in ra loại này).
- Đường dẫn CLI in ra: `src/x.ts`, `src/x.ts:12:3`, `./dir`, `../lib`, `~/notes.md`, `/abs/path`,
  `file:///…`, tên file quen thuộc không đuôi (`README`, `Makefile`, `Dockerfile`, `LICENSE`,
  `CHANGELOG`, …) và mọi `tên.đuôi`. Đường dẫn **chỉ được gạch chân khi tồn tại** (tính từ thư mục
  hiện tại của CLI, rồi workspace) nên path bị cắt hoặc bịa ra không bao giờ trông như bấm được.
  Đường dẫn có tiếng Việt, CJK đều xử lý đúng.

Rê chuột lên link sẽ thấy click làm gì và đường dẫn đã phân giải.

### 6.2 Bấm

| Thao tác | Trên URL | Trên file | Trên thư mục |
| --- | --- | --- | --- |
| `Cmd/Ctrl + click` | mở trong trình duyệt | mở trong editor đúng dòng/cột (`.md` mở preview, `.html` mở trình duyệt) | trong workspace: hiện trong Explorer; ngoài: mở Finder / Explorer |
| `Shift + Cmd/Ctrl + click` | trình duyệt | mở bằng app mặc định của hệ thống | Finder / Explorer |
| click thường | chọn trọn link để `Cmd/Ctrl + C` chép | như trên | như trên |
| kéo bắt đầu trên link | chọn văn bản, không bao giờ mở link | | |

### 6.3 Bôi chọn khi CLI bắt chuột

TUI toàn màn hình (Claude Code) chuyển terminal sang chế độ theo dõi chuột, bình thường sẽ mất bôi
chọn. CLI Code đảo lại:

- **kéo thường thì bôi chọn**, `Cmd/Ctrl + C` chép được;
- **click thuần vẫn tới CLI**, nên bấm vào ô prompt của Claude sẽ dời con trỏ;
- giữ **`Option`** (macOS) / **`Shift`** (Windows, Linux) khi kéo để gửi thao tác kéo cho CLI (với
  TUI có cơ chế chọn riêng).

## 7. Menu chuột phải

Menu thay đổi theo thứ dưới con trỏ và có vùng chọn hay không:

| Mục | Hiện khi |
| --- | --- |
| **Copy** | có vùng chọn |
| **Paste**, **Select All** | luôn |
| **Open Link**, **Copy Link / Path** | trỏ vào URL |
| **Open File**, **Open with Default App**, **Insert @path into CLI**, **Copy Link / Path** | trỏ vào đường dẫn file |
| **Open Folder**, **Copy Link / Path** | trỏ vào đường dẫn thư mục |
| **Find Selection** | có vùng chọn — mở thanh tìm điền sẵn |
| **Find in Terminal** | luôn |

**Insert @path into CLI** gõ `@<đường dẫn tương đối>` vào prompt mà không gửi — dạng Claude Code,
Codex và đa số trợ lý hiểu để tham chiếu file.

## 8. Phiên: reload, restart, resume

### 8.1 Reload Window giữ phiên

Các CLI chạy dưới một daemon nền thuộc cửa sổ VS Code, không thuộc webview. Sau **Developer: Reload
Window**, mọi tab nối lại đúng CLI đang chạy, giữ nguyên scrollback, tiêu đề, trạng thái. Daemon tự
thoát 60 giây sau khi tab cuối đóng.

**Đóng tab là kết thúc CLI đó** — VS Code không cho extension hỏi trước. **Thoát VS Code là kết
thúc mọi phiên.**

### 8.2 Restart Session

**Restart Session** (↻ trên thanh action, chuột phải, palette) tắt CLI của tab rồi chạy lại **trong
cùng hội thoại**:

1. Nếu hook trạng thái đã báo session id, CLI chạy với cờ resume (`claude --resume <id>`,
   `codex resume <id>`, `opencode --session <id>`, …).
2. Nếu không, CLI Code tìm trong kho phiên của chính CLI phiên mới nhất thuộc thư mục này và tạo
   sau khi mở tab (Command Code, Prime Agent, Cline, Kimi, Cursor, Amp, Antigravity, Goose, và các
   CLI có hook trước khi gửi prompt đầu).
3. Nếu vẫn không, dùng dạng `--continue` của CLI (Aider, Kiro, Crush, Auggie, Continue, Vibe, Qwen,
   Hermes, Devin).
4. Chỉ khi không biết gì mới mở phiên mới.

Tab mở từ **Resume Session** sẽ luôn resume đúng phiên đó ở mọi lần restart. **Restart All
Sessions** (palette) làm việc này cho mọi tab.

### 8.3 Resume Session

Command Palette → **CLI Code: Resume Session** liệt kê phiên cũ của workspace hiện tại cho Claude
Code, Codex, Grok (tiêu đề, trợ lý, ngày) và với mọi trợ lý khác một mục **Continue latest
session** — phiên mới nhất của thư mục này nếu kho phiên của CLI có ghi, nếu không thì
`--continue` của CLI.

### 8.4 New Session

**New Session** (thanh action, palette) mở thêm tab cùng trợ lý trong cùng thư mục — hoặc hiện bộ
chọn CLI nếu không có tab nào đang active.

### 8.5 Tab cũ

CLI chỉ đọc MCP server, plugin, hook **lúc khởi động**. Sửa cấu hình khi tab đang mở thì CLI đang
chạy không thấy — reload cũng không, vì vẫn nối lại tiến trình cũ. Vì thế CLI Code so thời điểm
khởi động của từng tab với file cấu hình của CLI (mức home và mức project: `~/.claude/settings.json`,
`~/.claude.json`, `.mcp.json`, `~/.codex/config.toml`, `~/.codex/hooks.json`,
`~/.copilot/mcp-config.json`, `~/.factory/settings.json`, `~/.grok/config.toml`,
`~/.config/opencode/opencode.json` và `plugins/`, `~/.pi/agent/extensions/`, …):

- sau Reload Window, khi tab hiện ra, sau khi hook được cài/cài lại, và sau khi extension cập nhật;
- tab **rảnh** (không chạy, không chờ, im lặng 5 giây) **tự restart** về đúng hội thoại;
- tab **bận** hiện `● <file> changed — restart to apply` trên thanh action cho tới khi bạn restart.

## 9. Hook trạng thái

### 9.1 Hook làm gì

Hook trạng thái là một mục nhỏ trong cấu hình của chính trợ lý, chạy một lệnh khi bạn gửi prompt,
khi agent dừng và khi agent xin quyền. CLI Code dùng nó để hiện đúng trạng thái tab, bật thông báo
"xong việc" và biết session id mà **Restart Session** cần. Lệnh luôn là cùng một dòng shell:

```sh
[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
```

`CLI_CODE_HOOK` chỉ tồn tại trong tab do CLI Code mở, nên **ngoài CLI Code hook là no-op**. (Grok
dùng dạng tương đương `$(printenv CLI_CODE_HOOK)` vì Grok kiểm tra tham chiếu `$VAR` trước khi
chạy hook.)

### 9.2 Cài ở đâu

Tự cài lúc kích hoạt cho mọi trợ lý có trên `PATH` (`cliCode.statusHooks`, mặc định bật). File bạn
đã có được sao lưu một lần thành `<file>.cli-code.bak`; hook của bạn giữ nguyên, chỉ mục của CLI
Code được thêm/bớt.

| Trợ lý | File | Thêm gì |
| --- | --- | --- |
| Claude Code | `~/.claude/settings.json` | mục `hooks.UserPromptSubmit / Stop / Notification / PermissionRequest` |
| Droid | `~/.factory/settings.json` | `hooks.UserPromptSubmit / Stop / Notification` |
| Codex | `~/.codex/hooks.json` và `~/.codex/config.toml` | mục hook nối sau hook của bạn, cộng các mục trust `[hooks.state."…"]` mà Codex yêu cầu |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` | file riêng |
| Grok | `~/.grok/hooks/cli-code.json` | file riêng |
| opencode / Kilocode / MiMo | `~/.config/opencode/plugins/cli-code-status.ts`, `~/.config/kilo/plugins/…`, `~/.config/mimocode/plugins/…` | plugin sinh tự động, dòng đầu `// @cli-code-managed` |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` | extension sinh tự động, cùng header |

File sinh tự động không bao giờ bị ghi đè nếu thiếu header `@cli-code-managed` (file của bạn trùng
tên vẫn nguyên).

### 9.3 Khi nào có hiệu lực

Từ **lần khởi động tiếp theo** của trợ lý. Tab đang chạy sẵn không hiện trạng thái cho tới khi
restart — CLI Code tự nhận ra và tự restart tab rảnh ([§8.5](#85-tab-cũ)).

### 9.4 Tắt

Đặt `cliCode.statusHooks` = `false`: mọi mục và file sinh ra được gỡ. Lệnh **Install Status Hooks**
/ **Remove Status Hooks** trong palette làm tương tự bằng tay và hiện tóm tắt (*Installed: Codex,
Grok · Removed: …*).

### 9.5 Giới hạn

- Chỉ POSIX: Windows không có `sh` để chạy dòng hook nên không cài gì.
- Dòng hook được shell `eval`: đường dẫn cài VS Code có `"` hoặc `$` sẽ hỏng.
- Grok và Cursor cũng đọc `~/.claude/settings.json` nên có thể báo cùng một sự kiện hai lần; hai báo
  cáo cùng trạng thái, vô hại.

## 10. Lệnh nhanh

Prompt hoặc lệnh shell dùng lại, chạy vào tab đang active:

```jsonc
// settings.json (User = mọi nơi, Workspace = chỉ project này)
"cliCode.quickCommands": [
  { "label": "Run tests", "text": "npm test" },
  { "label": "Summarize PR", "text": "Summarize the changes in this PR", "submit": true },
  { "label": "Draft only", "text": "Explain this file", "submit": false }
]
```

- **Quick Command** (thanh action `…`, palette): chọn một mục; văn bản được dán thành một khối và,
  với `submit` (mặc định `true`), gửi kèm Enter. Mục có icon quả cầu (User) hoặc thư mục (Workspace).
- **Save as Quick Command**: bôi chọn trong terminal, chạy lệnh, đặt tên, chọn lưu User hay
  Workspace.
- Tab mở bằng lệnh nhanh mang tên lệnh đó cho tới khi bạn đổi tên.

## 11. Cài đặt

| Setting | Kiểu | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| `cliCode.statusHooks` | boolean | `true` | Giữ hook trạng thái trong mọi CLI được hỗ trợ có trên `PATH`; `false` gỡ hết. |
| `cliCode.notifications` | boolean | `true` | Thông báo khi agent xong hoặc bắt đầu chờ ở tab bạn không nhìn. |
| `cliCode.quickCommands` | array | `[]` | Các mục `{ label, text, submit? }`; User settings = toàn cục, Workspace settings = project. |
| `cliCode.composer` | boolean | `false` | Khung nhập kiểu chat dưới terminal (thử nghiệm; `Enter` gửi nguyên khối, `Shift+Enter` xuống dòng). Tắt để menu `/` và `@` của CLI vẫn hoạt động. Áp dụng cho tab mở sau khi đổi. |

Terminal cũng theo `editor.fontFamily`, `editor.fontSize` và theme màu.

## 12. Danh sách lệnh

Đều thuộc nhóm `CLI Code:` trong Command Palette trừ khi ghi khác.

| Lệnh | Id | Ghi chú |
| --- | --- | --- |
| Open CLI | `cli-code.open` | bộ chọn; focus tab sẵn có của CLI đó |
| Open CLI in new tab | `cli-code.openNew` | luôn mở tab mới |
| CLI: Insert At-Mentioned | `cli-code.addFilepath` | gõ `@file#Lx-y` theo vùng chọn trong editor |
| New Session | `cli-code.newSession` | thêm tab cùng CLI, cùng thư mục |
| Resume Session | `cli-code.resume` | phiên cũ của workspace |
| Restart Session | `cli-code.restart` | cùng hội thoại |
| Restart All Sessions | `cli-code.restartAllSessions` | mọi tab đang mở |
| Rename Tab | `cli-code.renameTab` | `F2` |
| Find in Terminal | `cli-code.find` | |
| Copy Context | `cli-code.copyContext` | 200 dòng cuối |
| Copy / Paste / Select All | `cli-code.copySelection` / `cli-code.paste` / `cli-code.selectAll` | |
| Zoom In / Zoom Out / Reset Zoom | `cli-code.fontZoomIn` / `fontZoomOut` / `fontZoomReset` | |
| Quick Command / Save as Quick Command | `cli-code.quickCommand` / `cli-code.addQuickCommand` | |
| Install Status Hooks / Remove Status Hooks | `cli-code.installStatusHooks` / `cli-code.removeStatusHooks` | mọi CLI được hỗ trợ |
| Open Link, Open File, Open Folder, Open with Default App, Copy Link / Path, Insert @path into CLI, Find Selection | `cli-code.*At`, `cli-code.findSelection` | chỉ trong menu chuột phải (cần vị trí bấm) |

## 13. Phím tắt

| Việc | macOS | Windows / Linux | Ở đâu |
| --- | --- | --- | --- |
| Mở / focus trợ lý | `Cmd + Esc` | `Ctrl + Esc` | mọi nơi |
| Mở trợ lý trong tab mới | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` | mọi nơi |
| Chèn file hiện tại dạng `@path` | `Cmd + Alt + K` | `Ctrl + Alt + K` | mọi nơi |
| Xuống dòng trong prompt | `Shift + Enter` | `Shift + Enter` | terminal |
| Tìm | `Cmd + F` | `Ctrl + F` \* | terminal |
| Zoom to / nhỏ / mặc định | `Cmd + =` / `Cmd + -` / `Cmd + 0` | `Ctrl + =` / `Ctrl + -` / `Ctrl + 0` | terminal |
| Đổi tên tab | `F2` | `F2` | terminal |
| Sao chép / Dán | `Cmd + C` / `Cmd + V` | chuột phải **Copy** / `Ctrl + V` | terminal |

\* Trên Windows / Linux terminal đang focus gửi `Ctrl + F` cho CLI; dùng palette hoặc menu chuột
phải. Các phím tắt phạm vi terminal chỉ có hiệu lực khi tab CLI Code đang active nên không đụng
phím mặc định của VS Code ở chỗ khác.

## 14. CLI Code đụng vào gì trên máy bạn

**Ghi**

- Mục hook trạng thái và file plugin sinh ra ở [§9.2](#92-cài-ở-đâu), kèm bản sao lưu một lần
  `<file>.cli-code.bak` cạnh mỗi file được sửa.
- Socket và build stamp của daemon trong thư mục tạm (`cli-code-<id>.sock`,
  `cli-code-<id>.sock.build`).
- Bộ nhớ riêng của VS Code: daemon nào thuộc cửa sổ này, phiên bản extension lần trước, và trạng
  thái từng tab để khôi phục sau reload.
- Lệnh nhanh bạn lưu, trong `settings.json` User hoặc Workspace.

**Đọc (không bao giờ sửa)**

- Kho phiên của các trợ lý để tìm session id, tiêu đề, model: `~/.claude/projects`,
  `~/.codex/sessions`, `~/.grok/sessions`, `~/.copilot/session-state` và `session-store.db`,
  `~/.factory/sessions`, `~/.pi/agent/sessions`, `~/.omp/agent/sessions`, `~/.commandcode/projects`,
  `~/.prime/agent/sessions`, `~/.cline/data/sessions`, `~/.kimi/sessions`, `~/.cursor/projects`,
  `~/.local/share/amp/threads`, `~/.local/share/{opencode,mimocode,kilo}/*.db`,
  `~/.local/share/goose/sessions/sessions.db`,
  `~/.gemini/antigravity-cli/cache/last_conversations.json`.
- Các file cấu hình ở [§8.5](#85-tab-cũ) để phát hiện tab cũ (chỉ xem thời gian sửa).

**Mạng:** không có kết nối nào của riêng extension. Các trợ lý nói chuyện với nhà cung cấp của chúng
như bình thường.

## 15. Khắc phục sự cố

**Codex `/mcp` báo server failed, nhưng trong terminal thì chạy.**
Đã sửa ở 0.2.0: CLI chạy trong shell login tương tác. Nếu vẫn thấy, Reload Window — daemon do bản
cũ khởi động sẽ được thay lúc kích hoạt, và tab cũ tự restart khi rảnh.

**Tab không hiện trạng thái đang chạy / đang chờ.**
CLI cần hook trạng thái và phải được khởi động sau khi hook đã cài. Chạy **CLI Code: Install Status
Hooks** (tóm tắt cho biết đã cài gì hoặc lỗi gì), rồi **Restart Session**. Windows không có hook.

**"Session … has ended" sau reload.**
Daemon đã mất (đã thoát VS Code, hoặc tiến trình bị kill). Bấm **Restart** — tab quay về đúng hội
thoại nếu CLI hỗ trợ.

**Restart mở ra hội thoại mới.**
CLI thuộc nhóm chỉ có `--continue` ([§2](#2-các-trợ-lý-được-hỗ-trợ)), hoặc chưa gửi prompt nào nên
chưa có phiên để quay về.

**Có cảnh báo hook bên trong CLI.**
Codex: gõ `/hooks` trong Codex và chấp thuận hook CLI Code nếu mục trust không ghi được. Grok: bảo
đảm `~/.grok/hooks/cli-code.json` là bản 0.2.0 (Remove rồi Install Status Hooks).

**`Ctrl + F` gõ vào CLI (Windows / Linux).**
Đúng thiết kế — terminal giữ phím đó. Dùng palette hoặc menu chuột phải.

**Dán nhiều dòng thì prompt bị gửi luôn.**
Văn bản được gửi thành một bracketed paste; CLI quyết định xử lý. Trợ lý không bật bracketed paste
sẽ coi xuống dòng là Enter.

**Link không được gạch chân.**
Chỉ đường dẫn tồn tại (tính từ thư mục hiện tại của CLI hoặc workspace) mới thành link, và chỉ sau
khi CLI đã báo thư mục cho terminal. Tên không đuôi phải là tên file quen thuộc.

<a id="windows"></a>**Windows.** Terminal, link, menu, phiên vẫn hoạt động; hook trạng thái và
shell tương tác thì không (CLI chạy qua PowerShell), nên tab không có trạng thái đang chạy / đang chờ.

## 16. Hỏi đáp

**Có thay thế terminal riêng của trợ lý không?** Không, nó chạy trợ lý trong một tab tiện hơn.
Mọi thứ làm được trong CLI vẫn làm được ở đây.

**Có gửi dữ liệu đi đâu không?** Không. CLI Code không có server và không gọi mạng.

**Vẫn dùng terminal tích hợp của VS Code được chứ?** Được; CLI Code chỉ quản lý tab do nó mở.

**Sao đóng tab là tắt agent luôn?** VS Code không cho extension chặn việc đóng tab. Dùng Restart
Session để mở lại hội thoại.

**Sao tắt xác nhận quyền?** Để agent làm việc liên tục. Muốn có lại hộp thoại xác nhận thì mở CLI
từ terminal thường.

## 17. Gỡ cài đặt

1. Command Palette → **CLI Code: Remove Status Hooks** (gỡ mọi mục và file sinh ra; bản sao lưu
   `.cli-code.bak` giữ nguyên).
2. Đóng các tab CLI (hoặc thoát VS Code).
3. Gỡ extension trong Extensions view.
