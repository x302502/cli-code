# CLI Code 0.2.0 — tài liệu chuẩn bị release

Tài liệu nội bộ (tiếng Việt) tổng hợp toàn bộ đợt "big update" trên nhánh `feat/custom-terminal`
(118 commit tính từ `main`). Người dùng đọc `CHANGELOG.md` (tiếng Anh, hiện trên Marketplace) và
`README.md` / `README.vi.md` / `README.ja.md` / `README.zh.md`; file này là bản đồ để bạn kiểm tra
lần cuối, viết bài giới thiệu và làm release.

## 1. Tóm tắt một đoạn

Mọi CLI giờ chạy trong **terminal riêng của CLI Code** (xterm.js + daemon PTY tách rời) thay vì
terminal tích hợp của VS Code. Nhờ vậy có được: phiên sống qua Reload Window, tab biết agent đang
làm gì (working / waiting / done + thông báo), link file/URL mở được, chuột hoạt động như Orca, và
**Restart về đúng hội thoại** cho 19 CLI nhờ hook trạng thái cài tự động vào 10 CLI + đọc kho phiên
của từng CLI. Toàn bộ UI chuyển sang tiếng Anh.

## 2. Tính năng theo nhóm

### 2.1 Terminal riêng
| Tính năng | Ghi chú kỹ thuật |
|---|---|
| Webview + xterm.js 5.5 (WebGL), daemon PTY tách rời theo cửa sổ | `src/daemon/*`, `src/webview/main.ts`, `src/lib/panel.ts` |
| Phiên sống qua Reload Window (nối lại đúng session, giữ scrollback, title, trạng thái) | serializer `cliCode.terminal`; daemon giữ headless mirror để snapshot |
| CLI chạy qua **shell login tương tác** `$SHELL -ilc` | PATH đúng như terminal thật; sửa lỗi Codex `/mcp` failed (npx sai) |
| Daemon có **build stamp**; daemon build cũ được thay bằng daemon mới khi cập nhật extension | `<socket>.build` = sha256 `dist/daemon.js`; tab cũ vẫn nối daemon cũ tới khi restart |
| Icon màu từng CLI, title tự động (40 ký tự, cắt ranh giới từ + `…`, bỏ URL) | `src/lib/tab-title.ts`; OSC title được lọc glyph/spinner và đoạn rỗng `… \| folder` (Codex) |
| Trạng thái agent trên tab, chấm chưa đọc, thông báo khi xong ở tab ẩn | `cliCode.notifications` |
| Thanh action trong khung: New Session (chọn CLI) · Resume · Restart · Find · … (Rename `F2`, Copy Context, Quick Command); bên trái: model pill, dòng trạng thái, thông báo "… changed — restart to apply" | `src/webview/action-bar.ts` |
| Exit overlay có Restart; trang "session gone" sau reload khi daemon mất | |
| `Shift+Enter` xuống dòng, tìm kiếm (`Cmd/Ctrl+F`, Aa, regex), zoom `Cmd/Ctrl + = - 0`, OSC 52 clipboard, hỏi trước khi dán lớn, bracketed paste | |
| Composer chat (thử nghiệm, mặc định tắt) | `cliCode.composer` |

### 2.2 Link và chuột
| Tính năng | Ghi chú |
|---|---|
| Link cho path (`src/x.ts:12:3`, `./dir`, `~/notes.md`, `README`, `file://`), URL, OSC 8 | chỉ gạch chân khi path tồn tại (probe qua host, cache 5 s); đúng ô với tiếng Việt NFD / CJK |
| `Cmd/Ctrl+click` mở file đúng dòng/cột (md → preview, html → browser), thư mục trong workspace → Explorer, ngoài → Finder/Explorer; `Shift+Cmd/Ctrl+click` → app mặc định; hover hiện tooltip | `src/lib/path-resolve.ts`, `src/webview/links.ts` |
| Click thường chọn trọn link để `Cmd+C`; kéo từ link không mở link | |
| Kéo chọn được cả khi TUI bắt chuột (Claude fullscreen); click thuần vẫn tới TUI để đặt caret; `Option`/`Shift`+kéo gửi cho TUI | `src/lib/mouse-gesture.ts` |
| Menu chuột phải theo ngữ cảnh: Copy · Paste · Select All · Open Link/File · Open with Default App · Insert @path into CLI · Open Folder · Copy Link/Path · Find Selection · Find in Terminal | `data-vscode-context` |

### 2.3 Phiên đa CLI
| Tính năng | Phủ |
|---|---|
| **Hook trạng thái** tự cài (khi CLI có trên PATH; `cliCode.statusHooks`; backup `.cli-code.bak`; off = gỡ) | Claude Code, Codex (kèm trust entries trong `config.toml`), Copilot, Droid, Grok (`$(printenv …)`), opencode/Kilo/MiMo (plugin TS sinh ra), Pi/OMP (extension TS sinh ra) |
| **Restart Session → đúng hội thoại** | 19 CLI: theo session id hook báo hoặc phiên mới nhất trong kho của CLI cho thư mục này kể từ lúc mở tab; 9 CLI còn lại `--continue` |
| **Resume Session** | danh sách phiên cho Claude/Codex/Grok; "Continue latest session" cho mọi CLI khác, theo thư mục |
| **Model pill** | 13 CLI có ghi model (Claude, Codex, Grok, Copilot, Pi, OMP, Command Code, Prime Agent, Droid, Cline, opencode/MiMo/Kilo) |
| **Tab cũ tự restart** khi config (MCP/plugin/hook) hoặc extension đổi; tab bận chỉ báo; lệnh Restart All Sessions | `src/lib/config-watch.ts` |
| Quick commands (user + workspace), Save as Quick Command, Copy Context, New Session | |

