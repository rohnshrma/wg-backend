import { Request, Response, NextFunction } from 'express';
import Tenant, { ITenant } from '../models/Tenant';
import env from '../config/env';
import asyncHandler from '../utils/asyncHandler';
import { NotFoundError } from '../utils/apiError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required TS pattern for augmenting Express's types
  namespace Express {
    interface Request {
      tenant?: ITenant;
    }
  }
}

/**
 * Resolves the current tenant for unauthenticated, host-based requests
 * (public storefront reads — branding, course listings, lead capture).
 * Authenticated routes get req.tenantId from the JWT/user record instead
 * (see auth.middleware.ts) since a logged-in admin's own tenant is the
 * source of truth regardless of which host they're browsing from.
 *
 * Resolution order: exact custom domain match, then the first label of a
 * PLATFORM_ROOT_DOMAIN subdomain (acme.webigeeks.app -> "acme"), then an
 * explicit ?tenant= / X-Tenant-Slug override for local dev/testing, then
 * DEFAULT_TENANT_SLUG so the existing webigeeks.in apex keeps working
 * unchanged until it's deliberately migrated to its own tenant record.
 */
export const resolveTenant = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const host = req.hostname?.toLowerCase();

    let tenant: ITenant | null = null;

    if (host) {
      tenant = await Tenant.findOne({ customDomain: host, isActive: true });

      if (!tenant && env.PLATFORM_ROOT_DOMAIN !== 'localhost' && host.endsWith(`.${env.PLATFORM_ROOT_DOMAIN}`)) {
        const slug = host.slice(0, -`.${env.PLATFORM_ROOT_DOMAIN}`.length);
        tenant = await Tenant.findOne({ slug, isActive: true });
      }
    }

    if (!tenant) {
      const overrideSlug = (req.query.tenant as string) || (req.headers['x-tenant-slug'] as string);
      if (overrideSlug) {
        tenant = await Tenant.findOne({ slug: overrideSlug.toLowerCase(), isActive: true });
      }
    }

    if (!tenant) {
      tenant = await Tenant.findOne({ slug: env.DEFAULT_TENANT_SLUG, isActive: true });
    }

    if (!tenant) {
      throw new NotFoundError('No tenant configured for this domain');
    }

    req.tenant = tenant;
    req.tenantId = (tenant._id as unknown as { toString(): string }).toString();
    next();
  }
);
