# CLI Code

[English](README.md) · **Tiếng Việt** · [中文](README.zh.md) · [日本語](README.ja.md)

📖 Tài liệu đầy đủ: [Hướng dẫn sử dụng](docs/user-guide.vi.md) · [User Guide (English)](docs/user-guide.md) · [Changelog](CHANGELOG.md)

> Chạy Claude Code, Codex, Copilot, opencode, Pi và 23 trợ lý lập trình khác ngay trong VS Code — mỗi trợ lý một tab terminal biết agent đang làm gì, mở được mọi file nó nhắc tới, sống qua reload, và khởi động lại về đúng hội thoại.

![Nhiều AI CLI chạy song song trong VS Code](images/screenshots/terminals.png)

## Nó làm gì?

- **Một phím tắt tới mọi trợ lý.** `Cmd/Ctrl + Esc` → chọn trong 28 CLI → mở ngay cạnh editor, trong thư mục dự án, bằng shell thật của bạn (`PATH`, nvm, MCP server — y như terminal).
- **Gửi file đang xem** bằng `Cmd/Ctrl + Alt + K`: trợ lý nhận `@src/app.ts#L10-20`, không copy-paste.
- **Tab cho biết chuyện gì đang xảy ra.** Tab tự đổi tên theo việc bạn giao, hiện `⟳` đang chạy / `?` đang chờ bạn / `●` đã xong khi bạn ở tab khác, và có thông báo khi agent ở tab ẩn cần bạn.
- **Mọi đường dẫn và link agent in ra đều bấm được.** `Cmd/Ctrl + click` mở file đúng dòng, thư mục trong Explorer, URL trong trình duyệt; click thường chọn trọn link để `Cmd/Ctrl + C`. Bôi chọn và chép vẫn hoạt động khi Claude Code bắt chuột.
- **Reload Window không mất gì.** Phiên chạy dưới daemon nền, nối lại với đủ scrollback, tên tab, trạng thái.
- **Khởi động lại về đúng hội thoại.** Vừa đổi MCP server hay plugin? Restart tab, 19 trợ lý quay về đúng chỗ đang dở — tab rảnh còn tự restart khi config đổi.
- **Mở lại phiên cũ, lệnh nhanh, chép ngữ cảnh, tìm, zoom**, và ô model cho biết trợ lý đang chạy model nào.

Trạng thái, restart theo phiên và ô model đến từ một hook trạng thái nhỏ mà CLI Code cài vào config của từng trợ lý (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP) — có sao lưu, gỡ được, và không làm gì khi chạy ngoài CLI Code. Chi tiết trong [Hướng dẫn sử dụng](docs/user-guide.vi.md).

## Bắt đầu

### 1. Cài đặt

Mở tab **Extensions** trong VS Code (`Cmd/Ctrl + Shift + X`), tìm **CLI Code**, và bấm **Install**.

![CLI Code trên VS Code Marketplace](images/screenshots/marketplace.png)

### 2. Cài các trợ lý bạn muốn dùng

CLI Code chỉ _khởi chạy_ trợ lý — nó không cài chúng. Hãy chắc rằng các trợ lý bạn muốn đã được cài và chạy được từ terminal. Mặc định nó biết các trợ lý sau:

