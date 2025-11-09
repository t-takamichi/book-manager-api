-- Migration: 0001_init
-- This migration creates the initial schema for authors, books, borrowers, staff and loans

CREATE TABLE IF NOT EXISTS `authors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `books` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `external_id` VARCHAR(50),
  `title` VARCHAR(255) NOT NULL,
  `isbn` VARCHAR(50),
  `published` DATE,
  `description` TEXT
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `book_authors` (
  `book_id` INT NOT NULL,
  `author_id` INT NOT NULL,
  PRIMARY KEY (`book_id`, `author_id`),
  FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `borrowers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(100)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `loans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `book_id` INT NOT NULL,
  `borrower_id` INT NOT NULL,
  `staff_id` INT,
  `loaned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `due_at` DATETIME,
  `returned_at` DATETIME NULL,
  `status` ENUM('loaned','returned','overdue') DEFAULT 'loaned',
  FOREIGN KEY (`book_id`) REFERENCES `books`(`id`),
  FOREIGN KEY (`borrower_id`) REFERENCES `borrowers`(`id`),
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed sample data
INSERT INTO authors (name) VALUES ('山田太郎') ON DUPLICATE KEY UPDATE name=name;
INSERT INTO authors (name) VALUES ('鈴木花子') ON DUPLICATE KEY UPDATE name=name;

INSERT INTO books (external_id, title, isbn, published, description)
VALUES
  ('1', 'TypeScript入門', '978-4-xxxx-xxxx-1', '2025-01-01', 'TypeScriptの基礎から応用まで学べる入門書')
  ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO books (external_id, title, isbn, published, description)
VALUES
  ('2', 'Honoで作るWebアプリケーション', '978-4-xxxx-xxxx-2', '2025-02-15', 'Honoを使ったモダンなWebアプリケーション開発の解説')
  ON DUPLICATE KEY UPDATE title=VALUES(title);

INSERT INTO book_authors (book_id, author_id)
VALUES
  ((SELECT id FROM books WHERE external_id='1'), (SELECT id FROM authors WHERE name='山田太郎'))
  ON DUPLICATE KEY UPDATE book_id=book_id;

INSERT INTO book_authors (book_id, author_id)
VALUES
  ((SELECT id FROM books WHERE external_id='2'), (SELECT id FROM authors WHERE name='鈴木花子'))
  ON DUPLICATE KEY UPDATE book_id=book_id;
