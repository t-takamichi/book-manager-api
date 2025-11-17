const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const useMySql = process.env.JEST_USE_MYSQL === 'true';
  const isSqlite = !useMySql && ((process.env.DATABASE_URL || '').startsWith('file:') || !process.env.DATABASE_URL);

  if (isSqlite) {
    const schema = path.resolve(__dirname, 'prisma/schema.sqlite.prisma');
    const dbFile = path.resolve(__dirname, 'dev-test.db');
    const env = Object.assign({}, process.env, { DATABASE_URL: `file:${dbFile}` });

    console.log('jest.globalSetup: preparing sqlite test DB at', dbFile);
    execSync(`npx prisma db push --schema=${schema}`, { stdio: 'inherit', env });
    execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit', env });
    return;
  }

  const schema = path.resolve(__dirname, 'prisma/schema.prisma');
  console.log('jest.globalSetup: preparing DB using schema', schema);

  execSync(`npx prisma db push --schema=${schema}`, { stdio: 'inherit', env: process.env });
  execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit', env: process.env });

  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (dbUrl.protocol.startsWith('mysql')) {
      const user = dbUrl.username || 'root';
      const pass = dbUrl.password ? `-p${dbUrl.password}` : '';
      const host = dbUrl.hostname || '127.0.0.1';
      const port = dbUrl.port || '3306';
      const dbName = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : '';
      if (dbName) {
        console.log('jest.globalSetup: truncating tables in', dbName, 'using Prisma client');
        // Use Prisma Client (produced by `prisma generate` above) to run truncation
        // This avoids depending on a system `mysql` binary in the container.
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        try {
          await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
          const tables = ['loans', 'book_authors', 'books', 'authors', 'borrowers', 'staff'];
          for (const t of tables) {
            try {
              await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${t}`);
            } catch (e) {
              // ignore individual truncate errors (table may not exist yet)
              console.warn('jest.globalSetup: truncate failed for', t, e.message || e);
            }
          }
          await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
        } finally {
          await prisma.$disconnect();
        }
      }
    }
  } catch (e) {
    console.warn('jest.globalSetup: failed to truncate MySQL tables', e.message || e);
  }
};
