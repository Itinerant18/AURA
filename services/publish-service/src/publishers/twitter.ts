import axios from 'axios';
import { decrypt } from '@aura/utils';
import { createLogger } from '@aura/utils';

const logger = createLogger('twitter-publisher');

export async function publishToTwitter(post: any, account: any): Promise<string> {
  const accessToken = decrypt(account.accessToken);

  const text = post.caption.substring(0, 280);

  const res = await axios.post(
    'https://api.twitter.com/2/tweets',
    { text },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  logger.info({ platformPostId: res.data.data.id }, 'Published to Twitter');
  return res.data.data.id;
}
