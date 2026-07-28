import rateLimit from 'express-rate-limit';

// The limiters count per-IP across a 15-minute window, but a whole Jest run
// hits them from a single loopback address — the suite would trip `authLimiter`
// (10 logins) partway through and every later request would fail as
// unauthenticated. Skipping under NODE_ENV=test keeps the limits fully active
// in development and production, where they actually matter.
const skipInTests = () => process.env.NODE_ENV === 'test';

// General API rate limiter
export const apiLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (stricter)
export const authLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login/register attempts
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Inquiry rate limiter
export const inquiryLimiter = rateLimit({
  skip: skipInTests,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 inquiries per hour
  message: {
    success: false,
    message: 'Too many inquiries submitted, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
