import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { createLogger } from '@aura/utils';

const router = Router();
const logger = createLogger('social-routes');

router.get('/accounts/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { tenantId: req.params.tenantId },
      select: {
        id: true,
        platform: true,
        accountName: true,
        followersCount: true,
        isActive: true,
        lastSyncedAt: true,
      },
    });
    return res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

router.delete('/accounts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.socialAccount.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    logger.info({ accountId: req.params.id }, 'Social account disconnected');
    return res.json({ success: true, data: { message: 'Account disconnected' } });
  } catch (error) {
    next(error);
  }
});

export { router as socialRouter };
