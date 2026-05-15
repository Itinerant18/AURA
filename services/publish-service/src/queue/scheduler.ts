import { prisma } from '@aura/db';
import { createLogger } from '@aura/utils';

const logger = createLogger('scheduler');

export async function processScheduledPosts(): Promise<void> {
  const now = new Date();
  const posts = await prisma.contentPost.findMany({
    where: {
      status: 'approved',
      scheduledFor: { lte: now },
    },
    take: 10,
  });

  for (const post of posts) {
    logger.info({ postId: post.id, scheduledFor: post.scheduledFor }, 'Processing scheduled post');
    // In production, this would trigger the publishing pipeline
  }
}

// Run scheduler every minute
if (process.env.ENABLE_SCHEDULER === 'true') {
  setInterval(processScheduledPosts, 60_000);
  logger.info('Post scheduler started');
}
