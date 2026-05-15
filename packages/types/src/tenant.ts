export interface Tenant {
  id: string;
  name: string;
  plan: 'starter' | 'growth' | 'agency';
  stripeCustomerId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  plan?: 'starter' | 'growth' | 'agency';
}
