import { serve } from '@hono/node-server';
import { createApp } from './presentation/integration/helpers/createApp';
import { runSeedIfNeeded } from '@web/infrastructure/db/seed';

async function boot() {
  const { app, issuer } = await createApp();

  // Run seed on startup when enabled via env or in test environment
  try {
    await runSeedIfNeeded(issuer as any);
  } catch (e) {
    console.error('Seed on startup failed:', e);
  }

  serve(
    {
      fetch: app.fetch,
      port: Number(process.env.PORT || 3000),
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
    },
  );

  // handle graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await issuer.disconnect();
    } finally {
      process.exit(0);
    }
  });
}

boot();