| Trợ lý                                                                                           | Lệnh terminal       |
| ------------------------------------------------------------------------------------------------ | ------------------- |
| [Claude Code](https://code.claude.com/docs/en/setup)                                             | `claude`            |
| [Claude Agent Teams](https://code.claude.com/docs/en/agent-teams)                                | `claude`              |
| [Codex CLI](https://developers.openai.com/codex/cli)                                             | `codex`             |
| [Grok](https://x.ai/cli)                                                                         | `grok`              |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)       | `copilot`           |
| [opencode](https://opencode.ai)                                                                  | `opencode`          |
| [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code)                                             | `mimo`              |
| [Pi](https://pi.dev)                                                                             | `pi`                |
| [OMP](https://omp.sh)                                                                            | `omp`               |
| [Antigravity](https://antigravity.google)                                                        | `agy`               |
| [Amp](https://ampcode.com)                                                                       | `amp`               |
| [Kilocode](https://kilo.ai)                                                                      | `kilo`              |
| [Cline](https://cline.bot)                                                                       | `cline`             |
| [Command Code](https://github.com/just-every/code)                                               | `command-code`      |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart)                                  | `droid`             |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent)                                  | `prime-agent`       |
| [Aider](https://aider.chat/docs/)                                                                | `aider`             |
| [Goose](https://block.github.io/goose/docs/quickstart/)                                          | `goose`             |
| [Kiro](https://kiro.dev)                                                                         | `kiro-cli`          |
| [Charm / Crush](https://github.com/charmbracelet/crush)                                          | `crush`             |
| [Auggie](https://docs.augmentcode.com/cli/overview)                                              | `auggie`            |
| [Continue](https://docs.continue.dev/guides/cli)                                                 | `cn`                |
| [Cursor](https://cursor.com/cli)                                                                 | `cursor-agent`      |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html)                     | `kimi`              |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe)                                        | `vibe`              |
| [Qwen Code](https://github.com/QwenLM/qwen-code)                                                 | `qwen`              |
| [Hermes](https://hermes-agent.nousresearch.com/docs/)                                            | `hermes`            |
| [Devin](https://devin.ai/cli)                                                                    | `devin`             |

> ⚠️ **Cài đặt _và_ đăng nhập trước.** Hầu hết trợ lý cần được xác thực trước
> khi chạy — `claude` (đăng nhập tài khoản Anthropic), `codex` (đăng nhập
> OpenAI / API key), v.v. Hãy chạy từng công cụ
> một lần trong terminal thường, hoàn tất bước đăng nhập, và xác nhận nó khởi
> động được.
>
> 💡 Mẹo: nếu một lệnh chạy được khi bạn gõ trong terminal thường, thì nó cũng chạy được ở đây.

### 🚨 Các trợ lý được khởi chạy với chế độ bỏ qua hỏi quyền

Mỗi CLI được khởi chạy kèm cờ bỏ qua quyền của riêng nó (`claude --dangerously-skip-permissions`,
`codex --dangerously-bypass-approvals-and-sandbox`, v.v.), nên trợ lý sẽ chạy lệnh và
sửa file **mà không hỏi bạn trước**. Cách này nhanh, nhưng đồng nghĩa một repository
bạn không tin tưởng có thể điều khiển trợ lý thực hiện hành vi phá hoại hoặc rò rỉ dữ
liệu. Chỉ dùng CLI Code với mã nguồn bạn tin tưởng, hoặc tự mở trợ lý từ terminal thường.

## Cách sử dụng

### Mở một trợ lý

Nhấn **`Cmd + Esc`** (macOS) hoặc **`Ctrl + Esc`** (Windows / Linux).

Một menu hiện ra liệt kê tất cả trợ lý. Chọn một cái — nó mở trong terminal bên cạnh và bắt đầu chạy. Nếu trợ lý đó đang mở rồi, phím tắt chỉ nhảy về terminal đó.

![Bảng chọn CLI liệt kê tất cả trợ lý](images/screenshots/picker-highlighted.png)

> Muốn một phiên hoàn toàn mới thay vì dùng lại cái đang mở? Dùng **`Cmd/Ctrl + Shift + Esc`**.

Bạn cũng có thể mở từ thanh công cụ của editor — tìm icon CLI Code (đã khoanh tròn):

![Icon CLI Code trên thanh công cụ editor](images/screenshots/toolbar-highlighted.png)

### Gửi file bạn đang làm việc

1. Bấm vào một file (tùy chọn **bôi đen vài dòng**).
2. Bấm vào terminal của trợ lý để focus.
3. Nhấn **`Cmd + Alt + K`** (macOS) hoặc **`Ctrl + Alt + K`** (Windows / Linux).

CLI Code chèn một tham chiếu tới file của bạn vào prompt:

| Bạn làm gì         | Nó chèn vào          |
| ------------------ | -------------------- |
| Chỉ mở một file    | `@src/app.ts`        |
| Bôi đen một dòng   | `@src/app.ts#L10`    |
| Bôi đen nhiều dòng | `@src/app.ts#L10-20` |

Giờ chỉ cần gõ câu hỏi — trợ lý đã biết bạn đang nói về file (và dòng) nào.

## Terminal riêng của CLI Code

Trợ lý không chạy trong terminal tích hợp của VS Code mà trong **terminal riêng của extension** — một webview panel nối tới một daemon PTY chạy nền. Đó là thứ làm nên phần còn lại:

- Tab terminal có **icon màu** riêng cho từng trợ lý.
- **Tên tab tự cập nhật** theo prompt bạn vừa gõ (không cần đặt tên tay) — theo giới hạn của Orca: bỏ URL, tối đa 40 ký tự, cắt tại ranh giới từ và thêm `…`.
- Tab hiển thị **trạng thái agent** — đang chạy, đang chờ bạn, hay đã xong — ngay trên tiêu đề.
- Phiên **sống qua Reload Window**: reload cửa sổ xong, terminal tự nối lại vào đúng phiên CLI đang chạy, không mất ngữ cảnh.

### Giới hạn

- **Đóng tab = kết thúc CLI đó.** VS Code không cho extension "hỏi trước khi đóng" một tab, nên đóng tab sẽ dừng luôn tiến trình CLI trong đó — không có cảnh báo.
- **Thoát hẳn VS Code = kết thúc mọi phiên.** Tất cả các CLI đang chạy trong CLI Code sẽ dừng theo.
- **Hook trạng thái chỉ hoạt động trên POSIX** (macOS, Linux) — Windows không cài được.

### Hook trạng thái

CLI Code giữ một hook nhỏ trong mỗi CLI được hỗ trợ để tab hiển thị đúng trạng thái (đang chạy / đang chờ / xong) thay vì đoán từ tiêu đề, thông báo "xong việc" bật cho tab đang ẩn, và **Restart Session** biết chính xác hội thoại cần quay về. Giống Orca, việc này diễn ra **tự động**: khi extension khởi động, CLI nào có trên `PATH` mà thiếu hook thì được cài; tắt `cliCode.statusHooks` là gỡ hết.

| CLI | Hook nằm ở đâu |
| --- | --- |
| Claude Code | `~/.claude/settings.json` → `hooks` (UserPromptSubmit, Stop, Notification, PermissionRequest) |
| Droid | `~/.factory/settings.json` → `hooks` |
| Codex | `~/.codex/hooks.json` → `hooks`, kèm các mục trust `[hooks.state.…]` tương ứng trong `~/.codex/config.toml` (Codex chỉ chạy hook đã được tin cậy) |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` (file riêng) |
| Grok | `~/.grok/hooks/cli-code.json` (file riêng) |
| opencode / Kilo / MiMo | `~/.config/opencode|kilo|mimocode/plugins/cli-code-status.ts` (plugin sinh tự động) |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` (extension sinh tự động) |

- Trước lần ghi đầu tiên vào file bạn đã có, file được sao lưu ngay cạnh thành `<file>.cli-code.bak`; hook bạn tự cấu hình được giữ nguyên, chỉ mục của CLI Code được thêm/bớt. File sinh tự động bắt đầu bằng `// @cli-code-managed` và không bao giờ bị ghi đè nếu thiếu header đó.
- Mọi mục đều chạy cùng một dòng shell, là no-op khi CLI chạy ngoài CLI Code (không có biến `CLI_CODE_HOOK`):

  ```sh
  [ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
  ```

  Plugin sinh tự động dựng đúng payload JSON như hook shell nhận, rồi pipe vào dòng đó.
- Hook có hiệu lực từ lần khởi động tiếp theo của CLI. CLI Code tự nhận ra khi CLI của một tab cũ hơn config của nó (MCP, plugin, hook — các file ở bảng trên cộng file MCP của từng CLI; kiểm tra sau Reload Window, khi tab hiện ra, và sau khi extension được cập nhật): tab đang rảnh tự khởi động lại vào đúng hội thoại; tab đang bận hiện *"… changed — restart to apply"* trên thanh action cho tới khi bạn restart. **"CLI Code: Restart All Sessions"** khởi động lại mọi tab một lượt.
- **"CLI Code: Install Status Hooks"** / **"Remove Status Hooks"** trong Command Palette làm việc tương tự bằng tay và hiện tóm tắt.
- Chỉ POSIX (macOS, Linux): Windows không có `sh` để chạy dòng hook nên không cài gì.
- Giới hạn đã biết: lệnh hook được shell `eval`, nên đường dẫn cài VS Code có `"` hoặc `$` sẽ hỏng.

### Settings

| Setting                     | Kiểu                     | Mặc định | Mô tả                                                                                       |
| ---------------------------- | ------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `cliCode.statusHooks`        | `boolean`                   | `true`   | Giữ hook trạng thái trong mọi CLI được hỗ trợ (xem "Hook trạng thái"); tắt là gỡ hết. |
| `cliCode.notifications`      | `boolean`                  | `true`   | Thông báo khi agent xong việc ở một tab đang ẩn.                                              |
| `cliCode.quickCommands`      | mảng object                | `[]`     | Lệnh hoặc prompt dùng lại. Đặt trong User settings = Global, Workspace settings = Project.    |

Ví dụ `cliCode.quickCommands`:

```json
"cliCode.quickCommands": [
  { "label": "Chạy test", "text": "npm test" },
  { "label": "Tóm tắt PR", "text": "Tóm tắt các thay đổi trong PR này", "submit": true }
]
```

### Liên kết đường dẫn

Đường dẫn CLI in ra (`src/x.ts:12:3`, `./thư-mục`, `~/ghi-chú.md`, `README`, `file://…`) thành liên kết khi tồn tại trên đĩa — path bị cắt hoặc không có thì không gạch chân. `Cmd/Ctrl + click` mở tệp trong editor (Markdown ở preview, HTML ở trình duyệt) và **thư mục** trong cây Explorer của VS Code (nếu thuộc workspace) hoặc Finder / Explorer (nếu ngoài); `Shift + Cmd/Ctrl + click` mở tệp bằng app mặc định. Click thường vào link (URL hoặc path) sẽ bôi đen trọn link để `Cmd/Ctrl + C` sao chép đủ. Kéo chuột luôn bôi đen văn bản, kể cả khi CLI đang bắt chuột (Claude Code và các TUI khác); giữ `Option` (macOS) / `Shift` (nơi khác) khi kéo nếu muốn gửi chuột cho CLI.

### Menu chuột phải trong terminal

**Restart Session** (khởi động lại phiên) đưa tab về *đúng hội thoại cũ*: CLI có hook trạng thái (Claude Code, Codex, Copilot, Droid, Grok, opencode, Kilo, MiMo, Pi, OMP) theo session id mà hook báo; Command Code, Prime Agent, Cline, Kimi, Cursor, Amp, Antigravity, goose theo phiên mới nhất trong kho phiên của chính CLI cho thư mục này kể từ lúc mở tab; các CLI còn lại theo dạng `--continue`. Chỉ khi không biết gì mới mở phiên mới.

Chuột phải làm việc với nội dung dưới con trỏ / vùng bôi: **Copy** (sao chép, khi có vùng bôi) · **Paste** (dán) · **Select All** (chọn tất cả) · trỏ vào URL: **Open Link** / vào tệp: **Open File**, **Open with Default App** (mở bằng app mặc định), **Insert @path into CLI** (chèn @đường-dẫn vào CLI) / vào thư mục: **Open Folder** · **Copy Link / Path** · **Find Selection** (tìm vùng đã bôi) · **Find in Terminal**. Các thao tác với tab nằm ở thanh lặng trên đầu terminal (cùng màu nền, icon sát mép phải): **New Session** (phiên mới — chọn CLI, mở trong thư mục của tab này), **Resume Session** (mở lại phiên cũ), **Restart Session** (khởi động lại phiên), **Find** (tìm), và trong **…**: Rename Tab (đổi tên tab, `F2`), Copy Context (sao chép ngữ cảnh), Quick Command (lệnh nhanh). Bên trái thanh để trống, chỉ hiện chữ khi agent cần anh (“Waiting for your confirmation”). Bên trái thanh hiện **model** CLI đang dùng (đọc từ kho phiên của chính CLI — Claude Code, Codex, Grok, Copilot, Pi, OMP, Command Code, Prime Agent, Droid, Cline, opencode/MiMo/Kilo; ẩn với CLI không ghi model) và, khi agent chờ anh, một dòng trạng thái. **Khung nhập chat** (thử nghiệm) dưới terminal — gõ/dán, `Enter` gửi nguyên khối, `Shift + Enter` xuống dòng — bật bằng `cliCode.composer: true`; mặc định tắt để giữ nguyên menu `/` và `@` trong ô nhập của chính CLI. Rê chuột lên link sẽ hiện gợi ý `Cmd/Ctrl + click` mở gì kèm đường dẫn đã resolve.

### Lệnh Command Palette

`CLI Code:` **New Session** (phiên mới), **Restart All Sessions** (khởi động lại mọi phiên), **Resume Session** (mở lại phiên cũ), **Quick Command** (lệnh nhanh), **Save as Quick Command** (lưu thành lệnh nhanh), **Rename Tab** (đổi tên tab), **Restart Session** (khởi động lại phiên), **Zoom In** / **Zoom Out** / **Reset Zoom** (cỡ chữ), **Find in Terminal** (tìm trong terminal), **Copy Context** (sao chép ngữ cảnh), **Paste** (dán), **Copy** (sao chép), **Install Status Hooks** / **Remove Status Hooks** (cài / gỡ hook trạng thái Claude).

## Phím tắt

| Thao tác                      | macOS                | Windows / Linux       |
| ------------------------------ | --------------------- | ----------------------- |
| Mở / focus một trợ lý          | `Cmd + Esc`           | `Ctrl + Esc`             |
| Mở trợ lý trong terminal mới   | `Cmd + Shift + Esc`   | `Ctrl + Shift + Esc`     |
| Gửi file hiện tại vào trợ lý   | `Cmd + Alt + K`       | `Ctrl + Alt + K`         |
| Xuống dòng trong prompt        | `Shift + Enter`       | `Shift + Enter`         |
| Tìm trong terminal             | `Cmd + F`             | `Ctrl + F` \*           |
| Phóng to chữ                   | `Cmd + =`             | `Ctrl + =`               |
| Thu nhỏ chữ                    | `Cmd + -`             | `Ctrl + -`               |
| Cỡ chữ mặc định                | `Cmd + 0`             | `Ctrl + 0`               |

\* Trên Windows / Linux, terminal đang focus nuốt `Ctrl + F` (xterm gửi xuống CLI dưới dạng `^F`). Dùng lệnh Command Palette **"CLI Code: Find in Terminal"** hoặc mục chuột phải **Find in Terminal** thay thế.

## Câu hỏi thường gặp

**Trợ lý mở lên nhưng yêu cầu đăng nhập.**
Đó là điều bình thường — CLI Code chỉ khởi chạy công cụ, không lo phần xác thực. Hãy hoàn tất bước đăng nhập của chính trợ lý đó một lần (ở bất kỳ terminal nào); sau đó nó sẽ nhớ bạn.

**Nhấn `Cmd + Alt + K` mà không có gì xảy ra.**
Hãy chắc rằng (1) có một file đang mở trong editor, và (2) terminal của trợ lý đang được focus. Tham chiếu file sẽ đi vào terminal CLI nào đang active.

**Phím tắt bị trùng với thứ khác.**
Đổi lại trong VS Code: **Preferences → Keyboard Shortcuts**, tìm "CLI", và đặt phím riêng của bạn.

## Giấy phép

[MIT](LICENSE) © 2026 Thanh Luan
