import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@aura/utils';
import { profileRouter } from './routes/profile';
import { socialRouter } from './routes/social';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const logger = createLogger('onboarding-service');
const PORT = process.env.PORT || 4002;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'onboarding-service' });
});

app.use('/api/profile', profileRouter);
app.use('/api/social', socialRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Onboarding service running on port ${PORT}`);
});

export default app;
