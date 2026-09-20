# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · **日本語**

> お気に入りの AI コーディングアシスタントをコードの隣のターミナルで開き、今見ているファイルをショートカット一つでそのまま送り込めます。

![複数の AI CLI を VS Code で横に並べて実行](images/screenshots/terminals.png)

## これは何をするもの？

多くの AI コーディングツールはターミナルで動きます：**Claude Code、Codex、Antigravity、opencode** など。複数を併用していると、切り替えが面倒です。

**CLI Code** は、それらすべてをショートカット一つの距離に置きます：

- キーを押す → アシスタントを選ぶ → **エディタの隣**のターミナルで開きます。
- 各アシスタントはターミナルタブに**独自のアイコン**を表示します（アイコンは [Orca](https://github.com/stablyai/orca) より）。
- 別のキーを押す → **今見ているファイル**（と選択した行）がアシスタントのプロンプトに入ります。コピペ不要。

## はじめに

### 1. インストール

VS Code で**拡張機能**ビュー（`Cmd/Ctrl + Shift + X`）を開き、**CLI Code** を検索して **Install** をクリックします。

![VS Code マーケットプレイスの CLI Code](images/screenshots/marketplace.png)

### 2. 使いたいアシスタントをインストール

CLI Code はアシスタントを**起動するだけ**で、インストールはしません。使いたいアシスタントがインストール済みで、ターミナルから実行できることを確認してください。標準で以下を認識します：

| アシスタント                                                                                           | ターミナルコマンド           |
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

> ⚠️ **インストール*して*、先にログインを。** ほとんどのアシスタントは実行前に
> 認証が必要です —— `claude`（Anthropic アカウントにログイン）、`codex`（OpenAI
> ログイン / API キー）など。各ツールを通常の
> ターミナルで一度実行し、ログインを済ませ、起動できることを確認してください。
>
> 💡 ヒント：通常のターミナルで打って動くコマンドなら、ここでも動きます。

### 🚨 アシスタントは承認プロンプトを無効化した状態で起動します

各 CLI はそれぞれの権限バイパスフラグ付きで起動されます（`claude --dangerously-skip-permissions`、
`codex --dangerously-bypass-approvals-and-sandbox` など）。そのためアシスタントは
**確認を求めずに**コマンドを実行し、ファイルを編集します。高速ですが、信頼できない
リポジトリがアシスタントを破壊的な操作やデータ漏洩に誘導できることを意味します。
信頼できるコードでのみ CLI Code を使うか、通常のターミナルから自分で起動してください。

## 使い方

### アシスタントを開く

**`Cmd + Esc`**（macOS）または **`Ctrl + Esc`**（Windows / Linux）を押します。

すべてのアシスタントを並べたメニューが開きます。1 つ選ぶと、隣のターミナルで開いて実行を始めます。そのアシスタントが既に開いている場合、ショートカットはそのターミナルに戻るだけです。

![すべてのアシスタントを並べた CLI ピッカー](images/screenshots/picker-highlighted.png)

> 開いているものを再利用せず、まっさらなセッションが欲しい？ **`Cmd/Ctrl + Shift + Esc`** を使ってください。

エディタのツールバーからも開けます —— CLI Code アイコン（丸で囲んだもの）を探してください：

![エディタのツールバーにある CLI Code アイコン](images/screenshots/toolbar-highlighted.png)

### 作業中のファイルを送る

1. ファイル内をクリック（任意で**数行を選択**）。
2. アシスタントのターミナルをクリックしてフォーカス。
3. **`Cmd + Alt + K`**（macOS）または **`Ctrl + Alt + K`**（Windows / Linux）を押します。

CLI Code がファイルへの参照をプロンプトに挿入します：

| あなたの操作     | 挿入される内容       |
| ---------------- | -------------------- |
| ファイルを開いた | `@src/app.ts`        |
| 1 行を選択した   | `@src/app.ts#L10`    |
| 複数行を選択した | `@src/app.ts#L10-20` |

あとは質問を入力するだけ —— アシスタントはどのファイル（とどの行）の話か既に分かっています。

## 専用ターミナル（0.2.0）

0.2.0 から、CLI Code は通常の VS Code 統合ターミナルではアシスタントを開かなくなりました —— 各アシスタントは**拡張機能専用のターミナル**、つまりバックグラウンドで動く PTY デーモンに接続された webview パネルで開きます。これにより：

- 各アシスタントのターミナルタブに**カラーアイコン**が付きます。
- **タブのタイトルが自動更新**され、直前に入力したプロンプトが反映されます（手動リネーム不要）。
- タブのタイトルに**エージェントの状態**（実行中 / 応答待ち / 完了）がそのまま表示されます。
- セッションは**ウィンドウの再読み込みをまたいで生き続けます**：再読み込み後、ターミナルは実行中の CLI セッションへ自動的に再接続され、何も失われません。

### 制限

- **タブを閉じる＝その CLI の終了。** VS Code は拡張機能に「タブを閉じる前に確認する」ことを許さないため、タブを閉じると中の CLI プロセスは警告なく即座に停止します。
- **VS Code を終了する＝すべてのセッションの終了。** CLI Code 配下で動いているすべての CLI が一緒に停止します。
- **Claude の状態フックは POSIX（macOS、Linux）でのみ動作します** —— Windows ではこのフックをインストールできません。

### Claude Code の状態フック

CLI Code は Claude Code に小さなフックをインストールし、タイトルからの推測ではなく正確な状態（実行中 / 応答待ち / 完了）をタブに表示できます。これは**オプトイン**の機能です：

- CLI Code 内で Claude Code を初めて開いたとき、拡張機能はフックをインストールするか尋ねます（`cliCode.claudeStatusHooks` 設定で制御）。答えずに通知を閉じると、このウィンドウでは「off」として扱われます。後からコマンドパレットの **「CLI Code: Cài hook trạng thái Claude」**（Claude 状態フックをインストール）でインストールできます。
- 同意すると `~/.claude/settings.json` に追記します。最初の書き込み前に、元のファイルは `~/.claude/settings.json.cli-code.bak` にバックアップされ、既存のフックはそのまま保持されます。
- フックは次に Claude Code を起動したときから有効になります。すでに実行中のセッションはタイトルからの推測のままです。
- いつでもコマンドパレットの **「CLI Code: Gỡ hook trạng thái Claude」**（Claude 状態フックを削除）で削除できます。
- 既知の制限：フックコマンドはシェルで `eval` されるため（`eval "$CLI_CODE_HOOK"`）、VS Code のインストールパスに `"` や `$` が含まれると動作しません。
- `UserPromptSubmit`、`Stop`、`Notification`、`PermissionRequest` の 4 つのイベントそれぞれに追加されるエントリ：

  ```json
  {
    "type": "command",
    "command": "[ -n \"$CLI_CODE_HOOK\" ] && eval \"$CLI_CODE_HOOK\" || true"
  }
  ```

  Claude Code が CLI Code の外で実行されている場合、このコマンドは何もしません（`CLI_CODE_HOOK` 変数が存在しないため）。

### 設定

| 設定                          | 型                          | デフォルト | 説明                                                                                    |
| ------------------------------ | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `cliCode.claudeStatusHooks`    | `"ask" \| "on" \| "off"`     | `"ask"`    | `~/.claude/settings.json` に状態フックをインストールし、Claude タブに実行中/応答待ち/完了を表示。 |
| `cliCode.notifications`        | `boolean`                    | `true`     | 非表示のタブでエージェントが作業を終えたときに通知する。                                    |
| `cliCode.quickCommands`        | オブジェクトの配列           | `[]`       | 再利用するコマンドやプロンプト。User settings = グローバル、Workspace settings = プロジェクト。 |

`cliCode.quickCommands` の例：

```json
"cliCode.quickCommands": [
  { "label": "テスト実行", "text": "npm test" },
  { "label": "PR を要約", "text": "この PR の変更点を要約して", "submit": true }
]
```

### パスリンク

CLI が出力したパス（`src/x.ts:12:3`、`./dir`、`~/notes.md`、`README`、`file://…`）は、ディスク上に存在する場合のみリンクになります。`Cmd/Ctrl + クリック` でファイルはエディタ（Markdown はプレビュー、HTML はブラウザ）、**フォルダは Finder / Explorer** で開き、`Shift + Cmd/Ctrl + クリック` は既定のアプリで開きます。

### ターミナルの右クリックメニュー

メニュー項目はコマンドのベトナム語タイトルで表示されます：**Sao chép**（コピー）、**Dán**（貼り付け）、**Chọn tất cả**（すべて選択）、**Sao chép ngữ cảnh**（コンテキストをコピー）、**Xoá màn hình**（クリア）、**Đổi tên tab**（タブ名を変更）、**Khởi động lại phiên**（セッションを再起動）、**Tìm trong terminal**（ターミナル内検索）、**Mở lại phiên cũ**（過去のセッションを再開）、**Lệnh nhanh**（クイックコマンド）。

### コマンドパレットのコマンド

0.2.0 のコマンドはベトナム語タイトルで登録されています（括弧内は日本語訳）：

`CLI Code:` **Mở lại phiên cũ**（過去のセッションを再開）、**Lệnh nhanh**（クイックコマンド）、**Lưu thành lệnh nhanh**（クイックコマンドとして保存）、**Đổi tên tab**（タブ名を変更）、**Khởi động lại phiên**（セッションを再起動）、**Xoá màn hình**（クリア）、**Phóng to chữ**（文字を拡大）、**Thu nhỏ chữ**（文字を縮小）、**Cỡ chữ mặc định**（文字サイズをリセット）、**Tìm trong terminal**（ターミナル内検索）、**Sao chép ngữ cảnh**（コンテキストをコピー）、**Dán**（貼り付け）、**Sao chép**（コピー）、**Cài hook trạng thái Claude**（Claude 状態フックをインストール）、**Gỡ hook trạng thái Claude**（Claude 状態フックを削除）。

## キーボードショートカット

| 操作                             | macOS                | Windows / Linux        |
| ---------------------------------- | --------------------- | ------------------------ |
| アシスタントを開く / フォーカス    | `Cmd + Esc`           | `Ctrl + Esc`             |
| 新しいターミナルで開く             | `Cmd + Shift + Esc`   | `Ctrl + Shift + Esc`     |
| 現在のファイルを送る               | `Cmd + Alt + K`       | `Ctrl + Alt + K`         |
| プロンプトで改行                   | `Shift + Enter`       | `Shift + Enter`         |
| ターミナル内検索                   | `Cmd + F`             | `Ctrl + F` \*           |
| 文字を拡大                         | `Cmd + =`             | `Ctrl + =`               |
| 文字を縮小                         | `Cmd + -`             | `Ctrl + -`               |
| 文字サイズをリセット               | `Cmd + 0`             | `Ctrl + 0`               |

\* Windows / Linux ではフォーカス中のターミナルが `Ctrl + F` を消費します（xterm が `^F` として CLI に送ります）。代わりにコマンドパレットの **「CLI Code: Tìm trong terminal」** か右クリックの **Tìm trong terminal** を使ってください。

## よくある質問

**アシスタントは開くが、ログインを求められる。**
これは想定どおりです —— CLI Code はツールを起動するだけで、認証は扱いません。そのアシスタント自身のログインを一度（どのターミナルでも）完了してください。以降は記憶されます。

**`Cmd + Alt + K` を押しても何も起きない。**
（1）エディタにファイルが開いていること、（2）アシスタントのターミナルがフォーカスされていることを確認してください。ファイル参照はアクティブな CLI ターミナルに入ります。

**ショートカットが他の機能と衝突する。**
VS Code で再割り当てします：**Preferences → Keyboard Shortcuts** で "CLI" を検索し、好きなキーを設定してください。

## ライセンス

[MIT](LICENSE) © 2026 Thanh Luan
