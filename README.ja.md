# CLI Code

[English](README.md) · [Tiếng Việt](README.vi.md) · [中文](README.zh.md) · **日本語**

> VS Code のサイドターミナル内で AI コーディング CLI（Claude Code、Codex、Gemini、opencode など）を起動・切り替えし、今見ているファイルを実行中のエージェントへそのまま送信できます。

## なぜ CLI Code なのか？

ターミナルベースの AI コーディングエージェントを使っていると、複数を同時に扱うことが多いはずです。CLI Code は**ワンキー**で任意のエージェントを選び、エディタの隣のターミナルで起動し、**現在のファイル（選択行付き）**をコピー＆ペーストなしでエージェントのプロンプトへ送り込みます。

## 機能

- 🚀 **ワンキー起動** —— ショートカットを押して CLI を選ぶと、コードの隣のターミナルで開きます。
- 🔁 **再利用または新規タブ** —— 起動済みの CLI にフォーカス、または常に新規起動。
- 📎 **現在のファイルを送信** —— `@path/to/file.ts#L10-20`（選択範囲付き）をフォーカス中の CLI に挿入。
- 🌐 **HTTP 対応 CLI** —— ローカル API を公開するエージェント（例: opencode）では、入力ではなくポート経由で送信します。
- 🐝 **11 個の CLI を標準搭載** —— 数行の設定で独自の CLI を追加できます。

## 対応 CLI

| #   | CLI                | コマンド                              |
| --- | ------------------ | ------------------------------------- |
| 1   | Claude Code        | `claude`                              |
| 2   | Codex CLI          | `codex`                               |
| 3   | Mimo               | `mimo`                                |
| 4   | opencode           | `opencode --port {port}`（HTTP 対応） |
| 5   | Gemini CLI         | `gemini`                              |
| 6   | GitHub Copilot CLI | `copilot`                             |
| 7   | Amp                | `amp`                                 |
| 8   | Droid              | `droid`                               |
| 9   | Kiro CLI           | `kiro-cli`                            |
| 10  | Antigravity        | `agy`                                 |
| 11  | CommandCode        | `commandcode`                         |

> 各 CLI はインストール済みで `PATH` に通っている必要があります。CLI Code はコマンドを起動するだけで、エージェントの**インストールは行いません**。

## インストール

**マーケットプレイスから** —— 拡張機能ビュー（`Cmd/Ctrl + Shift + X`）で **「CLI Code」** を検索、または：

```bash
code --install-extension x302502.cli-code
```

**`.vsix` ファイルから：**

```bash
code --install-extension cli-code-0.1.0.vsix
```

## 使い方

### 1. CLI を開く

| 操作                                      | macOS               | Windows / Linux      |
| ----------------------------------------- | ------------------- | -------------------- |
| CLI ピッカーを開く（起動済みなら再利用）  | `Cmd + Esc`         | `Ctrl + Esc`         |
| **新しい**ターミナルで CLI を開く         | `Cmd + Shift + Esc` | `Ctrl + Shift + Esc` |
| 現在のファイルをフォーカス中の CLI に挿入 | `Cmd + Alt + K`     | `Ctrl + Alt + K`     |

Quick Pick に設定済みのすべての CLI が一覧表示されます。1 つ選ぶと、エディタの**隣**のターミナルで対応コマンドを実行して開きます。再利用ショートカットを使い、その CLI がすでに開いている場合、CLI Code はそのターミナルにフォーカスするだけです。

### 2. 作業中のファイルを送信

ファイル内にカーソルを置き（任意で数行を選択）、CLI ターミナルにフォーカスして `Cmd/Ctrl + Alt + K` を押します。CLI Code は次のような参照を挿入します：

- `@src/app.ts` —— ファイル全体
- `@src/app.ts#L10` —— 単一行
- `@src/app.ts#L10-20` —— 行範囲

**HTTP 対応**の CLI（現在は opencode）では、参照はエージェントのローカル HTTP API 経由で送信されます。それ以外はターミナルに入力されます。

> これらのコマンドはコマンドパレット（`Cmd/Ctrl + Shift + P`）からも利用できます：**Open CLI**、**Open CLI in new tab**、**CLI: Insert At-Mentioned**。

## 独自の CLI を追加する

CLI Code は設定駆動です。[`src/lib/config.ts`](src/lib/config.ts) を開き、`CLI_TOOLS` にエントリを追加します：

```ts
{
  id: "my-agent",            // 一意の id（ターミナル名にもなる）
  label: "My Agent",         // ピッカーに表示
  description: "My coding agent CLI",
  command: "my-agent",       // シェルコマンド。HTTP 対応 CLI では "{port}" を使用
  hasHttpApi: false,
}
```

HTTP API 対応の CLI には、API フィールドを追加します：

```ts
{
  id: "opencode",
  label: "opencode",
  command: "opencode --port {port}",
  hasHttpApi: true,
  portEnvVar: "_EXTENSION_OPENCODE_PORT", // CLI がポートを読み取る環境変数
  appendPromptPath: "/tui/append-prompt", // ファイル参照を受け取るエンドポイント
  readyCheckPath: "/app",                 // サーバ起動までポーリングするエンドポイント
  extraEnv: { OPENCODE_CALLER: "vscode" },
}
```

エントリの順序が、ピッカーでの表示順になります。

## 開発

本プロジェクトは [Bun](https://bun.sh) を使用します。

```bash
bun install          # 依存関係をインストール
bun run compile      # 型チェック + lint + dist/ へビルド
bun run watch:esbuild # 変更時に再ビルド
bun test             # ユニットテストを実行
bun run vsix         # .vsix をパッケージング
```

VS Code で `F5` を押すと、拡張機能を読み込んだ **Extension Development Host** が起動します。

### プロジェクト構成

```
src/
├── extension.ts        # アクティベーションシェル（コマンド登録）
└── lib/
    ├── config.ts       # CliTool 型 + CLI_TOOLS レジストリ
    ├── commands.ts     # コマンドハンドラ
    ├── terminal.ts     # ターミナル生成、ツール選択、ポート
    ├── http-client.ts  # API 対応 CLI 向けの HTTP 呼び出し
    └── editor.ts       # 現在ファイル参照のヘルパー
```

## 要件

- VS Code `^1.94.0`
- 使用したい CLI エージェントがインストール済みで `PATH` に通っていること。

## ライセンス

[MIT](LICENSE) © 2026 Thanh Luan
