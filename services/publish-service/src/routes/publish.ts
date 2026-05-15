import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { createLogger } from '@aura/utils';
import { publishToInstagram } from '../publishers/instagram';
import { publishToFacebook } from '../publishers/facebook';
import { publishToLinkedIn } from '../publishers/linkedin';
import { publishToTwitter } from '../publishers/twitter';

const router = Router();
const logger = createLogger('publish-routes');

const publishers: Record<string, (post: any, account: any) => Promise<string>> = {
  instagram: publishToInstagram,
  facebook: publishToFacebook,
  linkedin: publishToLinkedIn,
  twitter: publishToTwitter,
};

router.post('/now/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const post = await prisma.contentPost.findUnique({ where: { id: req.params.postId } });
    if (!post) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } });
    }

    if (post.status !== 'approved') {
      return res.status(400).json({ success: false, error: { code: 'NOT_APPROVED', message: 'Post must be approved before publishing' } });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { tenantId: post.tenantId, platform: post.platform as any, isActive: true },
    });

    if (!account) {
      return res.status(400).json({ success: false, error: { code: 'NO_ACCOUNT', message: `No active ${post.platform} account found` } });
    }

    const publisher = publishers[post.platform];
    if (!publisher) {
      return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED', message: `Platform ${post.platform} not supported` } });
    }

    const platformPostId = await publisher(post, account);

    const updatedPost = await prisma.contentPost.update({
      where: { id: post.id },
      data: { status: 'published', publishedAt: new Date(), platformPostId },
    });

    logger.info({ postId: post.id, platform: post.platform }, 'Post published');
    return res.json({ success: true, data: updatedPost });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postIds } = req.body as { postIds: string[] };
    const results: { postId: string; success: boolean; error?: string }[] = [];

    for (const postId of postIds) {
      try {
        const post = await prisma.contentPost.findUnique({ where: { id: postId } });
        if (!post || post.status !== 'approved') {
          results.push({ postId, success: false, error: 'Not found or not approved' });
          continue;
        }

        const account = await prisma.socialAccount.findFirst({
          where: { tenantId: post.tenantId, platform: post.platform as any, isActive: true },
        });

        if (!account) {
          results.push({ postId, success: false, error: 'No active account' });
          continue;
        }

        const publisher = publishers[post.platform];
        if (!publisher) {
          results.push({ postId, success: false, error: 'Unsupported platform' });
          continue;
        }

        const platformPostId = await publisher(post, account);
        await prisma.contentPost.update({
          where: { id: postId },
          data: { status: 'published', publishedAt: new Date(), platformPostId },
        });

        results.push({ postId, success: true });
      } catch (err: any) {
        results.push({ postId, success: false, error: err.message });
      }
    }

    logger.info({ total: postIds.length, published: results.filter((r) => r.success).length }, 'Bulk publish completed');
    return res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/status/:tenantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await prisma.contentPost.findMany({
      where: { tenantId: req.params.tenantId, status: { in: ['approved', 'published'] } },
      select: {
        id: true,
        platform: true,
        status: true,
        scheduledFor: true,
        publishedAt: true,
        platformPostId: true,
      },
      orderBy: { scheduledFor: 'asc' },
    });

    return res.json({ success: true, data: posts });
  } catch (error) {
    next(error);
  }
});

export { router as publishRouter };
