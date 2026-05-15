import axios from 'axios';
import { decrypt } from '@aura/utils';
import { createLogger } from '@aura/utils';

const logger = createLogger('linkedin-publisher');

export async function publishToLinkedIn(post: any, account: any): Promise<string> {
  const accessToken = decrypt(account.accessToken);

  const res = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${account.platformUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: `${post.caption}\n\n${(post.hashtags || []).map((h: string) => `#${h}`).join(' ')}` },
          shareMediaCategory: post.imageUrl ? 'IMAGE' : 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    { headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' } }
  );

  logger.info({ platformPostId: res.data.id }, 'Published to LinkedIn');
  return res.data.id;
}
