export interface CompetitorMetrics {
  followers: number;
  engagementRate: number;
  postFrequency: number;
  avgEngagement: number;
}

export interface CompetitorReport {
  id: string;
  tenantId: string;
  competitorName: string;
  platform: string;
  metrics: CompetitorMetrics;
  prosCons: {
    pros: string[];
    cons: string[];
    opportunities: string[];
  };
  rawPosts: Record<string, any>[];
  generatedAt: Date;
}
