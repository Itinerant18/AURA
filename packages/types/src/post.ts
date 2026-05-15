export type PostStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';
export type ContentType = 'image' | 'carousel' | 'reel' | 'story';

export interface ContentPost {
  id: string;
  tenantId: string;
  calendarId: string;
  calendarDate: string;
  platform: string;
  contentType: ContentType;
  caption: string;
  hashtags: string[];
  imageUrl?: string;
  imagePrompt?: string;
  status: PostStatus;
  reviewerNotes?: string;
  scheduledFor?: Date;
  publishedAt?: Date;
  platformPostId?: string;
  createdAt: Date;
}

export interface ReviewAction {
  postId: string;
  action: 'approve' | 'reject' | 'request_modification';
  notes?: string;
}

export interface PostAnalytics {
  id: string;
  postId: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  recordedAt: Date;
}

export interface BulkPublishInput {
  postIds: string[];
}
