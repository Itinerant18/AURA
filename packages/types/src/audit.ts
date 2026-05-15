export interface AuditScores {
  profileCompleteness: number;
  postingFrequency: number;
  engagementRate: number;
  contentMix: number;
  hashtagStrategy: number;
  audienceGrowth: number;
  bestPerformingContent: number;
  responseTime: number;
  seoDiscoverability: number;
  overall: number;
}

export interface AuditInsights {
  topPosts: { postId: string; engagement: number; type: string }[];
  actionItems: { priority: 'high' | 'medium' | 'low'; description: string; impact: string }[];
  strengths: string[];
  weaknesses: string[];
}

export interface AuditReport {
  id: string;
  tenantId: string;
  generatedAt: Date;
  scores: AuditScores;
  insights: AuditInsights;
  pdfUrl?: string;
  status: 'processing' | 'complete' | 'failed';
  periodStart: string;
  periodEnd: string;
}

export type AuditDimension = keyof AuditScores;
export type TrafficLight = 'red' | 'amber' | 'green';

export function scoreToTrafficLight(score: number): TrafficLight {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}
