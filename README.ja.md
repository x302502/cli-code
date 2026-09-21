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
- **タブのタイトルが自動更新**され、直前に入力したプロンプトが反映されます（手動リネーム不要）。Orca と同じ規則：最初の節だけ、URL と Markdown 記号は除去、最大 40 文字で切れる場合は `…`。
- タブのタイトルに**エージェントの状態**（実行中 / 応答待ち / 完了）がそのまま表示されます。
- セッションは**ウィンドウの再読み込みをまたいで生き続けます**：再読み込み後、ターミナルは実行中の CLI セッションへ自動的に再接続され、何も失われません。

### 制限

- **タブを閉じる＝その CLI の終了。** VS Code は拡張機能に「タブを閉じる前に確認する」ことを許さないため、タブを閉じると中の CLI プロセスは警告なく即座に停止します。
- **VS Code を終了する＝すべてのセッションの終了。** CLI Code 配下で動いているすべての CLI が一緒に停止します。
- **状態フックは POSIX（macOS、Linux）でのみ動作します** —— Windows ではインストールできません。

### 状態フック

CLI Code は対応する各 CLI に小さなフックを常駐させ、タブがタイトルからの推測ではなく正確な状態（作業中 / 待機中 / 完了）を表示し、非表示タブの「完了」通知が届き、**Restart Session** が戻るべき会話を正確に把握できるようにします。Orca と同じく**自動**です：起動時に `PATH` 上にある対応 CLI にフックが無ければインストールし、`cliCode.statusHooks` をオフにすると全て削除します。

| CLI | フックの場所 |
| --- | --- |
| Claude Code | `~/.claude/settings.json` → `hooks`（UserPromptSubmit, Stop, Notification, PermissionRequest） |
| Droid | `~/.factory/settings.json` → `hooks` |
| Codex | `~/.codex/hooks.json` → `hooks`、および対応する `[hooks.state.…]` の信頼エントリ（`~/.codex/config.toml`。Codex は信頼済みフックしか実行しません） |
| GitHub Copilot | `~/.copilot/hooks/cli-code.json`（専用ファイル） |
| Grok | `~/.grok/hooks/cli-code.json`（専用ファイル） |
| opencode / Kilo / MiMo | `~/.config/opencode|kilo|mimocode/plugins/cli-code-status.ts`（生成されたプラグイン） |
| Pi / OMP | `~/.pi/agent/extensions/cli-code-status.ts`、`~/.omp/agent/extensions/cli-code-status.ts`（生成された拡張） |

- 既存ファイルへの最初の書き込み前に `<file>.cli-code.bak` としてバックアップします。自分で設定したフックはそのまま、CLI Code 自身のエントリだけを追加・削除します。生成ファイルは `// @cli-code-managed` で始まり、そのヘッダーが無ければ決して上書きしません。
- どのエントリも同じシェル行を実行し、CLI Code の外で動く CLI では no-op です（`CLI_CODE_HOOK` 変数が存在しないため）：

  ```sh
  [ -n "$CLI_CODE_HOOK" ] && eval "$CLI_CODE_HOOK" || true
  ```

  生成プラグインはシェルフックが受け取るのと同じ JSON ペイロードを組み立て、その行にパイプします。
- フックはその CLI の次回起動から有効です。CLI Code はタブの CLI がその設定（MCP サーバー・プラグイン・フック。上表のファイルと各 CLI の MCP 設定を、Reload Window 後・タブ表示時・拡張機能更新後に確認）より古いことを検知します：アイドルなタブは自動で同じ会話に再起動し、作業中のタブはアクションバーに *"… changed — restart to apply"* を表示して再起動を待ちます。**「CLI Code: Restart All Sessions」** で全タブを一度に再起動できます。
- コマンドパレットの **「CLI Code: Install Status Hooks」** / **「Remove Status Hooks」** で手動でも実行でき、結果の要約を表示します。
- POSIX のみ（macOS、Linux）：Windows にはフック行を評価する `sh` が無いため何もインストールしません。
- 既知の制限：フックコマンドはシェルで `eval` されるため、VS Code のインストールパスに `"` や `$` が含まれると動きません。

### 設定

| 設定                          | 型                          | デフォルト | 説明                                                                                    |
| ------------------------------ | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `cliCode.statusHooks`          | `boolean`                    | `true`     | 対応する全 CLI に状態フックを常駐させる（「状態フック」参照）。オフで全て削除。 |
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

