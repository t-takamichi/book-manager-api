import { serve } from '@hono/node-server';
import { createApp } from './presentation/integration/helpers/createApp';

async function boot() {
  const { app, issuer } = await createApp();

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
