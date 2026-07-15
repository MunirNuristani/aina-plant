import { config } from './config';
import { createApp } from './app';
import { verifyDatabaseConnection } from './db';

async function main(): Promise<void> {
  await verifyDatabaseConnection();

  const app = createApp();

  app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT} (${config.NODE_ENV})`);
  });
}

main();
