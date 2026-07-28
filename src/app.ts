import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import env from './config/env';
import passport from './config/passport';
import errorHandler from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import routes from './routes';

const app = express();

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS — allow frontend origin(s)
const allowedOrigins = [
  env.FRONTEND_URL,
  env.SITE_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

// Dev-only: the frontend's own rewrite proxy (next.config.ts) forwards the
// browser's original Origin header straight through when it forwards a
// request here, so testing from a phone on the same LAN (http://192.168.x.x:3000,
// etc. — whatever address DHCP happens to hand out) hits this check too, not
// just direct browser calls. Gated to development so it can never widen what
// production accepts.
const isDevLanOrigin = (origin: string): boolean =>
  env.NODE_ENV === 'development' &&
  /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\.[\d.]+:3000$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || isDevLanOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Handle preflight requests explicitly
app.options('*', cors());

// Cookie parsing (required for httpOnly auth cookie)
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Prevent HTTP parameter pollution
app.use(hpp());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Google OAuth (stateless — no session store, we issue our own JWT cookie)
app.use(passport.initialize());

// Logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'WebiGeeks API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

export default app;
