# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · **日本語**

📖 [User Guide (English)](docs/user-guide.md) · [Changelog](CHANGELOG.md)

> **VS Code のためのエージェント用ターミナル。** Claude Code、Codex、Copilot、opencode、Pi、Grok、Droid など 28 のコーディングエージェントを、エージェントを理解するタブで動かします：何をしているかを表示し、言及したものを開き、リロードしてもセッションを保ち、同じ会話に再起動します。

![複数の AI CLI を VS Code で横に並べて実行](images/screenshots/terminals.png)

## なぜ

本格的なコーディングエージェントはどれもターミナルプログラムです。普通のターミナルタブで動かすと、そのタブは何も知りません：エージェントが承認待ちなのか分からず、どのファイルを直したのかも知らず、リロードで死に、再起動すれば会話を忘れます。

CLI Code はそのタブを、エージェントのために作られたインターフェースに置き換えます — アクションバー、ライブな状態、クリックできる出力、枠内の通知を備えた独自の webview ターミナル — エージェント自体はそのまま：同じ CLI、同じシェル、同じ MCP サーバーとプラグイン。

## 得られるもの

**エージェントの状態を知るタブ。** 依頼した内容でタブ名が変わり、印が付きます：`⟳` 作業中、`?` あなた待ち、`●` 別タブにいる間に完了。非表示タブのエージェントがあなたを必要とすると、*Open tab* ボタン付きの通知が届きます。ターミナル上のアクションバーには使用中のモデルが表示されます。

**素のターミナルではなく、エージェントを囲むインターフェース。** ターミナルの上には Claude の視覚言語に合わせた静かなアクションバー：New Session（エージェントピッカー付き）、Resume、Restart、Find、そして `…` メニュー（Rename、Copy Context、Quick Command）。左側には使用中のモデル、エージェントがあなたを待つ間のステータス行、実行中のエージェントが設定より古いときの *"… changed — restart to apply"* 通知。リンクにホバーすると何が開くかを表示；検索は大文字小文字の区別と正規表現に対応；エージェントが終了すると Restart ボタン付きのオーバーレイ、プロセスが消えると *session ended* ページ。フォントと色は VS Code のテーマに従い、ターミナル下にチャット風コンポーザーを置くこともできます。

**エージェントが出力したものはすべてクリック可能。** ファイルパスはエディタで正確な行・列に、フォルダはエクスプローラー（ワークスペース外なら Finder/Explorer）に、URL はブラウザに、Markdown はプレビューに開きます。実在するパスだけが下線付きになります。ただのクリックでリンク全体が選択され `Cmd/Ctrl + C` でコピー。Claude Code がマウスを掴んでいる間も選択とコピーは動きます。

**生き残るセッション。** エージェントはバックグラウンドのデーモン下で動くため、*Reload Window* は各タブをスクロールバック・タイトル・状態ごと再接続します。新しいプロセスが本当に必要なとき — MCP サーバー追加、プラグイン、アップデート — は *Restart Session* が 28 のうち 19 のエージェントを正確に同じ会話へ戻し、設定が変わったタブはアイドル時に自動で再起動します。

**ショートカット一つ、本物のシェル。** `Cmd/Ctrl + Esc` で 28 のエージェントのどれでも、エディタの隣、プロジェクトフォルダで、対話型ログインシェルの中に開きます — `PATH`、nvm、pnpm、MCP サーバー、すべてターミナルと同じ。`Cmd/Ctrl + Alt + K` で今見ているファイルが `@src/app.ts#L10-20` としてプロンプトに入ります。

**そして細かいこと。** 過去セッションの再開、クイックコマンド（設定から、または選択範囲から保存）、最後の 200 行をコンテキストとしてコピー、ターミナル内検索、タブごとのズーム、`Shift + Enter` で改行、文脈に応じた右クリックメニュー、色付きのエージェントアイコン。

