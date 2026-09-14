---
name: usage-window-guard
description: Claude Code(ターミナル版)の5時間/週次の利用上限(レート制限)を監視し、閾値に達したら会話内で事前に警告する仕組みをセットアップ・運用する。「usage limit」「利用制限」「使用量の警告」「rate limitの予告」などの相談で使う。
---

# Claude Code 利用上限の事前警告(usage-window-guard)

## これは何か

Claude Codeには `/usage` で現在の利用率(5時間ウィンドウ/週次ウィンドウの%とリセット時刻)を手動確認する機能があるが、何もしなければ上限に達した瞬間まで気づけない。このスキルはClaude Codeの `statusLine` と `hooks`(UserPromptSubmit)を使って、利用率が閾値(デフォルト: 70/85/95%)を初めて超えた瞬間に、その回の会話の中で自動で警告を出す(=事前の予告)仕組みを、ユーザーの(既定では)`~/.claude/` 配下にセットアップする(`CLAUDE_CONFIG_DIR` が設定されている場合はそちらを使う。詳細は次項)。

このスキルは設定作業そのものであり、実行するとClaude Code環境のファイルを作成・編集する。**認証情報やトークンは一切読み取らず、外部APIも呼ばない。Claude Code自体がstatusLineコマンドのstdinに渡してくれる利用率情報だけを使う。**

注意: 対象はClaude Pro/Maxプランなどの「セッション利用率(rate limit)」。APIキー従量課金(pay-as-you-go)の場合はこの概念自体が対象外で、コストは `/cost` で見ることを伝える。

## 前提と制約

- Claude Codeが動作する環境(=Node.js存在)であればOK。スクリプトはすべてNode.js製でbash/jq依存なし。
- 利用率情報(`rate_limits`)がstatusLineのstdinに乗るのはClaude Codeの比較的新しいバージョンのみ。古いバージョンやAPIキー運用では情報が取れず、その場合は自動で「/usageで確認してください」表示に落ちるだけでエラーにはならない。
- **このスキルが依存しているのは「statusLineのstdinに `rate_limits` が来ること」の1点だけ。** 動かないときはまずそこを疑う(手順4)。
- **CLAUDE_CONFIG_DIR is supported.** If it is set, usage-window-guard stores its config, cache, and state under that directory instead of `~/.claude`. If it is not set, the default `~/.claude` directory is used.

## セットアップ手順(スキル実行時にClaude自身が行う)

**シェルコマンドはすべてBashで実行する。** PowerShellでは `~` が `node` などの外部コマンドに展開されないため、パスが解決できない。

**CLAUDE_CONFIG_DIR が設定されている場合は、`~/.claude` ではなくそのディレクトリをClaude Codeの設定ルートとして使用する。設定されていない場合のみ `~/.claude` を使用する。** 以降の手順・コマンド例では、この設定ルートを `CLAUDE_ROOT` として表す。

```bash
CLAUDE_ROOT="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
```

### 1. スクリプトを配置する

スクリプト本体はこのスキルに同梱してある(`scripts/` 配下)。中身を書き写さず、そのままコピーする。

```bash
mkdir -p "$CLAUDE_ROOT/usage-guard"
cp "$CLAUDE_ROOT/skills/usage-window-guard/scripts/common.js"     "$CLAUDE_ROOT/usage-guard/"
cp "$CLAUDE_ROOT/skills/usage-window-guard/scripts/statusline.js" "$CLAUDE_ROOT/usage-guard/"
cp "$CLAUDE_ROOT/skills/usage-window-guard/scripts/warn-hook.js"  "$CLAUDE_ROOT/usage-guard/"
```

- `common.js` … 設定/キャッシュの読み書きと、stdinからの利用率抽出
- `statusline.js` … ステータス行を描画し、そのとき得た利用率を `cache.json` に保存する
- `warn-hook.js` … プロンプト送信のたびに `cache.json` を見て、閾値を初めて超えたら警告を返す

### 2. `$CLAUDE_ROOT/usage-guard/config.json`(既定では `~/.claude/usage-guard/config.json`。存在しない場合のみ作成。既存なら上書きしない)

```json
{ "thresholds": [70, 85, 95], "maxCacheAgeSec": 900 }
```

`maxCacheAgeSec` は、警告判定に使うキャッシュの許容鮮度。これより古いとhookは何もしない。短くしすぎると、少し離席して戻ったときにその回の警告が出ない。

### 3. `$CLAUDE_ROOT/settings.json`(既定では `~/.claude/settings.json`)をマージ(上書き禁止)

**書き込む前に必ずバックアップを取る。**

