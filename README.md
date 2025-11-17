 Web 書籍管理 API
=================================

簡単な書籍管理 API をHonoの学習用に作った形です

目次
------
- プロジェクト概要
- プロジェクト構成
- ビルドと実行
- 各 API の概要
Web 書籍管理 API

## 前提条件 (推奨)
- Node.js 18.x 以降（LTS）
- npm 8.x 以降
- Docker Engine / Docker Compose (Compose V2 推奨)

## プロジェクト概要
- 言語/ランタイム: TypeScript (ESM), Node.js
- ORM: Prisma (MySQL 本番 / SQLite をテストで利用)
- フレームワーク: Hono
- テスト: Jest（ユニット + SQLite を使った E2E）

## プロジェクト構成 (主要ファイル/ディレクトリ)
- `src/` - アプリケーション本体
  - `presentation/` - ルーティング、ハンドラ、HTTP レイヤ
  - `domain/` - ドメインモデル、サービス、バリデータ、エラー
  - `infrastructure/` - Prisma リポジトリ実装、ロガー等
  - `common/` - 共通ユーティリティ
  - `types/` - 型定義補助
- `prisma/` - Prisma スキーマとマイグレーション
- `docker/` - コンテナ用エントリポイント等
- `jest.*` - テスト設定
- `.env` - 実行時の環境変数（ローカル開発で利用）

## ビルドと実行 (推奨: Docker ベース)
このプロジェクトは Docker Compose を推奨します。依存関係や DB を手元に入れずに、コンテナで一貫して実行できます。

### Docker Compose で起動（推奨）
1. ルートに `.env` を用意（`DATABASE_URL` 等を設定）。サンプルは `.env.example` を参照してください。
2. イメージをビルドして起動:
```bash
docker compose up --build
```

ポイント:
- コンテナのエントリポイントは Prisma クライアント生成とマイグレーションを試みます。ログに表示される `DATABASE_URL` が `db` を指していることを確認してください（`localhost` はコンテナから見えません）。
- 実行中に環境を確認する例:
```bash
docker compose logs --follow app
docker compose exec app env | grep DATABASE_URL
docker compose exec app cat /usr/src/app/.env
```

### ローカル Node での起動（開発／デバッグ用）
1. 依存をインストール
```bash
npm install
```
2. TypeScript をビルド
```bash
npm run build
```
3. Prisma クライアント生成（schema 変更がある場合）
```bash
npm run prisma:generate
```
4. アプリ起動
```bash
npm run start
```

### Docker Compose で E2E テストを実行する

このリポジトリには Jest を使った E2E テスト群が含まれています。Docker Compose 上で MySQL を立ち上げ、同じネットワーク内の `app` コンテナからマイグレーション適用・クライアント生成・テスト実行を行うのが確実です。

手順（推奨、コンテナ内で実行）:

1. Compose を起動（バックグラウンド）

```bash
docker compose up -d
```

2. 環境変数（`.env`）で DB ユーザ/パスが設定されていることを確認します。
  - デフォルトは `MYSQL_USER=app` / `MYSQL_PASSWORD=apppass` ですが、コンテナ起動時に別の値が適用されることがあります。`docker compose logs db-primary` で確認できます。

3. `app` コンテナ内でマイグレーション適用・Prisma クライアント生成・テスト実行を実行します。
  - 例（MySQL のユーザ/パスが `app:verysecret` の場合、サービス名は `db-primary`）:

```bash
docker compose exec app sh -c '
  DATABASE_URL="mysql://app:verysecret@db-primary:3306/app_db" npx prisma migrate deploy --schema=prisma/schema.prisma && \
  DATABASE_URL="mysql://app:verysecret@db-primary:3306/app_db" npx prisma generate --schema=prisma/schema.prisma && \
  DATABASE_URL="mysql://app:verysecret@db-primary:3306/app_db" npx jest --runInBand --verbose'
```

ポイント:
- 上のコマンドはコンテナ内部から `db-primary` のホスト名で MySQL にアクセスするため、ホストのポートマッピングに依存しません。
- `npx` コマンドがインタラクティブにパッケージをインストールする場合があります。CI では事前に devDependencies をインストールするか、`npx --yes` オプションを利用してください。

ホスト側から直接テストを実行する方法（代替）:

```bash
# MySQL がホストの 3306 にバインドされている場合（docker-compose の ports によるマッピングを利用）
DATABASE_URL="mysql://app:verysecret@localhost:3306/app_db" npm run test:e2e
```