仕組み：CLI Code は各エージェント自身の設定に小さな*状態フック*を入れます（Claude Code、Codex、Copilot、Droid、Grok、opencode、Kilo、MiMo、Pi、OMP）。CLI Code の外では何もしないシェル 1 行を実行し、ファイルは先にバックアップされ、設定一つで全部削除できます。詳細は [User Guide](docs/user-guide.md#16-status-hooks-what-lets-a-tab-know-what-the-agent-is-doing)。

## 仕組み

CLI Code は VS Code の統合ターミナルを**使いません**。各エージェントは**拡張機能独自の webview パネル**で開きます — ターミナル（xterm.js）を描画し、その周りにアクションバー、状態の印、リンクのツールチップ、検索バー、通知を配置したエディタタブです。エージェントのプロセス自体は VS Code ウィンドウに属する**バックグラウンドのデーモン**で動くため、*Reload Window* は殺さずに再接続します。

あなたにとっての意味：

- タブはエディタタブとして振る舞います：任意の列へドラッグ、分割、ピン留め、エージェントごとに複数タブ。ターミナルパネルには現れません。
- VS Code の `terminal.*` 設定とターミナルのショートカットは適用されません；CLI Code は `editor.fontFamily` / `editor.fontSize`、あなたのカラーテーマ、そして CLI Code のタブにフォーカスがある間だけ有効な独自ショートカット（下記）を使います。
- エージェントは変更なしに、あなたの対話型ログインシェルの中で、本物の `PATH`、MCP サーバー、プラグインと共に動きます。

## クイックスタート

1. Marketplace から**インストール**（`Cmd/Ctrl + Shift + X` → *CLI Code*）。VS Code 1.94 以上、全機能は macOS / Linux。
2. 使うエージェントを普通のターミナルで**インストールしてログイン**（`claude`、`codex`、`copilot`、`opencode`…）。CLI Code は起動するだけで、インストールはしません。ターミナルで動くコマンドはここでも動きます。
3. **`Cmd/Ctrl + Esc`** を押してエージェントを選び、入力を始めます。エディタで `Cmd/Ctrl + Alt + K` を押すと現在のファイルを渡せます。

> ⚠️ エージェントは承認プロンプトを**無効化**して起動されます（`claude --dangerously-skip-permissions`、`codex --dangerously-bypass-approvals-and-sandbox`、`copilot --yolo` …）。ファイル編集やコマンド実行を確認なしに行います — 信頼できるリポジトリで使うか、プロンプトが欲しいときは普通のターミナルから起動してください。

## 対応エージェント

| エージェント | コマンド | タブの状態 | 再起動 → 同じ会話 | モデル表示 |
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

*タブの状態*には状態フックが必要で、最初の 11 に存在します。*再起動 → 同じ会話* ✓ は正確に同じセッションを再開、`--continue` はエージェント自身の「最新セッション」フラグを使用。*モデル表示*：アクションバーがエージェントのセッションファイルからモデルを読めます。ピッカーは `PATH` 上のエージェントを先に表示します。

## 日々の使い方

**開く、ファイルを渡す。** `Cmd/Ctrl + Esc` でエージェントを開く／フォーカス、`Cmd/Ctrl + Shift + Esc` でもう一つのタブ、*New Session* ボタンで現在のタブのフォルダに開く。`Cmd/Ctrl + Alt + K` はエディタのファイルと選択範囲に応じて `@path`、`@path#L10`、`@path#L10-20` を挿入します。

**タブを読む。** タイトル = 自分で付けた名前（`F2`）› 開いたクイックコマンド › エージェント自身のタイトル（整形済み）› 最後のプロンプト（40 文字、語の境界で切断）› エージェント名。印：`⟳` 作業中 · `?` あなた待ち · `●` 非表示中に完了。

**出力をクリック。** `Cmd/Ctrl + click` でファイル（`行:列`）、フォルダ、URL を開く；`Shift + Cmd/Ctrl + click` で既定アプリ；ホバーで対象を表示。右クリックには *Open File / Open Folder / Open Link*、*Open with Default App*、*Insert @path into CLI*、*Copy Link / Path*、*Find Selection*、および *Copy / Paste / Select All / Find in Terminal*。

**会話を保つ。** *Reload Window* はすべて保持。*Restart Session*（↻）は同じ会話に再起動 — フックが報告したセッション ID、なければこのフォルダのエージェント自身のストアの最新セッション、なければエージェントの `--continue`。*Resume Session* は過去セッション（Claude Code、Codex、Grok）を一覧し、残りには *Continue latest session* を提供。MCP/プラグイン/フックのファイルが変わるとアイドルなタブは自動再起動し、作業中のタブは ↻ を押すまで *"… changed — restart to apply"* を表示。*Restart All Sessions* で全タブ。

**クイックコマンド。** `cliCode.quickCommands`（User または Workspace 設定）にプロンプトを保存するか、テキストを選択して *Save as Quick Command*；アクションバーの `…` メニューから実行。一つのペーストとして届き、`"submit": false` でなければ Enter が続きます。

## ショートカット・コマンド・設定

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| エージェントを開く / フォーカス | `Cmd + Esc` | `Ctrl + Esc` |
| 新しいタブで開く | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 現在のファイルを `@path` として挿入 | `Cmd + Alt + K` | `Ctrl + Alt + K` |
| プロンプト内で改行 | `Shift + Enter` | `Shift + Enter` |
| ターミナル内検索 | `Cmd + F` | `Ctrl + F` \* |
| ズームイン / アウト / リセット | `Cmd + =` / `-` / `0` | `Ctrl + =` / `-` / `0` |
| タブ名を変更 | `F2` | `F2` |

\* Windows/Linux ではターミナルが `Ctrl + F` をエージェントに渡します — パレットか右クリックを使ってください。ターミナルのショートカットは CLI Code のタブでのみ有効です。

コマンドパレット（`CLI Code:`）：New Session · Resume Session · Restart Session · Restart All Sessions · Quick Command · Save as Quick Command · Rename Tab · Find in Terminal · Copy Context · Copy · Paste · Select All · Zoom In / Out / Reset · Install Status Hooks · Remove Status Hooks — さらに *Open CLI*、*Open CLI in new tab*、*CLI: Insert At-Mentioned*。

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `cliCode.statusHooks` | `true` | `PATH` 上の対応エージェント全部に状態フックを常駐；`false` で削除。 |
| `cliCode.notifications` | `true` | 見ていないタブでエージェントが完了／待機し始めたら通知。 |
| `cliCode.quickCommands` | `[]` | `{ "label", "text", "submit"? }` の配列；User 設定 = 全体、Workspace 設定 = プロジェクト。 |
| `cliCode.composer` | `false` | ターミナル下のチャット風入力（実験的；新しいタブに適用）。 |

## CLI Code が触れるもの

- **書き込み**：各エージェント自身の設定への状態フック（`~/.claude/settings.json`、`~/.factory/settings.json`、`~/.codex/hooks.json` + `config.toml` の信頼エントリ、`~/.copilot/hooks/cli-code.json`、`~/.grok/hooks/cli-code.json`、opencode/Kilo/MiMo 用の生成プラグインと Pi/OMP 用の拡張 `cli-code-status.ts`）。各ファイルは `<file>.cli-code.bak` として一度バックアップ。自分のフックはそのまま；`cliCode.statusHooks: false` ですべて削除。
- **読み取り**：セッション ID・タイトル・モデルを探すためのエージェントのセッションストア、古いタブを検出するための MCP/プラグイン/フックファイルの更新時刻。
- **ネットワークなし**：CLI Code 経由でデータが外に出ることはありません。

## 制限

- タブを閉じるとその中のエージェントが終了します（VS Code は事前に確認できません）；VS Code の終了で全セッションが終了。Reload Window は終了しません。
- 状態フックと対話型シェル起動は POSIX（macOS、Linux）のみ。Windows ではタブは動きますが状態の印は出ません。
- 9 つのエージェントにはアドレス可能なセッションがなく、`--continue` フラグで再起動します（表を参照）。

## FAQ

**エージェントにログインを求められる。** 想定どおり — CLI Code は起動するだけです。任意のターミナルで一度ログインしてください。

**`Cmd + Alt + K` で何も起きない。** エディタでファイルが開いていて、エージェントのタブにフォーカスがある必要があります。

**ショートカットが他の拡張機能と衝突する。** *Preferences → Keyboard Shortcuts* で「CLI Code」を検索して変更してください。

**VS Code のターミナルは使い続けられる？** はい — CLI Code は自分が開いたタブだけを管理します。

## 開発

- `bun test` — ユニットテスト。
- `bun run test:integration` — 本物の VS Code Extension Host（`.vscode-test/` に一度だけダウンロード）：開く/入力/閉じる、gone/再起動、フック → 状態、resume とクイックコマンド、二段階リロード。macOS/Linux；本物のフックファイルには決して書きません — ランナーがスナップショットを取り、変化すれば失敗します。
- `node test/e2e/status-hooks.mjs [agent…]` — マシンにインストール済みのエージェントに対するエンドツーエンド（各 1 回のモデル呼び出し）。
- `bun run package:target <platform>` — 一つのターゲットの VSIX；`bun run package:all` で全 6 ターゲット。

エージェントのアイコンは [Orca](https://github.com/stablyai/orca) 由来です。

## ライセンス

[MIT](LICENSE) © 2026 Thanh Luan
