# CLI Code — Hướng dẫn sử dụng

*Phiên bản 0.2.0 · Bản tiếng Anh: [user-guide.md](user-guide.md) · Thay đổi theo phiên bản: [CHANGELOG.md](../CHANGELOG.md)*

CLI Code đưa các trợ lý lập trình chạy trên dòng lệnh — Claude Code, Codex, Copilot, opencode,
Pi, Grok, Droid và 21 công cụ khác — vào thẳng VS Code. Mỗi trợ lý là một tab terminal riêng của
extension: tab đổi tên theo việc bạn đang giao, hiện agent đang chạy hay đang chờ bạn, mở được
mọi file và link mà agent in ra, sống qua Reload Window, và khi cần khởi động lại thì quay về đúng
hội thoại đang dở.

Tài liệu này đi theo thứ tự bạn sẽ dùng: cài đặt → mở trợ lý đầu tiên → làm việc hằng ngày →
quản lý phiên → tùy chỉnh. Phần phụ lục ở cuối là bảng tra cứu.

---

## Phần A — Bắt đầu

### 1. Cài đặt và chuẩn bị

**Bước 1 — Cài extension.** Mở Extensions (`Cmd/Ctrl + Shift + X`), tìm **CLI Code**, bấm
Install. (Hoặc cài file `.vsix` đúng nền tảng: `code --install-extension cli-code-0.2.0-darwin-arm64.vsix`.)
Cần VS Code 1.94 trở lên. macOS và Linux có đủ tính năng; Windows xem [Giới hạn](#giới-hạn-trên-windows).

**Bước 2 — Cài và đăng nhập trợ lý bạn muốn dùng.** CLI Code không cài trợ lý, chỉ khởi chạy
chúng. Cài theo hướng dẫn của từng công cụ, rồi chạy thử **một lần trong terminal thường** để
hoàn tất đăng nhập (`claude`, `codex`, `copilot`, `opencode`…). Quy tắc đơn giản: lệnh nào chạy
được trong terminal thì chạy được trong CLI Code. Danh sách đầy đủ ở [Phụ lục A](#phụ-lục-a--28-trợ-lý-và-mức-hỗ-trợ).

**Bước 3 — Không cần cấu hình gì thêm.** Ngay khi extension kích hoạt, nó tìm các trợ lý có trên
`PATH` và cài một *hook trạng thái* nhỏ vào cấu hình của từng trợ lý (để tab biết agent đang làm gì —
giải thích ở [mục 16](#16-hook-trạng-thái-thứ-làm-cho-tab-biết-agent-đang-làm-gì)). File cấu hình
của bạn được sao lưu trước khi sửa.

> ⚠️ **Trợ lý chạy ở chế độ không hỏi quyền.** CLI Code khởi chạy mỗi CLI với cờ bỏ qua xác nhận
> của nó (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-approvals-and-sandbox`,
> `copilot --yolo`…). Agent sẽ sửa file và chạy lệnh mà không hỏi. Chỉ dùng trên repository bạn
> tin tưởng; nếu muốn có hộp thoại xác nhận, hãy mở CLI từ terminal thường.

### 2. Mở trợ lý đầu tiên

1. Mở thư mục dự án trong VS Code.
2. Bấm **`Cmd + Esc`** (macOS) hoặc **`Ctrl + Esc`** (Windows/Linux).
3. Bộ chọn hiện ra: trợ lý đã cài nằm dưới **Installed**, chưa cài dưới **Not installed**. Chọn một
   trợ lý.

   ![Bộ chọn trợ lý](../images/screenshots/picker-highlighted.png)

4. Một tab mở ở cột bên cạnh editor, mang icon màu của trợ lý, và CLI khởi động ngay trong thư
   mục dự án.

Cách khác: bấm icon CLI Code trên thanh tiêu đề editor, hoặc Command Palette → **Open CLI**.

![Icon CLI Code trên thanh tiêu đề editor](../images/screenshots/toolbar-highlighted.png)

💡 Bấm `Cmd + Esc` lần nữa khi trợ lý đó đã có tab sẽ **nhảy về tab đó** chứ không mở thêm. Muốn
thêm một tab nữa cùng trợ lý: `Cmd/Ctrl + Shift + Esc`, hoặc nút **Open CLI in new tab** trên
thanh tiêu đề.

CLI chạy bên trong **shell login tương tác** của bạn (`$SHELL -ilc`), tức là `PATH`, `nvm`, `pnpm`,
`pyenv`, các alias trong `.zshrc`/`.bashrc` đều y như tab terminal thường. MCP server mà Codex
hay Claude khởi động qua `npx` vì thế cũng dùng đúng node của bạn.

### 3. Gửi prompt đầu tiên

Gõ thẳng vào ô nhập của CLI như bình thường — CLI Code không chen vào giữa bạn và trợ lý.

- **Xuống dòng trong prompt:** `Shift + Enter`. (CLI Code gửi `ESC CR`, đúng quy ước
  `/terminal-setup` của Claude Code, nên không cần cài gì thêm.)
- **Dán nhiều dòng:** `Cmd/Ctrl + V`. Đoạn dán tới CLI thành **một khối** (bracketed paste) nên
  Claude/Codex không hiểu nhầm mỗi dòng là một lần Enter. Dán trên 100 KB sẽ được hỏi trước.
- **Gửi file đang mở cho trợ lý:**
  1. Bấm vào file trong editor; bôi vài dòng nếu muốn.
  2. Bấm vào tab trợ lý để focus.
  3. Bấm **`Cmd + Alt + K`** / **`Ctrl + Alt + K`**.

  CLI Code gõ vào prompt một tham chiếu mà trợ lý hiểu:

  | Bạn đang | Nó gõ |
  | --- | --- |
  | mở file | `@src/app.ts` |
  | bôi một dòng | `@src/app.ts#L10` |
  | bôi nhiều dòng | `@src/app.ts#L10-20` |

  Giờ chỉ việc gõ câu hỏi: "giải thích hàm này", "viết test cho đoạn đã chọn"…

### 4. Đọc tab: tên, trạng thái, thông báo

Ngay khi bạn gửi prompt, **tên tab đổi theo việc bạn giao**. Ví dụ gõ
`Rồi bây giờ bạn xóa cms-demo và làm lại toàn bộ phần đăng nhập` → tab tên
`Rồi bây giờ bạn xóa cms-demo và làm lại…` (tối đa 40 ký tự, cắt ở ranh giới từ, bỏ URL). Trợ lý
nào tự đặt tiêu đề (Claude Code, Codex, Cline…) thì CLI Code dùng tiêu đề đó sau khi bỏ spinner
và ký hiệu trạng thái; bạn đặt tên tay bằng `F2` thì tên đó thắng tất cả.

**Tiền tố trên tên tab** cho biết agent đang làm gì (với trợ lý có hook trạng thái — 10 trợ lý,
xem Phụ lục A):

| Bạn thấy | Nghĩa là |
| --- | --- |
| `⟳ Sửa bug đăng nhập` | agent đang chạy |
| `? Sửa bug đăng nhập` | agent đang **chờ bạn**: xin quyền hoặc hỏi lại |
| `● Sửa bug đăng nhập` | đã xong (hoặc bắt đầu chờ) trong lúc bạn nhìn tab khác; mất khi bạn quay lại |
| `Sửa bug đăng nhập` | rảnh |

Khi agent xong việc hoặc bắt đầu chờ ở **tab bạn không nhìn**, VS Code hiện thông báo
*"Claude Code finished: Sửa bug đăng nhập"* với nút **Open tab**. Tắt bằng `cliCode.notifications`.

---

## Phần B — Làm việc hằng ngày

### 5. Nhiều trợ lý, nhiều tab

Mỗi trợ lý một tab, mở bao nhiêu cũng được, kể cả nhiều tab cùng trợ lý (ví dụ Claude cho tính
năng A, Claude khác cho review). Vài thói quen hữu ích:

- **Thêm tab cùng trợ lý, cùng thư mục:** nút 💬+ **New Session** trên thanh action của tab đang
  mở (hiện bộ chọn CLI, mở trong đúng thư mục của tab đó), hoặc `Cmd/Ctrl + Shift + Esc`.
- **Đổi tên tab:** `F2` khi tab đang focus, hoặc … → **Rename Tab**. Tên bạn đặt giữ nguyên qua
  reload và restart.
- **Kéo tab** sang cột khác, chia đôi, đưa vào nhóm editor… đều là tab VS Code bình thường.
- **Đóng tab = kết thúc CLI trong tab đó**, không có cảnh báo (VS Code không cho extension chặn
  việc đóng tab). Muốn mở lại hội thoại đó: [Resume Session](#12-mở-lại-hội-thoại-cũ).
- **Thoát VS Code = kết thúc mọi phiên.** Reload Window thì không — xem [mục 10](#10-reload-window-mà-không-mất-gì).

### 6. Thanh action trên đầu terminal

Một thanh mảnh, cùng màu nền terminal, icon nằm sát mép phải:

| Nút | Làm gì |
| --- | --- |
| 💬+ **New Session** | chọn CLI, mở thêm tab trong thư mục của tab này |
| 🕘 **Resume Session** | danh sách phiên cũ của workspace ([mục 12](#12-mở-lại-hội-thoại-cũ)) |
| ↻ **Restart Session** | chạy lại CLI **trong cùng hội thoại** ([mục 11](#11-khởi-động-lại-mà-vẫn-ở-đúng-hội-thoại)) |
| 🔍 **Find** | tìm trong terminal |
| … | **Rename Tab** (`F2`) · **Copy Context** (chép 200 dòng cuối) · **Quick Command** ([mục 15](#15-lệnh-nhanh)) |

Bên trái thanh có:

- **Model đang dùng**, ví dụ `claude-opus-5` hay `gpt-5.6-luna`. CLI Code đọc từ file phiên của
  chính CLI (3 giây sau khi mở tab và mỗi 30 giây), nên đổi model bằng `/model` sẽ được cập nhật.
  Trợ lý không ghi model thì ẩn.
- Dòng trạng thái `● Waiting for your confirmation` khi agent chờ bạn.
- Nhắc nhở `● <file> changed — restart to apply` khi CLI đang chạy cũ hơn cấu hình của nó
  ([mục 13](#13-khi-bạn-đổi-mcp-plugin-hook-tab-tự-khởi-động-lại)).

### 7. Mở file và link mà trợ lý in ra

Agent thường trả lời kiểu *"Tôi đã sửa `src/auth/login.ts:42:7` và cập nhật `docs/hướng-dẫn.md`"*.
Trong CLI Code những đường dẫn ấy là **link thật**:

- **Rê chuột** lên: tooltip cho biết click sẽ làm gì và đường dẫn đầy đủ.
- **`Cmd/Ctrl + click`** vào file: mở trong editor **đúng dòng và cột**. File `.md` mở ở chế độ
  preview, file `.html` mở trong trình duyệt.
- **`Cmd/Ctrl + click`** vào thư mục: nằm trong workspace thì **hiện trong Explorer** của VS Code;
  nằm ngoài thì mở **Finder / File Explorer**.
- **`Shift + Cmd/Ctrl + click`**: mở file bằng **app mặc định** của hệ điều hành (ảnh, PDF…).
- **URL** (`https://…`) và hyperlink Claude Code in ra (OSC 8): `Cmd/Ctrl + click` mở trình duyệt.
- **Click thường** vào link: **chọn trọn link** để `Cmd/Ctrl + C` chép cả đường dẫn/URL — không
  còn phải kéo chọn từng ký tự.

CLI Code chỉ gạch chân đường dẫn **thật sự tồn tại** (tính từ thư mục CLI đang đứng, rồi tới
workspace), nên đường dẫn bị cắt ngang hay agent bịa ra sẽ không bao giờ trông như bấm được. Nhận
ra `src/x.ts`, `./dir`, `../lib`, `~/notes.md`, `/abs/path`, `file:///…`, tên file quen thuộc
không đuôi (`README`, `Makefile`, `Dockerfile`, `LICENSE`…) và mọi `tên.đuôi`; tiếng Việt, CJK
trong tên file đều đúng.

### 8. Bôi chọn, sao chép, tìm, phóng chữ

**Bôi chọn và chép.** Kéo chuột để chọn, `Cmd/Ctrl + C` để chép — kể cả khi trợ lý đang ở chế độ
toàn màn hình bắt chuột (Claude Code): kéo thường vẫn bôi chọn, còn **click thuần vẫn tới CLI**
nên bấm vào ô prompt của Claude sẽ đặt con trỏ đúng chỗ. Cần gửi thao tác kéo cho CLI (TUI có
cơ chế chọn riêng)? Giữ **`Option`** (macOS) / **`Shift`** (Windows, Linux) khi kéo.

**Chọn tất cả:** chuột phải → **Select All**. **Chép ngữ cảnh** để dán sang trợ lý khác: … →
**Copy Context** (200 dòng cuối).

**Tìm trong terminal:** `Cmd/Ctrl + F` (hoặc 🔍) mở thanh tìm với nút `Aa` (phân biệt hoa thường),
`.*` (biểu thức chính quy), bộ đếm kết quả; `Enter` tới kết quả sau, `Shift + Enter` về trước,
`Esc` đóng. Có vùng chọn sẵn thì chuột phải → **Find Selection** để tìm đúng đoạn đó.

**Phóng/thu chữ theo tab:** `Cmd/Ctrl + =`, `Cmd/Ctrl + -`, `Cmd/Ctrl + 0`. Font và theme lấy theo
`editor.fontFamily`, `editor.fontSize` và theme màu bạn đang dùng.

CLI nào tự ghi clipboard (OSC 52) cũng đi qua clipboard của VS Code, nên "copy" bên trong Claude
Code hoạt động như thường.

### 9. Menu chuột phải theo ngữ cảnh

Menu thay đổi theo thứ bạn đang trỏ vào:

| Trỏ vào / đang có | Mục hiện ra |
| --- | --- |
| bất kỳ đâu | **Paste**, **Select All**, **Find in Terminal** |
| vùng đang bôi | thêm **Copy**, **Find Selection** |
| một URL | thêm **Open Link**, **Copy Link / Path** |
| một đường dẫn file | thêm **Open File**, **Open with Default App**, **Insert @path into CLI**, **Copy Link / Path** |
| một đường dẫn thư mục | thêm **Open Folder**, **Copy Link / Path** |

**Insert @path into CLI** gõ `@<đường dẫn tương đối>` vào prompt (không gửi) — cách nhanh nhất để
bảo trợ lý "nhìn vào file này" khi file đó vừa được nhắc trong terminal.

---

## Phần C — Quản lý phiên làm việc

### 10. Reload Window mà không mất gì

Các CLI không chạy trong webview mà dưới một **daemon nền** thuộc cửa sổ VS Code. Vì thế
**Developer: Reload Window** (cài extension mới, đổi setting, VS Code tự reload…) không làm mất
gì: mọi tab mở lại, nối vào đúng CLI đang chạy, scrollback, tên tab, trạng thái còn nguyên.

Daemon tự tắt 60 giây sau khi tab cuối cùng đóng. Thoát hẳn VS Code thì mọi phiên kết thúc; mở lại
VS Code, tab hiện *"Session … has ended"* với nút **Restart** — bấm để quay về hội thoại
([mục 14](#14-khi-cli-thoát-hoặc-phiên-đã-mất)).

### 11. Khởi động lại mà vẫn ở đúng hội thoại

Nhiều lúc bạn cần chạy lại CLI: vừa thêm MCP server, vừa cài plugin, CLI vừa cập nhật, hay đơn
giản là nó treo. Bấm ↻ **Restart Session** (thanh action, chuột phải, hoặc palette). CLI Code tắt
tiến trình cũ và chạy lại **trong cùng hội thoại**, theo thứ tự:

1. Trợ lý có hook trạng thái đã báo session id → chạy với cờ resume của nó
   (`claude --resume <id>`, `codex resume <id>`, `opencode --session <id>`…).
2. Chưa có id từ hook → CLI Code tìm trong **kho phiên của chính CLI** phiên mới nhất thuộc thư
   mục này, tạo sau lúc mở tab (Command Code, Prime Agent, Cline, Kimi, Cursor, Amp, Antigravity,
   Goose…).
3. CLI không có kho phiên đọc được → dùng cờ `--continue` của nó (Aider, Kiro, Crush, Auggie,
   Continue, Vibe, Qwen, Hermes, Devin).
4. Không biết gì → phiên mới.

Tổng cộng 19 trợ lý quay về **đúng phiên**; 9 trợ lý dùng `--continue` (Phụ lục A). Tab mở từ
Resume Session sẽ luôn resume đúng phiên đó ở mọi lần restart. Cần restart hết một lượt (ví dụ
sau khi đổi cấu hình dùng chung): Command Palette → **CLI Code: Restart All Sessions**.

### 12. Mở lại hội thoại cũ

Command Palette → **CLI Code: Resume Session** (hoặc 🕘 trên thanh action):

- Với **Claude Code, Codex, Grok**: danh sách các phiên cũ của workspace hiện tại — tên phiên,
  trợ lý, thời gian. Chọn một phiên → tab mới mở đúng phiên đó.
- Với **mọi trợ lý khác**: mục **Continue latest session** — phiên mới nhất của *thư mục này* nếu
  kho phiên của CLI có ghi (Copilot, Droid, Pi, OMP, opencode, Cline…), nếu không thì `--continue`
  của CLI.

### 13. Khi bạn đổi MCP / plugin / hook: tab tự khởi động lại

CLI chỉ đọc MCP server, plugin và hook **lúc khởi động**. Thêm một MCP server vào
`~/.codex/config.toml` khi tab Codex đang mở thì Codex đang chạy không thấy — và reload cũng không,
vì tab chỉ nối lại tiến trình cũ. CLI Code xử lý chuyện này thay bạn:

- Nó nhớ thời điểm CLI của từng tab khởi động, và so với thời gian sửa các file cấu hình của CLI
  đó (mức home và mức project: `~/.claude/settings.json`, `~/.claude.json`, `.mcp.json`,
  `~/.codex/config.toml`, `~/.codex/hooks.json`, `~/.copilot/mcp-config.json`,
  `~/.factory/settings.json`, `~/.grok/config.toml`, `~/.config/opencode/opencode.json` và
  `plugins/`, `~/.pi/agent/extensions/`…).
- Kiểm tra sau Reload Window, khi tab hiện ra, sau khi hook được cài, và sau khi extension được
  cập nhật.
- Tab **đang rảnh** (không chạy, không chờ, im lặng 5 giây) → **tự Restart Session** về đúng hội
  thoại. Tab **đang bận** → thanh action hiện `● config.toml changed — restart to apply` cho tới
  khi bạn bấm ↻.

Ví dụ: mở Codex, gõ `/mcp` thấy thiếu server → thêm server vào `config.toml`, lưu → quay lại tab
Codex: nếu nó đang rảnh, nó đã tự chạy lại và `/mcp` thấy server mới.

### 14. Khi CLI thoát hoặc phiên đã mất

- **CLI thoát** (gõ `/exit`, crash…): tab hiện *"Process exited (code N)"* với nút **Restart**.
- **Phiên mất sau khi mở lại VS Code** hoặc daemon bị kill: tab hiện *"Session … has ended"* với
  nút **Restart**.

Cả hai đều restart theo đúng luật ở [mục 11](#11-khởi-động-lại-mà-vẫn-ở-đúng-hội-thoại), nên với
19 trợ lý bạn quay về đúng hội thoại.

---

## Phần D — Tùy chỉnh

### 15. Lệnh nhanh

Những prompt hay lệnh bạn gõ đi gõ lại ("chạy test", "tóm tắt PR này") có thể lưu thành **Quick
Command**:

**Cách 1 — trong settings.json** (User = dùng mọi nơi, Workspace = riêng dự án):

```jsonc
"cliCode.quickCommands": [
  { "label": "Run tests", "text": "npm test" },
  { "label": "Summarize PR", "text": "Summarize the changes in this PR" },
  { "label": "Explain file (draft)", "text": "Explain this file", "submit": false }
]
```

**Cách 2 — từ vùng chọn:** bôi một đoạn trong terminal → Command Palette → **CLI Code: Save as
Quick Command** → đặt tên → chọn lưu User hay Workspace.

**Chạy:** … → **Quick Command** (hoặc palette) → chọn. Văn bản được dán thành một khối và gửi
Enter (`submit` mặc định `true`; đặt `false` nếu chỉ muốn điền sẵn để bạn sửa tiếp). Mục có icon
quả cầu là User, icon thư mục là Workspace. Tab mở bằng lệnh nhanh mang tên lệnh đó cho tới khi
bạn đổi tên.

### 16. Hook trạng thái: thứ làm cho tab biết agent đang làm gì

Terminal thường không thể biết agent bên trong đang chạy hay đang chờ. CLI Code giải quyết bằng
**hook trạng thái**: một mục nhỏ trong chính cấu hình của trợ lý, chạy khi bạn gửi prompt, khi
agent dừng, khi agent xin quyền. Nhờ nó tab có glyph `⟳ ? ●`, có thông báo "xong việc", và
**Restart Session** biết chính xác session id để quay về.

Mọi hook đều chỉ chạy một dòng:

```sh
[ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
```

Biến `CLI_CODE_HOOK` chỉ tồn tại trong tab do CLI Code mở, nên khi bạn chạy trợ lý ngoài CLI Code,
hook **không làm gì cả**.

**Tự cài, có sao lưu.** Lúc kích hoạt, extension cài hook cho mọi trợ lý có trên `PATH`
(setting `cliCode.statusHooks`, mặc định bật). File có sẵn được sao lưu một lần thành
`<file>.cli-code.bak`; hook của riêng bạn giữ nguyên, chỉ mục của CLI Code được thêm/bớt.

| Trợ lý | Cài vào |
| --- | --- |
| Claude Code | `~/.claude/settings.json` (mục `hooks`) |
| Droid | `~/.factory/settings.json` (mục `hooks`) |
| Codex | `~/.codex/hooks.json` + các mục trust `[hooks.state."…"]` trong `~/.codex/config.toml` (Codex chỉ chạy hook đã tin cậy) |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json` (file riêng) |
| Grok | `~/.grok/hooks/cli-code.json` (file riêng) |
| opencode / Kilocode / MiMo | `~/.config/opencode|kilo|mimocode/plugins/cli-code-status.ts` (plugin sinh tự động, dòng đầu `// @cli-code-managed`) |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`, `~/.omp/agent/extensions/cli-code-status.ts` (extension sinh tự động) |

**Có hiệu lực từ lần khởi động tiếp theo** của trợ lý — tab đang chạy sẵn sẽ được CLI Code tự
restart khi rảnh ([mục 13](#13-khi-bạn-đổi-mcp-plugin-hook-tab-tự-khởi-động-lại)).

**Kiểm tra / cài lại / gỡ:** Command Palette → **CLI Code: Install Status Hooks** hiện tóm tắt
*Installed: Codex, Grok · Failed: …*; **Remove Status Hooks** gỡ toàn bộ. Đặt `cliCode.statusHooks`
= `false` cũng gỡ hết và không cài lại.

Chưa có hook cho Cursor, Cline, Command Code, Antigravity, Amp và các trợ lý còn lại: tab vẫn có
tên, link, restart, nhưng không có glyph trạng thái.

### 17. Cài đặt và phím tắt

| Setting | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | Giữ hook trạng thái trong mọi trợ lý có trên `PATH`; `false` gỡ hết. |
| `cliCode.notifications` | `true` | Thông báo khi agent xong / bắt đầu chờ ở tab bạn không nhìn. |
| `cliCode.quickCommands` | `[]` | Lệnh nhanh `{ label, text, submit? }`. |
| `cliCode.composer` | `false` | Khung nhập kiểu chat dưới terminal (thử nghiệm): `Enter` gửi nguyên khối, `Shift+Enter` xuống dòng. Tắt để giữ menu `/` và `@` của CLI. Áp dụng cho tab mở sau khi đổi. |

| Việc | macOS | Windows / Linux |
| --- | --- | --- |
| Mở / focus trợ lý | `Cmd + Esc` | `Ctrl + Esc` |
| Mở trợ lý trong tab mới | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| Chèn file hiện tại (`@path`) | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| Xuống dòng trong prompt | `Shift + Enter` | `Shift + Enter` |
| Tìm trong terminal | `Cmd + F` | `Ctrl + F` \* |
| Phóng / thu / mặc định | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| Đổi tên tab | `F2` | `F2` |

Phím tắt phạm vi terminal chỉ có hiệu lực khi tab CLI Code đang active nên không đụng phím mặc
định của VS Code. \* Trên Windows/Linux terminal giữ `Ctrl + F` cho CLI — dùng palette hoặc menu
chuột phải.

---

## Phụ lục

### Phụ lục A — 28 trợ lý và mức hỗ trợ

| Trợ lý | Lệnh CLI Code chạy | Trạng thái trên tab | Restart → đúng hội thoại | Hiện model |
| --- | --- | :-: | :-: | :-: |
| Claude Code | `claude --dangerously-skip-permissions` | ✓ | ✓ | ✓ |
| Claude Agent Teams | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude …` | ✓ | ✓ | ✓ |
| Codex CLI | `codex --dangerously-bypass-approvals-and-sandbox` | ✓ | ✓ | ✓ |
| GitHub Copilot CLI | `copilot --yolo` | ✓ | ✓ | ✓ |
| Droid (Factory) | `droid` | ✓ | ✓ | ✓ |
| Grok | `grok --permission-mode bypassPermissions` | ✓ | ✓ | ✓ |
| opencode | `opencode --auto` | ✓ | ✓ | ✓ |
| Kilocode | `kilo` | ✓ | ✓ | ✓ |
| MiMo Code | `mimo` | ✓ | ✓ | ✓ |
| Pi | `pi` | ✓ | ✓ | ✓ |
| OMP | `omp` | ✓ | ✓ | ✓ |
| Command Code | `command-code --yolo` | — | ✓ | ✓ |
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

*Trạng thái trên tab* = có hook trạng thái. *Restart → đúng hội thoại* ✓ = mở lại đúng phiên;
`--continue` = cờ "tiếp tục phiên gần nhất" của CLI (không phải CLI nào cũng giới hạn theo thư
mục). *Hiện model* = thanh action đọc được model từ file phiên của CLI.

### Phụ lục B — Danh sách lệnh (Command Palette, nhóm `CLI Code:`)

| Lệnh | Id | Ghi chú |
| --- | --- | --- |
| Open CLI | `cli-code.open` | bộ chọn; focus tab sẵn có |
| Open CLI in new tab | `cli-code.openNew` | luôn tab mới |
| CLI: Insert At-Mentioned | `cli-code.addFilepath` | `@file#Lx-y` theo vùng chọn trong editor |
| New Session | `cli-code.newSession` | thêm tab cùng CLI, cùng thư mục |
| Resume Session | `cli-code.resume` | |
| Restart Session | `cli-code.restart` | |
| Restart All Sessions | `cli-code.restartAllSessions` | |
| Rename Tab | `cli-code.renameTab` | `F2` |
| Find in Terminal | `cli-code.find` | |
| Copy Context | `cli-code.copyContext` | 200 dòng cuối |
| Copy / Paste / Select All | `cli-code.copySelection` / `cli-code.paste` / `cli-code.selectAll` | |
| Zoom In / Zoom Out / Reset Zoom | `cli-code.fontZoomIn` / `fontZoomOut` / `fontZoomReset` | |
| Quick Command / Save as Quick Command | `cli-code.quickCommand` / `cli-code.addQuickCommand` | |
| Install Status Hooks / Remove Status Hooks | `cli-code.installStatusHooks` / `cli-code.removeStatusHooks` | |
| Open Link, Open File, Open Folder, Open with Default App, Copy Link / Path, Insert @path into CLI, Find Selection | `cli-code.*At`, `cli-code.findSelection` | chỉ trong menu chuột phải |

### Phụ lục C — CLI Code đụng vào gì trên máy bạn

**Ghi:** các mục hook / file plugin ở [mục 16](#16-hook-trạng-thái-thứ-làm-cho-tab-biết-agent-đang-làm-gì)
(kèm sao lưu `<file>.cli-code.bak`); socket và build stamp của daemon trong thư mục tạm
(`cli-code-<id>.sock`, `.sock.build`); bộ nhớ riêng của VS Code (daemon của cửa sổ, phiên bản
extension, trạng thái tab để khôi phục); lệnh nhanh bạn lưu vào `settings.json`.

**Đọc (không sửa):** kho phiên của các trợ lý để tìm session id, tên phiên, model —
`~/.claude/projects`, `~/.codex/sessions`, `~/.grok/sessions`, `~/.copilot/session-state` và
`session-store.db`, `~/.factory/sessions`, `~/.pi/agent/sessions`, `~/.omp/agent/sessions`,
`~/.commandcode/projects`, `~/.prime/agent/sessions`, `~/.cline/data/sessions`, `~/.kimi/sessions`,
`~/.cursor/projects`, `~/.local/share/amp/threads`, `~/.local/share/{opencode,mimocode,kilo}/*.db`,
`~/.local/share/goose/sessions/sessions.db`, `~/.gemini/antigravity-cli/cache/last_conversations.json`;
và thời gian sửa của các file cấu hình ở [mục 13](#13-khi-bạn-đổi-mcp-plugin-hook-tab-tự-khởi-động-lại).

**Mạng:** extension không kết nối đi đâu. Trợ lý nói chuyện với nhà cung cấp của chúng như bình thường.

### Phụ lục D — Khắc phục sự cố

| Hiện tượng | Nguyên nhân / cách xử lý |
| --- | --- |
| Codex `/mcp` báo server *failed* nhưng trong terminal thường thì chạy | Bản cũ chạy CLI qua shell không tương tác nên `PATH` thiếu. 0.2.0 đã sửa; Reload Window để daemon mới thay daemon cũ, tab rảnh sẽ tự restart. |
| Tab không có glyph `⟳ ?` | Trợ lý chưa có hook, hoặc CLI khởi động trước khi hook được cài. Chạy **Install Status Hooks** rồi **Restart Session**. Windows không có hook. |
| *"Session … has ended"* sau khi mở VS Code | Phiên đã kết thúc cùng VS Code. Bấm **Restart** để quay về hội thoại. |
| Restart lại ra hội thoại mới | Trợ lý thuộc nhóm `--continue`, hoặc chưa gửi prompt nào nên chưa có phiên. |
| Bên trong CLI có cảnh báo về hook | Codex: gõ `/hooks` trong Codex và chấp thuận hook CLI Code. Grok: chạy Remove rồi Install Status Hooks để cập nhật file. |
| `Ctrl + F` gõ vào CLI (Windows/Linux) | Terminal giữ phím đó. Dùng palette hoặc menu chuột phải. |
| Dán nhiều dòng thì prompt bị gửi | CLI đó không bật bracketed paste nên coi xuống dòng là Enter. |
| Đường dẫn không được gạch chân | Chỉ đường dẫn tồn tại mới thành link, và CLI phải đã báo thư mục hiện tại cho terminal. |

<a id="giới-hạn-trên-windows"></a>**Giới hạn trên Windows:** terminal, link, menu, phiên đều dùng
được; hook trạng thái và shell tương tác thì không (CLI chạy qua PowerShell) nên tab không có
glyph trạng thái.

### Phụ lục E — Hỏi đáp và gỡ cài đặt

- **Có gửi dữ liệu đi đâu không?** Không. CLI Code không có server, không gọi mạng.
- **Vẫn dùng terminal tích hợp của VS Code chứ?** Được, CLI Code chỉ quản lý tab do nó mở.
- **Sao tắt hộp thoại xác nhận quyền?** Để agent làm việc liên tục; muốn có lại thì mở CLI từ
  terminal thường.
- **Gỡ cài đặt sạch:** Command Palette → **CLI Code: Remove Status Hooks** (bản sao lưu
  `.cli-code.bak` giữ nguyên) → đóng các tab CLI → gỡ extension trong Extensions view.
