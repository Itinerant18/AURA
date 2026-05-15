import axios from 'axios';
import { decrypt } from '@aura/utils';
import { createLogger } from '@aura/utils';

const logger = createLogger('instagram-publisher');

export async function publishToInstagram(post: any, account: any): Promise<string> {
  const accessToken = decrypt(account.accessToken);

  // Step 1: Create media container
  const containerRes = await axios.post(
    `https://graph.facebook.com/v20.0/${account.platformUserId}/media`,
    {
      image_url: post.imageUrl,
      caption: `${post.caption}\n\n${(post.hashtags || []).map((h: string) => `#${h}`).join(' ')}`,
      access_token: accessToken,
    }
  );

  const creationId = containerRes.data.id;

  // Step 2: Publish the container
  const publishRes = await axios.post(
    `https://graph.facebook.com/v20.0/${account.platformUserId}/media_publish`,
    {
      creation_id: creationId,
      access_token: accessToken,
    }
  );

  logger.info({ platformPostId: publishRes.data.id }, 'Published to Instagram');
  return publishRes.data.id;
}
