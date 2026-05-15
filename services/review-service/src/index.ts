import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@aura/utils';
import { queueRouter } from './routes/queue';
import { reviewRouter } from './routes/review';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const logger = createLogger('review-service');
const PORT = process.env.PORT || 4007;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'review-service' });
});

app.use('/api/review/queue', queueRouter);
app.use('/api/review', reviewRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Review service running on port ${PORT}`);
});

export default app;
