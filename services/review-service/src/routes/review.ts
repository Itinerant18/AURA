import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@aura/db';
import { reviewActionSchema, createLogger } from '@aura/utils';
import { publishEvent, createEvent, TOPICS } from '@aura/queue';

const router = Router();
const logger = createLogger('review-actions');

router.post('/action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = reviewActionSchema.parse(req.body);

    const post = await prisma.contentPost.findUnique({ where: { id: data.postId } });
    if (!post) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } });
    }

    let updatedStatus: string;

    switch (data.action) {
      case 'approve':
        updatedStatus = 'approved';
        break;
      case 'reject':
        updatedStatus = 'rejected';
        break;
      case 'request_modification':
        updatedStatus = 'draft';
        break;
      default:
        return res.status(400).json({ success: false, error: { code: 'INVALID_ACTION', message: 'Invalid review action' } });
    }

    const updatedPost = await prisma.contentPost.update({
      where: { id: data.postId },
      data: {
        status: updatedStatus as any,
        reviewerNotes: data.notes || null,
      },
    });

    if (data.action === 'approve') {
      try {
        const event = createEvent(TOPICS.POST_APPROVED, post.tenantId, {
          postId: post.id,
          scheduledFor: post.scheduledFor?.toISOString() || new Date().toISOString(),
        });
        await publishEvent(TOPICS.POST_APPROVED, event);
      } catch (pubErr) {
        logger.warn({ err: pubErr }, 'Failed to publish post.approved event (non-critical)');
      }
    }

    logger.info({ postId: data.postId, action: data.action }, 'Review action performed');
    return res.json({ success: true, data: updatedPost });
  } catch (error) {
    next(error);
  }
});

router.post('/bulk-approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postIds } = req.body as { postIds: string[] };

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'postIds array required' } });
    }

    const result = await prisma.contentPost.updateMany({
      where: { id: { in: postIds }, status: 'pending_review' },
      data: { status: 'approved' },
    });

    logger.info({ count: result.count }, 'Bulk approval completed');
    return res.json({ success: true, data: { approvedCount: result.count } });
  } catch (error) {
    next(error);
  }
});

export { router as reviewRouter };
