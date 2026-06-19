# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · **日本語**

> お気に入りの AI コーディングアシスタントをコードの隣のターミナルで開き、今見ているファイルをショートカット一つでそのまま送り込めます。

![複数の AI CLI を VS Code で横に並べて実行](images/screenshots/terminals.png)

## これは何をするもの？

多くの AI コーディングツールはターミナルで動きます：**Claude Code、Codex、Gemini、opencode** など。複数を併用していると、切り替えが面倒です。

**CLI Code** は、それらすべてをショートカット一つの距離に置きます：

- キーを押す → アシスタントを選ぶ → **エディタの隣**のターミナルで開きます。
- 別のキーを押す → **今見ているファイル**（と選択した行）がアシスタントのプロンプトに入ります。コピペ不要。

## はじめに

### 1. インストール

VS Code で**拡張機能**ビュー（`Cmd/Ctrl + Shift + X`）を開き、**CLI Code** を検索して **Install** をクリックします。

![VS Code マーケットプレイスの CLI Code](images/screenshots/marketplace.png)

### 2. 使いたいアシスタントをインストール

CLI Code はアシスタントを**起動するだけ**で、インストールはしません。使いたいアシスタントがインストール済みで、ターミナルから実行できることを確認してください。標準で以下を認識します：

| アシスタント                                                                               | ターミナルコマンド |
| ------------------------------------------------------------------------------------------ | ------------------ |
| [Claude Code](https://code.claude.com/docs/en/setup)                                       | `claude`           |
| [Codex CLI](https://developers.openai.com/codex/cli)                                       | `codex`            |
| [Mimo](https://github.com/XiaomiMiMo/MiMo-Code)                                            | `mimo`             |
| [Antigravity](https://antigravity.google)                                                  | `agy`              |
| [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) | `copilot`          |
| [opencode](https://opencode.ai)                                                            | `opencode`         |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)                                  | `gemini`           |
| [Amp](https://ampcode.com)                                                                 | `amp`              |
| [Droid](https://docs.factory.ai/cli/getting-started/quickstart)                            | `droid`            |
| [Kiro CLI](https://kiro.dev)                                                               | `kiro-cli`         |
| [CommandCode](https://github.com/just-every/code)                                          | `commandcode`      |

> ⚠️ **インストール*して*、先にログインを。** ほとんどのアシスタントは実行前に
> 認証が必要です —— `claude`（Anthropic アカウントにログイン）、`codex`（OpenAI
> ログイン / API キー）、`gemini`（Google ログイン）など。各ツールを通常の
> ターミナルで一度実行し、ログインを済ませ、起動できることを確認してください。
>
> 💡 ヒント：通常のターミナルで打って動くコマンドなら、ここでも動きます。

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

## キーボードショートカット

| 操作                            | macOS               | Windows / Linux      |
| ------------------------------- | ------------------- | -------------------- |
| アシスタントを開く / フォーカス | `Cmd + Esc`         | `Ctrl + Esc`         |
| 新しいターミナルで開く          | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 現在のファイルを送る            | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

3 つともコマンドパレット（`Cmd/Ctrl + Shift + P`）にもあります：**Open CLI**、**Open CLI in new tab**、**CLI: Insert At-Mentioned**。

## よくある質問

**メニューは開くが、ターミナルに "command not found" と出る。**
そのアシスタントが未インストール、または `PATH` にありません。通常のターミナルでコマンド（例: `claude`）が動くか確認してください。動かなければ、まずそのツールをインストールしてください。

**アシスタントは開くが、ログインを求められる。**
これは想定どおりです —— CLI Code はツールを起動するだけで、認証は扱いません。そのアシスタント自身のログインを一度（どのターミナルでも）完了してください。以降は記憶されます。

**`Cmd + Alt + K` を押しても何も起きない。**
（1）エディタにファイルが開いていること、（2）アシスタントのターミナルがフォーカスされていることを確認してください。ファイル参照はアクティブな CLI ターミナルに入ります。

**ショートカットが他の機能と衝突する。**
VS Code で再割り当てします：**Preferences → Keyboard Shortcuts** で "CLI" を検索し、好きなキーを設定してください。

## ライセンス

[MIT](LICENSE) © 2026 Thanh Luan
