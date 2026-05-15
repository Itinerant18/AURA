import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { encrypt } from '@aura/utils';
import { createLogger } from '@aura/utils';

const router = Router();
const logger = createLogger('oauth-routes');

router.get('/:platform/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'Authorization code and state required' } });
    }

    // In production, exchange `code` for tokens via platform-specific OAuth flow.
    // For MVP, we store the code as a placeholder.
    logger.info({ platform }, 'OAuth callback received');

    return res.json({
      success: true,
      data: { message: `OAuth callback received for ${platform}. Token exchange pending.` },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, accessToken, refreshToken, platformUserId, accountName, tenantId } = req.body;

    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;

    const account = await prisma.socialAccount.upsert({
      where: { tenantId_platform: { tenantId, platform } },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        platformUserId,
        accountName,
        isActive: true,
        lastSyncedAt: new Date(),
      },
      create: {
        tenantId,
        platform,
        platformUserId,
        accountName,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });

    logger.info({ tenantId, platform }, 'Social account connected');
    return res.json({ success: true, data: { id: account.id, platform: account.platform, accountName: account.accountName } });
  } catch (error) {
    next(error);
  }
});

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

export { router as oauthRouter };