```bash
cp "$CLAUDE_ROOT/settings.json" "$CLAUDE_ROOT/settings.json.bak" 2>/dev/null || true
```

既存の `$CLAUDE_ROOT/settings.json` をReadし(なければ `{}`)、以下の2キーをマージしてWriteする。

- 既存の `statusLine` があれば、置き換えてよいかユーザーに確認する。置き換えない場合はhookのみ追加する。
- 既存の `hooks.UserPromptSubmit` があれば配列に追記し、既存分を消さない。
- **パスは `~` や `$HOME` に頼らず、絶対パスをそのまま埋め込む。** 区切りはWindowsでもスラッシュでよい。**`CLAUDE_CONFIG_DIR` が設定されている場合は、`$HOME/.claude` ではなく `$CLAUDE_ROOT`(= `$CLAUDE_CONFIG_DIR` の値)を展開した絶対パスを埋め込む。** ここを取り違えると、statusLine/hookは動くがClaude Code自身が読みに行く設定ルートとは別の場所を指すことになり、警告が一切出ないまま気づけない。
- **パスにスペースが含まれる場合(例: `C:/Users/Your Name/`)は、コマンド文字列の中でパスを `\"` で囲む。** 囲まないと最初のスペースで切れて、statusLineもhookも無言で失敗する(statusLineの失敗は画面に出ないので気づけない)。

Windows(ホームにスペースがある例):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"C:/Users/Your Name/.claude/usage-guard/statusline.js\""
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \"C:/Users/Your Name/.claude/usage-guard/warn-hook.js\"" } ] }
    ]
  }
}
```

macOS/Linux:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /Users/USERNAME/.claude/usage-guard/statusline.js"
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node /Users/USERNAME/.claude/usage-guard/warn-hook.js" } ] }
    ]
  }
}
```

ユーザーに伝えること:

- `~/.claude/settings.json` は**全プロジェクト共通**。他の作業でもステータス行が変わる。
- `statusLine` を設定すると、Claude Code既定のステータス行表示は**置き換わる**。`statusline.js` がモデル名とフォルダ名を自前で出しているのはそのため。
- `hooks.UserPromptSubmit` により、プロンプト送信のたびにNodeプロセスが1つ立つ(数十ms程度)。
- 戻すときはこの2キーを消す。

`hooks` 配下の配列形式(`matcher` キーの要否など)はClaude Codeのバージョンで変わることがあるため、書き込んだ後は必ず動作確認(手順4)を行い、Claude Code起動時にsettings.jsonのエラーが出ていないか確認する。エラーが出た場合は現在の公式hooksドキュメント(code.claude.com/docs/en/hooks)の配列形式に合わせて修正する。

### 4. 動作確認

**4-1. スクリプトが落ちないこと**

```bash
echo '{}' | node "$CLAUDE_ROOT/usage-guard/statusline.js"; echo
node "$CLAUDE_ROOT/usage-guard/warn-hook.js"; echo
```

文字列と `{}` が返ればOK。ただしこれは「落ちないこと」しか確かめていない。

**4-2. `rate_limits` が実際に来るかを確かめる(重要)**

このスキルが動くかどうかはここで決まる。`statusLine` を一時的に次のコマンドに差し替え、Claude Codeを1度起動してから、書き出されたJSONを見る。

```bash
node -e "const root=process.env.CLAUDE_CONFIG_DIR||(require('os').homedir()+'/.claude');let s='';process.stdin.on('data',d=>s+=d).on('end',()=>require('fs').writeFileSync(root+'/statusline-dump.json',s))"
```

(上記が読みにくければ、`statusline.js` の先頭に `fs.writeFileSync(path.join(c.DIR,'stdin-dump.json'), fs.readFileSync(0,'utf8'))` を一時的に足しても同じ)

**Claude Code 2.1.263 で実際に来た形(2026-09-08 観測):**

```json
"rate_limits": {
  "five_hour": { "used_percentage": 24, "resets_at": 1788861000 },
  "seven_day": { "used_percentage": 52, "resets_at": 1789322400 }
}
```

- 使用率のキーは **`used_percentage`**。`utilization` ではない。`common.js` の `norm()` はこれを最優先で読み、`utilization` / `percentage` は他バージョン向けのフォールバックとして残してある。
- 値は **0〜100**(`24`)。したがって閾値 `[70,85,95]` はそのまま使える。
- `resets_at` は **unix 秒**。JavaScriptの `Date` はミリ秒なので、そのまま渡すと1970年になる。`common.js` の `toDate()` が `1e12` 未満なら1000倍して吸収している。

