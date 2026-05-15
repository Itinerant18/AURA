import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@aura/db';
import { loginSchema, registerSchema } from '@aura/utils';
import { createLogger } from '@aura/utils';

const router = Router();
const logger = createLogger('auth-routes');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';

function generateTokens(userId: string, tenantId: string, email: string, role: string) {
  const accessToken = jwt.sign({ userId, tenantId, email, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
  const refreshToken = jwt.sign({ userId, tenantId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
  return { accessToken, refreshToken, expiresIn: 86400 };
}

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const tenant = await prisma.tenant.create({
      data: { name: data.tenantName },
    });

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: data.email,
        passwordHash,
        role: 'owner',
      },
    });

    const tokens = generateTokens(user.id, tenant.id, user.email, user.role);
    logger.info({ userId: user.id, tenantId: tenant.id }, 'User registered');

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, tenantId: tenant.id },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { tenant: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = generateTokens(user.id, user.tenantId, user.email, user.role);
    logger.info({ userId: user.id }, 'User logged in');

    return res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const tokens = generateTokens(user.id, user.tenantId, user.email, user.role);
    return res.json({ success: true, data: { tokens } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: { id: user.tenant.id, name: user.tenant.name, plan: user.tenant.plan },
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
