import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@aura/utils';
import { publishRouter } from './routes/publish';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const logger = createLogger('publish-service');
const PORT = process.env.PORT || 4008;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'publish-service' });
});

app.use('/api/publish', publishRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Publish service running on port ${PORT}`);
});

export default app;