確認する点は3つ。**キー名とスケールは、どちらを外しても「警告が一度も出ないまま静かに壊れる」形で失敗する。**

- `rate_limits` キーがあるか。無ければ、そのバージョン/契約では自動監視はできない。`/usage` の手動確認に頼る運用になる旨を伝える。
- 使用率のキー名が上記のいずれか(`used_percentage` / `utilization` / `percentage`)か。別の名前に変わっていたら `norm()` に足す。
- 値が `42` か `0.42` か。**0〜1で来る場合、閾値 `[70,85,95]` には永久に到達せず警告が一度も出ない。** その場合は `config.json` の閾値を `[0.7,0.85,0.95]` に変えるか、`norm()` で100倍する。

なお `statusLine` は全プロジェクト共通なので、**このダンプは最後に画面を描画したセッションが上書きする。** 別プロジェクトのセッションが動いていると `workspace.current_dir` はそちらのものになる(利用率はアカウント単位なので値そのものは有効)。`cache.json` / `state.json` も同様に全セッション共有で、警告はそのとき最初にプロンプトを送ったセッションに出る。

**4-2b. 閾値の判定そのものを確かめる**

4-2 でキー名とスケールが分かっても、閾値ロジックは動かしてみないと分からない。**`CLAUDE_CONFIG_DIR` を一時ディレクトリに差し替えれば**、本物の `cache.json` / `state.json` を汚さずに試せる(`HOME`/`USERPROFILE` ごと差し替えるより影響範囲が狭く、このツール以外の設定やキャッシュに触れない)。5h を 72% → 88% → 96% と上げながら、各回 `warn-hook.js` を2回呼ぶ。**1回目に警告が出て2回目は `{}`** になり、`resets_at` を変えると再び70%から警告されるのが正しい。

テスト用JSONを `echo` でパイプすると、Git Bashが `\\` を潰してJSONが壊れ、「警告が出ない」という誤った結論になる。**JSONは `python -c` などで生成して渡す。**

**4-3. 実際の表示**

Claude Codeで新しいセッションを開始し、ステータスバーに `Opus 5  |  myproject  |  5h 42% -> 9/8 18:00` のような表示が出るか、`/usage` で見た%と近い値かを確認する。

## 使い方(セットアップ後)

何もしなくても自動で動く。5時間ウィンドウまたは週次ウィンドウの利用率が70%→85%→95%と各閾値を初めて超えるたびに、その回の会話の中で警告が表示される(同じウィンドウ内で同じ閾値は二度警告しない。ウィンドウがリセットされると再び70%から警告される)。

**警告の文言は `warn-hook.js` 側で英語固定してある**(`⚠ 5-hour window usage reached 70% (resets: 9/8 18:50)`)。
`additionalContext` に英語で「警告文を言い換えず、そのまま伝えること」と書いているのはそのため。
**ここを「1行で伝えて」だけにすると、セッションごとにモデルが勝手に言い換える。**
2026-09-08 に、日本語固定文を additionalContext だけで指示した際、セッションごとに警告文が言い換えられ、⚠ の有無まで変わることを確認した。
利用率の数字が信用できるかどうかの話になるので、文言は固定する。

(以下は既定の `~/.claude` 基準のパス。セットアップ時に `CLAUDE_CONFIG_DIR` を使った場合はそちら配下に読み替える。)

- 今すぐ正確な数字を見たい: `/usage`
- 閾値やキャッシュの有効期限を変えたい: `~/.claude/usage-guard/config.json` を編集(例: `"thresholds": [55, 70, 85, 95]`)
- 警告済みの記録をリセットしたい: `~/.claude/usage-guard/state.json` を削除する
- 監視を止めたい: `~/.claude/settings.json` から追加した `statusLine` / `hooks.UserPromptSubmit` のエントリを削除する

## 正直な注意点

- 自動警告が効くのは、Claude CodeがstatusLineのstdinに `rate_limits` を渡してくれるバージョン・契約のときだけ。効かない場合はエラーにはならず「/usageで確認」という表示に落ちるだけの設計にしてある。
- 警告は「会話の中にメッセージが出る」形であり、作業を強制的に止めるものではない(ユーザー自身が判断する)。
- 警告の判定は `statusline.js` が最後に書いたキャッシュに基づく。statusLineが一度も走っていない、または `maxCacheAgeSec` より古い場合、その回は警告が出ない(次の回で拾う)。
- `resets_at` が取れない場合、そのウィンドウの警告済み記録はリセットの判定ができず、`state.json` を消すまで再警告されない。
