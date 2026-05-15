export interface ContentPillar {
  name: string;
  description: string;
  percentage: number;
}

export interface PlatformStrategy {
  platform: string;
  postingFrequency: string;
  bestTimes: string[];
  toneGuidelines: string;
  contentTypes: string[];
}

export interface KPI {
  metric: string;
  target: number;
  unit: string;
}

export interface StrategySummary {
  pillars: ContentPillar[];
  kpis: KPI[];
  platformStrategies: PlatformStrategy[];
  seoKeywords: string[];
  hashtagBanks: Record<string, string[]>;
  campaignRecommendations: string[];
}

export interface CalendarSlot {
  date: string;
  platform: string;
  contentType: 'image' | 'carousel' | 'reel' | 'story';
  topic: string;
  hook: string;
  hashtags: string[];
  pillar: string;
}

export interface ContentCalendar {
  id: string;
  tenantId: string;
  monthStart: string;
  strategySummary: StrategySummary;
  slots: CalendarSlot[];
  sheetsId?: string;
  status: 'generating' | 'active' | 'archived';
  createdAt: Date;
}
