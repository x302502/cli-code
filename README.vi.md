# CLI Code

[English](README.md) · **Tiếng Việt** · [中文](README.zh.md) · [日本語](README.ja.md)

> Mở trợ lý lập trình AI yêu thích của bạn trong terminal ngay cạnh code — và gửi thẳng file bạn đang xem vào đó, chỉ với một phím tắt.

![Nhiều AI CLI chạy song song trong VS Code](images/screenshots/terminals.png)

## Nó làm gì?

Nhiều công cụ lập trình AI chạy trên terminal: **Claude Code, Codex, Antigravity, opencode**, và nhiều hơn nữa. Nếu bạn dùng nhiều hơn một cái, việc chuyển qua lại khá mất công.

**CLI Code** đưa tất cả vào trong tầm một phím tắt:

- Nhấn một phím → chọn trợ lý → nó mở trong terminal **bên cạnh editor**.
- Mỗi trợ lý mở kèm **icon riêng** trên tab terminal (icon lấy từ [Orca](https://github.com/stablyai/orca)).
- Nhấn một phím khác → **file bạn đang xem** (và những dòng bạn bôi đen) được đưa vào prompt của trợ lý. Khỏi copy-paste.

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
| [OpenClaude](https://openclaude.gitlawb.com/)                                                    | `openclaude`        |
| [Ante](https://github.com/AntigmaLabs/ante-preview)                                              | `ante`              |
| [Trae](https://docs.trae.cn/cli_get-started-with-trae-cli)                                       | `traecli`           |
| [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent)                                  | `prime-agent`       |
| [Aider](https://aider.chat/docs/)                                                                | `aider`             |
| [Goose](https://block.github.io/goose/docs/quickstart/)                                          | `goose`             |
| [Kiro](https://kiro.dev)                                                                         | `kiro-cli`          |
| [Charm / Crush](https://github.com/charmbracelet/crush)                                          | `crush`             |
| [Auggie](https://docs.augmentcode.com/cli/overview)                                              | `auggie`            |
| [Autohand Code](https://github.com/autohandai/code-cli)                                          | `autohand`          |
| [Codebuff](https://www.codebuff.com/docs/help/quick-start)                                       | `codebuff`          |
| [Continue](https://docs.continue.dev/guides/cli)                                                 | `cn`                |
| [Cursor](https://cursor.com/cli)                                                                 | `cursor-agent`      |
| [Kimi](https://www.kimi.com/code/docs/en/kimi-code-cli/getting-started.html)                     | `kimi`              |
| [Mistral Vibe](https://github.com/mistralai/mistral-vibe)                                        | `vibe`              |
| [Qwen Code](https://github.com/QwenLM/qwen-code)                                                 | `qwen`              |
| [Rovo Dev](https://support.atlassian.com/rovo/docs/install-and-run-rovo-dev-cli-on-your-device/) | `rovo`              |
| [Hermes](https://hermes-agent.nousresearch.com/docs/)                                            | `hermes`            |
| [Devin](https://devin.ai/cli)                                                                    | `devin`             |
| [OpenClaw](https://github.com/openclaw/openclaw)                                                 | `openclaw`          |

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

## Terminal riêng (0.2.0)

Từ 0.2.0, CLI Code không còn mở trợ lý trong terminal tích hợp thường của VS Code — mỗi trợ lý mở trong **terminal riêng của extension**: một webview panel nối tới một daemon PTY chạy nền. Nhờ đó:

- Tab terminal có **icon màu** riêng cho từng trợ lý.
- **Tên tab tự cập nhật** theo prompt bạn vừa gõ (không cần đặt tên tay).
- Tab hiển thị **trạng thái agent** — đang chạy, đang chờ bạn, hay đã xong — ngay trên tiêu đề.
- Phiên **sống qua Reload Window**: reload cửa sổ xong, terminal tự nối lại vào đúng phiên CLI đang chạy, không mất ngữ cảnh.

### Giới hạn

- **Đóng tab = kết thúc CLI đó.** VS Code không cho extension "hỏi trước khi đóng" một tab, nên đóng tab sẽ dừng luôn tiến trình CLI trong đó — không có cảnh báo.
- **Thoát hẳn VS Code = kết thúc mọi phiên.** Tất cả các CLI đang chạy trong CLI Code sẽ dừng theo.
- **Hook trạng thái Claude chỉ hoạt động trên POSIX** (macOS, Linux) — Windows không cài được hook này.

### Hook trạng thái Claude Code

CLI Code có thể cài một hook nhỏ vào Claude Code để hiển thị đúng trạng thái (đang chạy / đang chờ / xong) trên tab, thay vì chỉ suy đoán từ tiêu đề. Đây là tính năng **opt-in**:

- Lần đầu bạn mở Claude Code trong CLI Code, extension sẽ hỏi có muốn cài hook không (điều khiển bằng setting `cliCode.claudeStatusHooks`). Đóng thông báo mà không trả lời được coi là "off" cho cửa sổ này — cài lại bằng lệnh Command Palette **"CLI Code: Cài hook trạng thái Claude"**.
- Nếu đồng ý, nó ghi thêm vào `~/.claude/settings.json`. Trước lần ghi đầu tiên, file gốc được sao lưu thành `~/.claude/settings.json.cli-code.bak`; các hook đã có của bạn được giữ nguyên.
- Hook có hiệu lực từ lần mở Claude Code tiếp theo — phiên đang chạy vẫn suy đoán trạng thái từ tiêu đề.
- Gỡ bất kỳ lúc nào bằng lệnh Command Palette **"CLI Code: Gỡ hook trạng thái Claude"**.
- Giới hạn đã biết: lệnh hook được shell `eval` (`eval "$CLI_CODE_HOOK"`), nên đường dẫn cài VS Code chứa `"` hoặc `$` sẽ làm hook hỏng.
- Nội dung mỗi entry được thêm cho 4 sự kiện `UserPromptSubmit`, `Stop`, `Notification`, `PermissionRequest`:

  ```json
  {
    "type": "command",
    "command": "[ -n \"$CLI_CODE_HOOK\" ] && eval \"$CLI_CODE_HOOK\" || true"
  }
  ```

  Lệnh này vô hại khi Claude Code chạy ngoài CLI Code (biến `CLI_CODE_HOOK` không tồn tại nên không làm gì cả).

### Settings

| Setting                     | Kiểu                     | Mặc định | Mô tả                                                                                       |
| ---------------------------- | ------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `cliCode.claudeStatusHooks`  | `"ask" \| "on" \| "off"`   | `"ask"`  | Cài hook trạng thái vào `~/.claude/settings.json` để tab Claude hiện đang chạy / chờ / xong. |
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

Đường dẫn CLI in ra (`src/x.ts:12:3`, `./thư-mục`, `~/ghi-chú.md`, `README`, `file://…`) thành liên kết khi tồn tại trên đĩa — path bị cắt hoặc không có thì không gạch chân. `Cmd/Ctrl + click` mở tệp trong editor (Markdown ở preview, HTML ở trình duyệt) và **thư mục** trong cây Explorer của VS Code (nếu thuộc workspace) hoặc Finder / Explorer (nếu ngoài); `Shift + Cmd/Ctrl + click` mở tệp bằng app mặc định. Click thường vào link (URL hoặc path) sẽ bôi đen trọn link để `Cmd/Ctrl + C` sao chép đủ.

### Menu chuột phải trong terminal

**Khởi động lại phiên** đưa tab về *đúng hội thoại cũ*: Claude Code theo session id mà hook báo; Codex, Grok, Pi, OMP, Command Code, Droid, Prime Agent, Copilot, Cline, Kimi, Cursor, Amp, opencode, MiMo, Kilo, goose theo phiên mới nhất trong kho phiên của chính CLI cho thư mục này kể từ lúc mở tab; các CLI còn lại theo dạng `--continue`. Chỉ khi không biết gì mới mở phiên mới.

Chuột phải làm việc với nội dung dưới con trỏ / vùng bôi: Sao chép (khi có vùng bôi) · Dán · Chọn tất cả · trỏ vào URL: Mở liên kết / vào tệp: Mở tệp, Mở bằng app mặc định, Chèn @đường-dẫn vào CLI / vào thư mục: Mở thư mục · Sao chép liên kết / đường dẫn · Tìm vùng đã bôi · Tìm trong terminal. Các thao tác với tab nằm ở thanh lặng trên đầu terminal (cùng màu nền, icon sát mép phải): **Phiên mới** (chọn CLI, mở trong thư mục của tab này), **Mở lại phiên cũ**, **Khởi động lại phiên**, **Tìm**, và trong **…**: Đổi tên tab (`F2`), Sao chép ngữ cảnh, Lệnh nhanh. Bên trái thanh để trống, chỉ hiện chữ khi agent cần anh (“Đang chờ bạn xác nhận”). Bên trái thanh hiện **model** CLI đang dùng (đọc từ kho phiên của chính CLI — Claude, Codex, Grok, Pi, OMP, opencode/MiMo/Kilo, Cline; ẩn với CLI không ghi model) và, khi agent chờ anh, một dòng trạng thái. **Khung nhập chat** (thử nghiệm) dưới terminal — gõ/dán, `Enter` gửi nguyên khối, `Shift + Enter` xuống dòng — bật bằng `cliCode.composer: true`; mặc định tắt để giữ nguyên menu `/` và `@` trong ô nhập của chính CLI. Rê chuột lên link sẽ hiện gợi ý `Cmd/Ctrl + click` mở gì kèm đường dẫn đã resolve.

### Lệnh Command Palette

`CLI Code:` **Mở lại phiên cũ**, **Lệnh nhanh**, **Lưu thành lệnh nhanh**, **Đổi tên tab**, **Khởi động lại phiên**, **Phóng to chữ**, **Thu nhỏ chữ**, **Cỡ chữ mặc định**, **Tìm trong terminal**, **Sao chép ngữ cảnh**, **Dán**, **Sao chép**, **Cài hook trạng thái Claude**, **Gỡ hook trạng thái Claude**.

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

\* Trên Windows / Linux, terminal đang focus nuốt `Ctrl + F` (xterm gửi xuống CLI dưới dạng `^F`). Dùng lệnh Command Palette **"CLI Code: Tìm trong terminal"** hoặc mục chuột phải **Tìm trong terminal** thay thế.

## Câu hỏi thường gặp

**Trợ lý mở lên nhưng yêu cầu đăng nhập.**
Đó là điều bình thường — CLI Code chỉ khởi chạy công cụ, không lo phần xác thực. Hãy hoàn tất bước đăng nhập của chính trợ lý đó một lần (ở bất kỳ terminal nào); sau đó nó sẽ nhớ bạn.

**Nhấn `Cmd + Alt + K` mà không có gì xảy ra.**
Hãy chắc rằng (1) có một file đang mở trong editor, và (2) terminal của trợ lý đang được focus. Tham chiếu file sẽ đi vào terminal CLI nào đang active.

**Phím tắt bị trùng với thứ khác.**
Đổi lại trong VS Code: **Preferences → Keyboard Shortcuts**, tìm "CLI", và đặt phím riêng của bạn.

## Giấy phép

[MIT](LICENSE) © 2026 Thanh Luan