この方法はホスト上で devDependencies が揃っている場合に使いやすく、今回の検証でもホスト実行で全 E2E テストが通っています。

トラブルシューティング:
- `port is already allocated` が出る場合は既にホストの 3306 を別プロセスやコンテナが使っています。`docker ps` / `lsof -iTCP:3306 -sTCP:LISTEN` で確認してください。
- Jest の globalSetup/globalTeardown の互換性エラーが出た場合は、リポジトリの `jest.globalSetup.cjs` / `jest.globalTeardown.cjs` を使用するように `jest.config.js` を更新しています。


注: ローカル起動では MySQL の用意（ローカル DB または別コンテナ）が必要です。開発の簡便さと一貫性のため、Docker Compose を第一選択にしてください。

## 各 API の概要
- GET /api/books
  - 検索および一覧取得のエンドポイントです。クエリパラメータで挙動を変えられます。
  - クエリパラメータ:
    - `q` (optional): 検索ワード（タイトル／著者名／ISBN 等）。未指定なら全件一覧になります。
    - `page` (optional): ページ番号（1-based）。指定するとページネーションでのレスポンスになります。
    - `per_page` (optional): 1ページあたりの件数（デフォルト 15、最大 100）。
  - レスポンス: ページネーション形式のオブジェクトを返します。
    - 返却形式（常に page/perPage を含む paginated object）:
      ```json
      {
        "items": [ /* Book[] */ ],
        "total": 123,
        "page": 1,
        "perPage": 15
      }
      ```

- GET /api/books/:id
  - 指定 ID の書籍を取得します。

- POST /api/books/:id/checkout
  - 指定書籍を貸し出します。
  - リクエストボディ（JSON, いずれか必須）:
    - `borrowerId`: number (既存会員を指定)
    - または `borrowerName`: string (+ optional `borrowerEmail`)
    - `staffId`: number (貸出を実行する職員 ID)
    - `dueAt`: ISO 日時文字列 (例: `2025-11-30T23:59:59Z`)
  - 成功: 更新された書籍オブジェクト（JSON）を返します。
  - バリデーションや業務ルール違反は 422 を返します（例: 既に貸出中）。

- POST /api/books/:id/return
  - 指定書籍を返却処理します。成功で更新された書籍オブジェクトを返します。

### エラーハンドリング
- ドメインバリデーションエラーは 422、存在しないリソースは 404、その他は 500 にマップされます。レスポンスは `{ message: string, details?: any }` の形です。

## curl での実行例（強化）
以下は Docker を使い `localhost:3000` でアプリが待ち受けている想定です。

1) 検索
```bash
curl -sS "http://localhost:3000/api/books?q=TypeScript" | jq
```

2) 書籍取得
```bash
curl -sS "http://localhost:3000/api/books/1" | jq
```

3) チェックアウト（既存 borrowerId を使う） — 成功例
```bash
curl -sS -X POST http://localhost:3000/api/books/1/checkout \
  -H 'Content-Type: application/json' \
  -d '{"borrowerId":123, "staffId":1, "dueAt":"2025-12-01T12:00:00Z"}' | jq
```

成功時の想定ステータス: 200
成功レスポンス例（抜粋）:
```json
{
  "id": 1,
  "title": "Example Book",
  "loan": {
    "borrower": { "id": 123, "name": "Yamada Taro" },
    "dueAt": "2025-12-01T12:00:00Z"
  }
}
```

4) チェックアウト（新規 borrowerName を指定） — エラー例（業務ルール違反やバリデーション）
```bash
curl -sS -X POST http://localhost:3000/api/books/1/checkout \
  -H 'Content-Type: application/json' \
  -d '{"borrowerName":"Yamada Taro", "staffId":999, "dueAt":"invalid-date"}' | jq
```

想定ステータス: 422
エラー例レスポンス:
```json
{
  "message": "Validation error",
  "details": { "dueAt": "invalid date", "staffId": "not found" }
}
```

5) 返却
```bash
curl -sS -X POST http://localhost:3000/api/books/1/return | jq
```

## .env の書式例（参考）
MySQL（Docker Compose 内）:
```env
DATABASE_URL="mysql://app:verysecret@db:3306/app_db"
```
SQLite（テスト用）:
```env
DATABASE_URL="file:./dev-test.db"
```
