-- Migration: 0002_add_demo_seed
-- Add demo seed data: a borrower, a staff and an active loan for testing

-- Seed borrowers and staff for demo/testing loan records
INSERT INTO borrowers (name, email) VALUES ('テスト利用者', 'test@example.com') ON DUPLICATE KEY UPDATE name=name;
INSERT INTO staff (name, role) VALUES ('受付太郎', 'clerk') ON DUPLICATE KEY UPDATE name=name, role=VALUES(role);

-- Seed a sample active loan (returned_at = NULL) for book external_id='1'
INSERT INTO loans (book_id, borrower_id, staff_id, loaned_at, due_at, returned_at, status)
VALUES (
  (SELECT id FROM books WHERE external_id='1'),
  (SELECT id FROM borrowers WHERE name='テスト利用者'),
  (SELECT id FROM staff WHERE name='受付太郎'),
  NOW(),
  DATE_ADD(NOW(), INTERVAL 14 DAY),
  NULL,
  'loaned'
)
ON DUPLICATE KEY UPDATE book_id=book_id;
