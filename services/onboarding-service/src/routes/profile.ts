import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { businessProfileSchema, createLogger } from '@aura/utils';

const router = Router();
const logger = createLogger('profile-routes');

router.post('/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params;
    const data = businessProfileSchema.parse(req.body);

    const profile = await prisma.businessProfile.upsert({
      where: { tenantId },
      update: {
        name: data.name,
        category: data.category,
        location: data.location,
        brandVoice: data.brandVoice,
        targetAudience: data.targetAudience,
        usps: data.usps,
        menuItems: data.menuItems,
        upcomingEvents: data.upcomingEvents,
        competitorNames: data.competitorNames,
      },
      create: {
        tenantId,
        name: data.name,
        category: data.category,
        location: data.location,
        brandVoice: data.brandVoice,
        targetAudience: data.targetAudience,
        usps: data.usps,
        menuItems: data.menuItems,
        upcomingEvents: data.upcomingEvents,
        competitorNames: data.competitorNames,
      },
    });

    logger.info({ tenantId }, 'Business profile saved');
    return res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.get('/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.businessProfile.findUnique({
      where: { tenantId: req.params.tenantId },
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Business profile not found' } });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

export { router as profileRouter };
