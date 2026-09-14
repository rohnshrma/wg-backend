import Tenant, { ITenant } from '../../src/models/Tenant';
import env from '../../src/config/env';

/**
 * Seeds the default tenant tests run against. clearTestDB() wipes every
 * collection between tests, so this must be called again in each
 * beforeEach — a beforeAll seed would only survive the first test.
 * Uses env.DEFAULT_TENANT_SLUG so requests through resolveTenant (register,
 * login, GET /api/tenant/current, etc.) resolve to this same tenant without
 * the test needing to know its id ahead of time.
 */
export async function seedTestTenant(overrides: Partial<ITenant> = {}): Promise<ITenant> {
  return Tenant.create({
    slug: env.DEFAULT_TENANT_SLUG,
    name: 'Test Tenant',
    contactPhone: '+91 0000000000',
    contactEmail: 'test-tenant@example.com',
    address: 'Test Address',
    ...overrides,
  });
}