### 2.4 Thay đổi phá vỡ / cần lưu ý khi nâng cấp
- UI tiếng Anh toàn bộ (tên lệnh, menu, setting, toast).
- Setting `cliCode.claudeStatusHooks` (`ask|on|off`) → `cliCode.statusHooks` (boolean, mặc định `true`, áp dụng mọi CLI). Lệnh `Install/Remove Claude Status Hooks` → `Install/Remove Status Hooks`.
- Hook được **cài im lặng** vào config của CLI ngay khi extension kích hoạt (danh sách file ở mục 3). Người dùng tắt bằng setting.
- Đóng tab = kết thúc CLI đó; thoát VS Code = kết thúc mọi phiên.
- Bỏ 7 CLI: OpenClaude, Ante, Trae, Autohand, Codebuff, Rovo Dev, OpenClaw (config + icon còn trong git history, commit `c2d567e`).
- opencode: không còn bơm prompt qua HTTP.

## 3. Extension chạm vào những gì trên máy người dùng

| File | Ai | Khi nào |
|---|---|---|
| `~/.claude/settings.json` → `hooks` | Claude Code | cài hook (append group, giữ hook cũ) |
| `~/.factory/settings.json` → `hooks` | Droid | như trên |
| `~/.codex/hooks.json` + `~/.codex/config.toml` (`[hooks.state.*]`) | Codex | append group cuối + 3 block trust |
| `~/.copilot/hooks/cli-code.json` | Copilot | file riêng |
| `~/.grok/hooks/cli-code.json` | Grok | file riêng |
| `~/.config/{opencode,kilo,mimocode}/plugins/cli-code-status.ts` | opencode/Kilo/MiMo | file sinh, header `// @cli-code-managed` |
| `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` | Pi/OMP | như trên |
| `<file>.cli-code.bak` | tất cả | backup 1 lần trước lần ghi đầu |
| `$TMPDIR/cli-code-<id>.sock`, `.sock.build` | daemon | socket + build stamp |
| Đọc (không ghi): kho phiên của từng CLI để tìm session id / model (`~/.claude/projects`, `~/.codex/sessions`, `~/.grok/sessions`, `~/.copilot/session-store.db`, `~/.gemini/antigravity-cli/cache/last_conversations.json`, …) | | |

Chỉ POSIX: trên Windows không cài hook, không đổi shell.

## 4. Kiểm chứng đã làm

| Tầng | Lệnh | Kết quả 2026-09-21 |
|---|---|---|
| Unit | `bun test` | 240 test / 33 file pass |
| Type + lint + build | `bun run package` | pass |
| Integration (VS Code thật, Extension Host) | `bun run test:integration` | 18 + 2 (reload 2 giai đoạn) pass; runner snapshot mọi file hook để chắc test không đụng file thật. Một test paste đôi khi flake khi máy tải nặng (chạy lại pass). |
| E2E với CLI thật (1 prompt/CLI) | `NODE_PATH=node_modules node test/e2e/status-hooks.mjs [id…]` | claude, codex, droid, grok, opencode, kilo, mimo, pi, omp: hook bắn UserPromptSubmit + Stop + session_id. Copilot chưa test được (tài khoản 403). |
| Codex `/mcp` qua shell `-ilc` | probe thủ công | 7/7 MCP server connected (trước: gitnexus, playwright failed) |
| Harness UI (Playwright) | `scratchpad/linktest` | link, chuột phải, drag/click-through, chuỗi tiếng Anh |

## 5. Còn để sau (không chặn release)

- Resume đúng phiên cho hermes/devin (cần hook riêng như Orca; chưa có binary để kiểm chứng), aider/kiro/crush/aug/continue/vibe/qwen (không có kho phiên dùng được — Orca cũng không).
- Hook trạng thái cho cursor/cline/command-code (chỉ có start/done), antigravity (hook đồng bộ phải trả JSON), amp (plugin bị khóa `PLUGINS=all`).
- Model pill cho cursor/amp (không ghi model), antigravity (protobuf).
- Composer chat (đã park, mặc định tắt).
- Windows: hook + shell tương tác.
- Shift+Enter gửi `ESC CR` (quy ước Claude) cho mọi CLI; Orca gửi kitty `CSI 13;2u` — chưa kiểm chứng với từng CLI.

## 6. Checklist release

1. `git log main..feat/custom-terminal` — merge nhánh vào `main` (hoặc PR).
2. `package.json` version đang là `0.2.0`; `CHANGELOG.md` đã viết đủ; README 4 ngôn ngữ đồng bộ.
3. `bun run package:all` → 6 VSIX (darwin/win32/linux × x64/arm64); CI cũng build (`.github/workflows`).
4. Cài thử VSIX darwin-arm64 (`code --install-extension …`), Reload Window, mở Codex → `/mcp` đủ server, tab hiện trạng thái, Restart về đúng hội thoại.
5. Publish: `npx vsce publish` với PAT (Marketplace → Manage), publisher `x302502`; hoặc upload VSIX tại https://marketplace.visualstudio.com/manage/publishers/x302502.
6. Sau publish: tag `v0.2.0`, ghi vào GitHub Releases nội dung mục "0.2.0" của CHANGELOG.
