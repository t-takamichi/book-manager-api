# データベーススキーマ

---

## authors

| カラム | 型 | 備考 |
|---:|---|---|
| id | INT AUTO_INCREMENT | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |

テーブル名: `authors`

---

## books

| カラム | 型 | 備考 |
|---:|---|---|
| id | INT AUTO_INCREMENT | PRIMARY KEY |
| external_id | VARCHAR(50) | NULL 可（カラム名: `external_id`） |
| title | VARCHAR(255) | NOT NULL |
| isbn | VARCHAR(50) | NULL 可 |
| published | DATE | NULL 可 |
| description | TEXT | NULL 可 |

テーブル名: `books`

---

## book_authors（中間テーブル）

| カラム | 型 | 備考 |
|---:|---|---|
| book_id | INT | NOT NULL — FK -> `books(id)` |
| author_id | INT | NOT NULL — FK -> `authors(id)` |

主キー: (`book_id`, `author_id`)（複合主キー）
外部キー: `book_id` REFERENCES `books`(`id`) ON DELETE CASCADE、`author_id` REFERENCES `authors`(`id`) ON DELETE CASCADE

テーブル名: `book_authors`

---

## borrowers

| カラム | 型 | 備考 |
|---:|---|---|
| id | INT AUTO_INCREMENT | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NULL 可 |

テーブル名: `borrowers`

---

## staff

| カラム | 型 | 備考 |
|---:|---|---|
| id | INT AUTO_INCREMENT | PRIMARY KEY |
| name | VARCHAR(255) | NOT NULL |
| role | VARCHAR(100) | NULL 可 |

テーブル名: `staff`

---

## loans

| カラム | 型 | 備考 |
|---:|---|---|
| id | INT AUTO_INCREMENT | PRIMARY KEY |
| book_id | INT | NOT NULL — FK -> `books(id)` |
| borrower_id | INT | NOT NULL — FK -> `borrowers(id)` |
| staff_id | INT | NULL 可 — FK -> `staff(id)` |
| loaned_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| due_at | DATETIME | NULL 可 |
| returned_at | DATETIME | NULL 可 |
| status | ENUM('loaned','returned','overdue') | DEFAULT 'loaned' |

外部キー: `book_id` REFERENCES `books`(`id`)、`borrower_id` REFERENCES `borrowers`(`id`)、`staff_id` REFERENCES `staff`(`id`)

テーブル名: `loans`

---

## テーブル間の関係（わかりやすい説明）

このセクションでは各テーブルがどのように連携しているかを簡潔に示します。

- books 1 --- * book_authors * --- 1 authors
  - 説明: 1つの書籍（`books`）は複数の著者（`authors`）を持てます。中間テーブル `book_authors` が多対多の関係を表現します。

- books 1 --- * loans * --- 1 borrowers
  - 説明: 1つの書籍は複数回貸し出される可能性があり、各貸出（`loans`）は貸し出した借り手（`borrowers`）に結び付きます。

- staff 1 --- * loans
  - 説明: `staff` は貸出処理を担当できます。1人のスタッフが複数の `loans` レコードを作成できます（staff_id は NULL を許容しており、スタッフ不明の貸出も許容します）。

具体的な関係一覧（キー・カーディナリティ）:

- books.id (1) ← book_authors.book_id (多)
- authors.id (1) ← book_authors.author_id (多)
- books.id (1) ← loans.book_id (多)
- borrowers.id (1) ← loans.borrower_id (多)
- staff.id (1) ← loans.staff_id (多・NULL 可)

この図（文章版）は ER 図の簡易版です。必要なら Mermaid での可視化（README への埋め込み）も作成できます。

## シードデータ（マイグレーションで挿入されるもの）

- authors
  - `山田太郎`
  - `鈴木花子`

- books
  - `external_id='1'`, `title='TypeScript入門'`, `isbn='978-4-xxxx-xxxx-1'`, `published='2025-01-01'`, `description='TypeScriptの基礎から応用まで学べる入門書'`
  - `external_id='2'`, `title='Honoで作るWebアプリケーション'`, `isbn='978-4-xxxx-xxxx-2'`, `published='2025-02-15'`, `description='Honoを使ったモダンなWebアプリケーション開発の解説'`

- book_authors
  - `external_id='1'` の書籍と `山田太郎` をリンク
  - `external_id='2'` の書籍と `鈴木花子` をリンク

シードは `INSERT ... ON DUPLICATE KEY UPDATE` を使っており、複数回実行しても冪等になるようになっています。

---

## 注意事項・推奨

- 文字セット: マイグレーションでテーブルを `utf8mb4`（`utf8mb4_unicode_ci`）で作成しているため、日本語や絵文字の文字化けを防げます。
- 既に文字化けしたデータが存在する場合は、開発環境であればデータベースを再作成する（`docker compose down -v && docker compose up --build`）のが最も簡単です。運用中に対応する場合は `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` などで変換しますが、慎重な検証が必要です。
- Prisma 側のマッピング: Prisma スキーマでは `externalId` → `external_id` のように `@map` を使ってフィールド名をデータベースのスネークケースに合わせています。多対多は明示的な `BookAuthor` 中間モデルを用いて `book_authors` テーブルにマッピングしています。

---

## 参照元
このドキュメントはリポジトリ内の `prisma/migrations/0001_init/migration.sql` から生成しました。
