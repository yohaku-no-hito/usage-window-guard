# usage-window-guard

Claude Code の **5時間 / 週次の利用上限を見える化し、上限到達前に警告する**ための Skill です。

`/usage` を毎回確認しなくても、`statusLine` に利用率を常時表示します。さらに、設定した閾値を超えたタイミングで `UserPromptSubmit` hook を使って会話内にも警告を出します。

## こんなときに

Claude Code で作業していて、利用上限が突然来て作業計画が崩れるのを避けたいときに使います。

表示例:

```text
Opus 5  |  myproject  |  5h 71% -> 9/8 18:50  |  7d 58% -> 9/14 03:00
```

警告例:

```text
⚠ 5-hour window usage reached 70% (resets: 9/8 18:50)
```

> **status line とは？**  
> Claude Code のターミナル下部に常時表示できるカスタマイズ可能な情報欄です。この Skill はそこに 5時間・週次の利用率を表示します。

## できること

- 5時間ウィンドウ / 週次ウィンドウの利用率を status line に常時表示
- デフォルトで 70% / 85% / 95% 到達時に英語の警告を表示
- 同じウィンドウ・同じ閾値では重複警告しない
- ウィンドウがリセットされたら再び警告
- 認証情報やトークンは読み取らない
- 外部 API を呼ばない

## 仕組み

Claude Code が `statusLine` コマンドの stdin に渡す `rate_limits` を利用します。

- `scripts/statusline.js`: 利用率を表示し、最新値をキャッシュ
- `scripts/warn-hook.js`: プロンプト送信時に閾値超過を判定して警告
- `scripts/common.js`: 設定・キャッシュ・利用率データの共通処理

利用率の取得元は Claude Code 自身が `statusLine` に渡す情報だけです。

## 導入

このリポジトリを Claude Code の Skill ディレクトリに、次の構成で配置します。

```text
~/.claude/skills/usage-window-guard/
├── SKILL.md
└── scripts/
    ├── common.js
    ├── statusline.js
    └── warn-hook.js
```

(`CLAUDE_CONFIG_DIR` を設定している場合は、Claude Code 自体の設定ルートがそちらになるため、Skill の配置場所も `~/.claude` ではなくそのディレクトリ配下になります。)

配置後、Claude Code で `usage-window-guard` のセットアップを依頼してください。Skill が `~/.claude/usage-guard/`(`CLAUDE_CONFIG_DIR` 設定時はそちら配下の `usage-guard/`)へのスクリプト配置と `~/.claude/settings.json`(同上)の設定を行います。

詳細なセットアップ手順、動作確認、既存設定とのマージ方法は [SKILL.md](./SKILL.md) を参照してください。

## 必要条件

- Claude Code
- Node.js
- `statusLine` の stdin に `rate_limits` が渡される Claude Code のバージョン / 契約

`rate_limits` が取得できない場合はエラーにはせず、`/usage` での手動確認を促す表示にフォールバックします。

この Skill は Claude Pro / Max 等のセッション利用率を対象としています。API キー従量課金のコスト監視は対象外です。

### CLAUDE_CONFIG_DIR

`CLAUDE_CONFIG_DIR` に対応しています。

設定されている場合、usage-window-guard の設定・キャッシュ・状態ファイルは
`~/.claude` ではなく `CLAUDE_CONFIG_DIR` 配下に保存されます。
未設定の場合は、従来どおり `~/.claude` を使用します。

## カスタマイズ

セットアップ後に `~/.claude/usage-guard/config.json`(`CLAUDE_CONFIG_DIR` 設定時はそちら配下)を編集すると、警告閾値を変更できます。

```json
{ "thresholds": [70, 85, 95], "maxCacheAgeSec": 900 }
```

たとえば、もっと早く警告したい場合:

```json
{ "thresholds": [55, 70, 85, 95], "maxCacheAgeSec": 900 }
```

## 動作確認済み環境

Claude Code 2.1.270 で動作確認済み（2026-09-14）。

Claude Code 側の `statusLine` / hooks / `rate_limits` の仕様は将来変更される可能性があります。動作しない場合の確認ポイントは [SKILL.md](./SKILL.md) に記載しています。

## 注意事項

- `statusLine` は全プロジェクト共通設定です。
- 既存の `statusLine` がある場合は置き換えが発生するため、セットアップ時に確認します。
- `hooks.UserPromptSubmit` により、プロンプト送信のたびに短時間 Node.js プロセスが起動します。
- このツールは利用上限を解除・変更するものではありません。現在の利用率を見える化して事前警告するだけです。

## License

MIT License。自由に利用・改変・再配布できます。詳細は [LICENSE](LICENSE) を参照してください。