CLI が出力したパス（`src/x.ts:12:3`、`./dir`、`~/notes.md`、`README`、`file://…`）は、ディスク上に存在する場合のみリンクになります。`Cmd/Ctrl + クリック` でファイルはエディタ（Markdown はプレビュー、HTML はブラウザ）、**フォルダ**はワークスペース内なら VS Code のエクスプローラーで、外なら Finder / Explorer で開き、`Shift + Cmd/Ctrl + クリック` は既定のアプリで開きます。通常のクリックはリンク全体を選択するので、そのまま `Cmd/Ctrl + C` でコピーできます。 ドラッグは CLI がマウスを捕捉していても常にテキストを選択します（Claude Code などの TUI）。CLI にマウスを渡したい場合は `Option`（macOS）／`Shift`（その他）を押しながらドラッグします。

### ターミナルの右クリックメニュー

**Restart Session**（再起動）はタブを*同じ会話*に戻します：状態フックのある CLI（Claude Code・Codex・Copilot・Droid・Grok・opencode・Kilo・MiMo・Pi・OMP）はフックが報告するセッション ID、Command Code・Prime Agent・Cline・Kimi・Cursor・Amp・Antigravity・goose は各 CLI 自身のセッションストアにあるこのディレクトリの最新セッション、残りの CLI は `--continue` 形式で。何も分からない場合のみ新規セッションになります。

右クリックはポインタ下の内容や選択範囲に対して働きます：**Copy**（コピー、選択時）・**Paste**（貼り付け）・**Select All**（すべて選択）・URL 上では **Open Link**（リンクを開く）／ファイル上では **Open File**（ファイルを開く）、**Open with Default App**（既定アプリで開く）、**Insert @path into CLI**（@パスを CLI に挿入）／フォルダ上では **Open Folder**（フォルダを開く）・**Copy Link / Path**（リンク/パスをコピー）・**Find Selection**（選択範囲を検索）・**Find in Terminal**（ターミナル内検索）。タブ操作はターミナル上部の静かなバー（同じ背景色、アイコンは右端）にあります：**New Session**（新しいセッション — CLI を選んでこのタブのディレクトリで開く）、**Resume Session**（履歴）、**Restart Session**（再起動）、**Find**（検索）、**…** に **Rename Tab**（タブ名変更、`F2`）、**Copy Context**（コンテキストをコピー）、**Quick Command**（クイックコマンド）。バーの左側はエージェントが確認を求めるときだけ文言が出ます。 左側には CLI が使用中の**モデル**（各 CLI のセッションストアから読み取り — Claude、Codex、Grok、Pi、OMP、opencode/MiMo/Kilo、Cline。記録しない CLI では非表示）と、確認待ちのときの状態行が表示されます。 実験的なチャット風**入力欄**（入力・貼り付け、`Enter` で一括送信、`Shift + Enter` で改行）は `cliCode.composer: true` で有効化できます。既定では無効で、CLI 自身の入力欄の `/` や `@` メニューをそのまま使えます。リンクにホバーすると `Cmd/Ctrl + クリック` で何が開くかと解決済みパスが表示されます。

### コマンドパレットのコマンド

0.2.0 のコマンドはベトナム語タイトルで登録されています（括弧内は日本語訳）：

`CLI Code:` **Resume Session**（過去のセッションを再開）、**Quick Command**（クイックコマンド）、**Save as Quick Command**（クイックコマンドとして保存）、**Rename Tab**（タブ名を変更）、**Restart Session**（セッションを再起動）、**Zoom In**（文字を拡大）、**Zoom Out**（文字を縮小）、**Reset Zoom**（文字サイズをリセット）、**Find in Terminal**（ターミナル内検索）、**Copy Context**（コンテキストをコピー）、**Paste**（貼り付け）、**Copy**（コピー）、**Install Status Hooks**（Claude 状態フックをインストール）、**Remove Status Hooks**（Claude 状態フックを削除）。

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

\* Windows / Linux ではフォーカス中のターミナルが `Ctrl + F` を消費します（xterm が `^F` として CLI に送ります）。代わりにコマンドパレットの **「CLI Code: Find in Terminal」** か右クリックの **Find in Terminal** を使ってください。

## よくある質問

**アシスタントは開くが、ログインを求められる。**
これは想定どおりです —— CLI Code はツールを起動するだけで、認証は扱いません。そのアシスタント自身のログインを一度（どのターミナルでも）完了してください。以降は記憶されます。

**`Cmd + Alt + K` を押しても何も起きない。**
（1）エディタにファイルが開いていること、（2）アシスタントのターミナルがフォーカスされていることを確認してください。ファイル参照はアクティブな CLI ターミナルに入ります。

**ショートカットが他の機能と衝突する。**
VS Code で再割り当てします：**Preferences → Keyboard Shortcuts** で "CLI" を検索し、好きなキーを設定してください。

## ライセンス

[MIT](LICENSE) © 2026 Thanh Luan
