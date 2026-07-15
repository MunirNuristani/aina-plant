import { config } from './config';
import { createApp } from './app';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT} (${config.NODE_ENV})`);
});
