import type { ClientIssuer } from './client-issuer';
import seedFactory from '@web/presentation/integration/helpers/seedFactory';

/**
 * Run startup seed using existing ClientIssuer (uses primary client for writes).
 * Controlled by `SEED_ON_STARTUP=true` or when `NODE_ENV=test`.
 *
 * This implementation creates a richer dataset:
 * - ~40 books with authors
 * - several staff and borrowers
 * - a mixture of loans (loaned, returned, overdue)
 */
export async function runSeedIfNeeded(issuer: ClientIssuer) {
  const shouldSeed =
    process.env.SEED_ON_STARTUP === 'true' || process.env.NODE_ENV === 'test';

  if (!shouldSeed) return;

  await issuer.executeOnPrimary(async (prisma) => {
    const existing = await prisma.book.count();
    const DESIRED_TOTAL = 40;
    if (existing >= DESIRED_TOTAL) return;

    // staff
    const staffMembers = await Promise.all([
      seedFactory.createStaff(prisma, '受付 太郎', 'clerk'),
      seedFactory.createStaff(prisma, '図書係 花子', 'clerk'),
      seedFactory.createStaff(prisma, '管理人 一郎', 'manager'),
    ]);

    // borrowers
    const borrowers = await Promise.all([
      seedFactory.createBorrower(prisma, '佐藤 太郎', 'sato@example.local'),
      seedFactory.createBorrower(prisma, '鈴木 花子', 'suzuki@example.local'),
      seedFactory.createBorrower(prisma, '高橋 次郎', 'takahashi@example.local'),
      seedFactory.createBorrower(prisma, '田中 三郎', 'tanaka@example.local'),
      seedFactory.createBorrower(prisma, '伊藤 四郎', 'ito@example.local'),
      seedFactory.createBorrower(prisma, '中村 五月', 'nakamura@example.local'),
      seedFactory.createBorrower(prisma, '小林 六子', 'kobayashi@example.local'),
      seedFactory.createBorrower(prisma, '加藤 七海', 'kato@example.local'),
      seedFactory.createBorrower(prisma, '吉田 八重', 'yoshida@example.local'),
      seedFactory.createBorrower(prisma, '山本 九郎', 'yamamoto@example.local'),
    ]);

    // book titles (40 items)
    const titles = [
      '吾輩は猫である',
      'こころ',
      '坊っちゃん',
      '羅生門',
      '雪国',
      '風の歌を聴け',
      'ノルウェイの森',
      '1Q84',
      '火花',
      '人間失格',
      '罪と罰',
      '百年の孤独',
      '老人と海',
      'ハリー・ポッターと賢者の石',
      'ハリー・ポッターと秘密の部屋',
      '指輪物語: 王の帰還',
      'アルケミスト',
      '沈黙',
      'コンビニ人間',
      '蜜蜂と遠雷',
      '博士の愛した数式',
      '深夜特急',
      '告白',
      '桜の森の満開の下',
      '新世界より',
      '世界の終りとハードボイルド・ワンダーランド',
      '青い炎',
      '夜は短し歩けよ乙女',
      '地下鉄に乗って',
      '海辺のカフカ',
      'アンドロイドは電気羊の夢を見るか',
      '風と共に去りぬ',
      'ライ麦畑でつかまえて',
      'オリバー・ツイスト',
      'シャーロック・ホームズの冒険',
      '白鯨',
      'ドン・キホーテ',
      'グレート・ギャツビー',
      'カラマーゾフの兄弟',
    ];

    // Determine how many we need to create (don't duplicate existing books)
    const toCreate = Math.max(0, DESIRED_TOTAL - existing);
    const existingRows = await prisma.book.findMany({ select: { title: true } });
    const existingTitles = new Set(existingRows.map((r: { title: string }) => r.title));

    const createdBooks: { id: number; title: string }[] = [];
    let createdCount = 0;
    for (let i = 0; i < titles.length && createdCount < toCreate; i++) {
      const title = titles[i];
      if (existingTitles.has(title)) continue;
      const isbn = `978-4-0000-${String(1000 + i).padStart(4, '0')}-${i % 10}`;
      const published = new Date(2000 + (i % 20), i % 12, (i % 26) + 1);
      const { book } = await seedFactory.createBookWithAuthor(prisma, {
        title,
        isbn,
        published,
        description: `${title} の説明（自動生成）`,
        authorName: `著者 ${i + 1}`,
      });
      createdBooks.push({ id: book.id, title: book.title });
      createdCount++;
    }

    // If still need more books (titles list exhausted), synthesize additional titles
    let synthIndex = titles.length;
    while (createdCount < toCreate) {
      const title = `自動生成書籍 ${synthIndex + 1}`;
      const isbn = `978-4-9999-${String(1000 + synthIndex).padStart(4, '0')}-${synthIndex % 10}`;
      const published = new Date(2000 + (synthIndex % 20), synthIndex % 12, (synthIndex % 26) + 1);
      const { book } = await seedFactory.createBookWithAuthor(prisma, {
        title,
        isbn,
        published,
        description: `${title} の説明（自動生成）`,
        authorName: `著者 自動${synthIndex + 1}`,
      });
      createdBooks.push({ id: book.id, title: book.title });
      createdCount++;
      synthIndex++;
    }

    // create loans: some returned, some active, some overdue
    const now = new Date();
    const makeDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    // create loans for first 24 books
    for (let i = 0; i < Math.min(24, createdBooks.length); i++) {
      const book = createdBooks[i];
      const borrower = borrowers[i % borrowers.length];
      const staff = staffMembers[i % staffMembers.length];

      if (i % 3 === 0) {
        // returned loan
        await prisma.loan.create({
          data: {
            bookId: book.id,
            borrowerId: borrower.id,
            staffId: staff.id,
            loanedAt: makeDate(30 + i),
            dueAt: makeDate(15 + i),
            returnedAt: makeDate(10 + i),
            status: 'returned',
          },
        });
      } else if (i % 3 === 1) {
        // currently loaned
        await prisma.loan.create({
          data: {
            bookId: book.id,
            borrowerId: borrower.id,
            staffId: staff.id,
            loanedAt: makeDate(3 + i),
            dueAt: makeDate( - (7 - (i % 7)) ),
            returnedAt: null,
            status: 'loaned',
          },
        });
      } else {
        // overdue
        await prisma.loan.create({
          data: {
            bookId: book.id,
            borrowerId: borrower.id,
            staffId: staff.id,
            loanedAt: makeDate(40 + i),
            dueAt: makeDate(20 + i),
            returnedAt: null,
            status: 'overdue',
          },
        });
      }
    }
  });
}

export default { runSeedIfNeeded };
