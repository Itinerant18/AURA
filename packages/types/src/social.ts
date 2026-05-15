export type Platform = 'instagram' | 'facebook' | 'linkedin' | 'twitter';

export interface SocialAccount {
  id: string;
  tenantId: string;
  platform: Platform;
  platformUserId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  accountName?: string;
  followersCount?: number;
  isActive: boolean;
  lastSyncedAt?: Date;
  createdAt: Date;
}

export interface ConnectSocialInput {
  platform: Platform;
  authCode: string;
  redirectUri: string;
}
