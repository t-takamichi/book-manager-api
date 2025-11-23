const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  // Default behavior: run tests against sqlite unless JEST_USE_MYSQL=true is set.
  // This makes unit tests that mock Prisma easier to run locally without MySQL.
  const useMySql = process.env.JEST_USE_MYSQL === 'true';
  // Default to sqlite when DATABASE_URL is not provided, unless explicitly asked to use MySQL.
  const isSqlite = !useMySql && ((process.env.DATABASE_URL || '').startsWith('file:') || !process.env.DATABASE_URL);

  if (isSqlite) {
    const schema = path.resolve(__dirname, 'prisma/schema.sqlite.prisma');
    const dbFile = path.resolve(__dirname, 'dev-test.db');

    // Ensure environment for prisma commands
    const env = Object.assign({}, process.env, {
      DATABASE_URL: `file:${dbFile}`,
    });

    console.log('jest.globalSetup: preparing sqlite test DB at', dbFile);

    // Push schema and generate client for the sqlite schema
    execSync(`npx prisma db push --schema=${schema}`, { stdio: 'inherit', env });
    execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit', env });
    return;
  }

  // Non-sqlite (e.g. MySQL) path: expect DATABASE_URL to point to the target DB.
  // Use the default schema.prisma
  const schema = path.resolve(__dirname, 'prisma/schema.prisma');
  console.log('jest.globalSetup: preparing DB using schema', schema);

  // Run prisma commands using the existing environment (DATABASE_URL should be set by CI)
  execSync(`npx prisma db push --schema=${schema}`, { stdio: 'inherit', env: process.env });
  execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit', env: process.env });
  
  // Clean existing data to ensure tests run against a fresh DB state.
  // Parse DATABASE_URL to run a truncate sequence via mysql client (CI provides client).
  try {
    const dbUrl = new URL(process.env.DATABASE_URL);
    if (dbUrl.protocol.startsWith('mysql')) {
      const user = dbUrl.username || 'root';
      const pass = dbUrl.password ? `-p${dbUrl.password}` : '';
      const host = dbUrl.hostname || '127.0.0.1';
      const port = dbUrl.port || '3306';
      const dbName = dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : '';
      if (dbName) {
        console.log('jest.globalSetup: truncating tables in', dbName);
        const sql = [
          'SET FOREIGN_KEY_CHECKS=0;',
          'TRUNCATE TABLE loans;',
          'TRUNCATE TABLE book_authors;',
          'TRUNCATE TABLE books;',
          'TRUNCATE TABLE authors;',
          'TRUNCATE TABLE borrowers;',
          'TRUNCATE TABLE staff;',
          'SET FOREIGN_KEY_CHECKS=1;'
        ].join(' ');
        execSync(
          `mysql -h ${host} -P ${port} -u ${user} ${pass} ${dbName} -e "${sql}"`,
          { stdio: 'inherit' }
        );
      }
    }
  } catch (e) {
    console.warn('jest.globalSetup: failed to truncate MySQL tables', e.message || e);
  }
};
