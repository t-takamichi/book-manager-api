import { PrismaClient } from '@prisma/client';

export async function createAuthor(prisma: PrismaClient, name = 'テスト著者') {
  return prisma.author.create({ data: { name } });
}

export async function createBookWithAuthor(prisma: PrismaClient, bookData: Partial<any> = {}) {
  const author = await createAuthor(prisma, bookData.authorName || 'テスト著者');
  const book = await prisma.book.create({
    data: {
      title: bookData.title || 'テストブック',
      isbn: bookData.isbn || '978-4-xxxx-xxxx-0',
      published: bookData.published || new Date('2024-01-01'),
      description: bookData.description || '自動作成されたテスト用の本',
    },
  });
  await prisma.bookAuthor.create({ data: { bookId: book.id, authorId: author.id } });
  return { book, author };
}

export async function createStaff(prisma: PrismaClient, name = '受付太郎', role = 'clerk') {
  return prisma.staff.create({ data: { name, role } });
}

export async function createBorrower(
  prisma: PrismaClient,
  name = '利用者',
  email = 'test@example.com',
) {
  return prisma.borrower.create({ data: { name, email } });
}

export default {
  createAuthor,
  createBookWithAuthor,
  createStaff,
  createBorrower,
};
