const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
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
};
