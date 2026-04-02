# TRPG Manage Discord bot (TRPG セッション管理 Bot)

TRPG のセッション環境作成と、終了後のログアーカイブ・整理を自動化する Discord Bot です。
複数サーバーでの利用に対応しており、サーバーごとの設定をローカルファイルで管理します。

## 1. 準備

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成し、Bot トークンを取得してください。
2. Bot の **Privileged Gateway Intents** で以下を有効にしてください。
   - `Guild Members`
   - `Message Content`
3. Bot をサーバーに招待する際、以下の権限が必要です。
   - `Administrator`

## 2. 環境構築

### 必要な環境
- Node.js (v18以上推奨)
- npm

### 手順
1. リポジトリをクローンします。
2. プロジェクトのルートディレクトリで `.env` ファイルを作成し、以下の内容を記入します。
   ```ini
   DISCORD_TOKEN=あなたのBotトークン
   CLIENT_ID=あなたのBotのアプリケーションID
   ```
   ※ その他のギルドIDなどは不要です。

3. 依存関係をインストールします。
   ```bash
   npm install
   ```

## 3. 起動方法

1. **スラッシュコマンドの登録**（初回およびコマンド変更時）
   ```bash
   node src/deploy-commands.js
   ```
   ※ グローバル登録のため、全サーバーに反映されるまで最大1時間程度かかる場合があります。

2. **Bot の起動**
   ```bash
   node src/index.js
   ```

## 4. 使い方

### コマンド一覧

#### 1. 初回設定
- **`/setup-archive`**: サーバーごとのアーカイブ保存先カテゴリを設定します。
  - `category_id` (必須): アーカイブを保存するカテゴリのID。
  - ※ 設定は `./data/config.json` に保存されます。

#### 2. セッションの運用
- **`/session-create`**: 新しいセッション環境を構築します。
  - `name` (必須): セッション名。ロール名やカテゴリ名に使用されます。
  - `use_gm` (任意): GM用ロールと専用チャンネルを作成するか（デフォルト: false）。
  - `use_observer` (任意): 観戦用ロールと専用チャンネルを作成するか（デフォルト: false）。
  - ※ セッション用ロール、閲覧制限付きカテゴリ、および基本チャンネル（連絡、雑談、CS提出所）が作成されます。

- **`/session-archive`**: セッションを終了し、ログを保存して整理します。
  - `category_id` (必須): アーカイブ対象のカテゴリID。
  - `target_channel_id` (任意): ログ（zip）の送信先チャンネルを指定する場合に使用。指定しない場合は設定されたアーカイブカテゴリ内に新チャンネルを作成します。
  - `delete_roles` (任意): 関連ロールを削除するか（デフォルト: false）。
  - `delete_channels` (任意): カテゴリとチャンネルを削除するか（デフォルト: false）。
  - ※ ログを HTML 形式で取得し、zip にまとめてアーカイブ先へ送信します。

- **`/session-delete`**: アーカイブせずに環境を直接削除します。
  - `category_id` (必須): 削除対象のカテゴリID。
  - `confirm` (必須): 誤操作防止のため、`True` を選択する必要があります。
  - ※ 関連するカテゴリ、チャンネル、およびロールをすべて削除します。

## 5. pm2 による常駐起動（Windows 11）

Bot を常駐プロセスとして管理したい場合、[pm2](https://pm2.keymetrics.io/) を使用します。

### pm2 のインストール

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

### Bot の起動

```powershell
pm2 start src/index.js --name trpg-bot
```

### 基本操作

| コマンド | 説明 |
|---|---|
| `pm2 list` | 起動中のプロセス一覧を表示 |
| `pm2 logs trpg-bot` | ログをリアルタイム表示 |
| `pm2 restart trpg-bot` | Bot を再起動 |
| `pm2 stop trpg-bot` | Bot を停止 |
| `pm2 delete trpg-bot` | pm2 の管理から削除 |

### PC 起動時に自動起動する設定

以下のコマンドで、Windows の起動時に Bot が自動で起動するよう設定できます。

```powershell
pm2 save
pm2-startup install
```

> **注意:** `pm2-startup install` は管理者権限のターミナル（PowerShell を「管理者として実行」）で実行してください。

---

## 6. 補足
- 管理用データは `./data/config.json` に保存されます。バックアップや手動編集が可能です。
- アーカイブ機能は、Discord のファイルサイズ制限（25MB）を超える場合、自動的に画像を省略する「ライトモード」で再試行します。
