import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@aura/utils';
import { authRouter } from './routes/auth';
import { oauthRouter } from './routes/oauth';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const logger = createLogger('auth-service');
const PORT = process.env.PORT || 4001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

app.use('/api/auth', authRouter);
app.use('/api/oauth', oauthRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Auth service running on port ${PORT}`);
});

export default app;
