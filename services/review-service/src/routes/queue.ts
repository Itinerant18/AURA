import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { createLogger } from '@aura/utils';

const router = Router();
const logger = createLogger('review-queue');

router.get('/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params;
    const { status = 'pending_review' } = req.query;

    const posts = await prisma.contentPost.findMany({
      where: {
        tenantId,
        status: status as any,
      },
      orderBy: { calendarDate: 'asc' },
      include: {
        calendar: { select: { monthStart: true, status: true } },
      },
    });

    return res.json({ success: true, data: posts, meta: { total: posts.length } });
  } catch (error) {
    next(error);
  }
});

router.get('/stats/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params;

    const [pending, approved, rejected, published] = await Promise.all([
      prisma.contentPost.count({ where: { tenantId, status: 'pending_review' } }),
      prisma.contentPost.count({ where: { tenantId, status: 'approved' } }),
      prisma.contentPost.count({ where: { tenantId, status: 'rejected' } }),
      prisma.contentPost.count({ where: { tenantId, status: 'published' } }),
    ]);

    return res.json({
      success: true,
      data: { pending, approved, rejected, published, total: pending + approved + rejected + published },
    });
  } catch (error) {
    next(error);
  }
});

export { router as queueRouter };
