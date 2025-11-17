const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');
  if (!isSqlite) return;

  const dbFile = path.resolve(__dirname, 'dev-test.db');
  try {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
      console.log('jest.globalTeardown: removed', dbFile);
    }
  } catch (e) {
    console.warn('jest.globalTeardown: cleanup failed', e.message || e);
  }
};
