import axios from 'axios';
import { decrypt } from '@aura/utils';
import { createLogger } from '@aura/utils';

const logger = createLogger('facebook-publisher');

export async function publishToFacebook(post: any, account: any): Promise<string> {
  const accessToken = decrypt(account.accessToken);

  const res = await axios.post(
    `https://graph.facebook.com/v20.0/${account.platformUserId}/feed`,
    {
      message: `${post.caption}\n\n${(post.hashtags || []).map((h: string) => `#${h}`).join(' ')}`,
      link: post.imageUrl || undefined,
      access_token: accessToken,
    }
  );

  logger.info({ platformPostId: res.data.id }, 'Published to Facebook');
  return res.data.id;
}
