export interface Location {
  city: string;
  state: string;
  country: string;
  lat?: number;
  lng?: number;
}

export interface MenuItem {
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
}

export interface TargetAudience {
  ageRange: { min: number; max: number };
  interests: string[];
  demographics: string[];
}

export interface BusinessProfile {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  location: Location;
  brandVoice: 'professional' | 'friendly' | 'playful' | 'premium';
  targetAudience: TargetAudience;
  usps: string[];
  menuItems: MenuItem[];
  upcomingEvents: Record<string, any>[];
  competitorNames: string[];
  updatedAt: Date;
}

export interface CreateBusinessProfileInput {
  name: string;
  category: string;
  location: Location;
  brandVoice: 'professional' | 'friendly' | 'playful' | 'premium';
  targetAudience: TargetAudience;
  usps: string[];
  menuItems?: MenuItem[];
  upcomingEvents?: Record<string, any>[];
  competitorNames?: string[];
}
