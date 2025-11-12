const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  // Choose schema based on DATABASE_URL. If DATABASE_URL is a sqlite file URL,
  // use the sqlite schema; otherwise use the default schema.prisma (for MySQL etc.).
  const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

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
};
