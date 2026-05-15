import { z } from 'zod';

export const emailSchema = z.string().email();
export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const businessProfileSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  brandVoice: z.enum(['professional', 'friendly', 'playful', 'premium']),
  targetAudience: z.object({
    ageRange: z.object({ min: z.number(), max: z.number() }),
    interests: z.array(z.string()),
    demographics: z.array(z.string()),
  }),
  usps: z.array(z.string()),
  menuItems: z
    .array(
      z.object({
        name: z.string(),
        price: z.number(),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .optional()
    .default([]),
  upcomingEvents: z.array(z.record(z.any())).optional().default([]),
  competitorNames: z.array(z.string()).optional().default([]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  tenantName: z.string().min(1).max(255),
});

export const reviewActionSchema = z.object({
  postId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'request_modification']),
  notes: z.string().optional(),
});

export { z };
