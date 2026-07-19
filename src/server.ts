import app from './app';
import env from './config/env';
import connectDB from './config/database';
import ensureDefaultAdmin from './utils/ensureDefaultAdmin';

const startServer = async (): Promise<void> => {
  try {
    // Try to connect to MongoDB (non-fatal in development)
    try {
      await connectDB();
      await ensureDefaultAdmin();
    } catch (dbError: any) {
      console.warn(`\n⚠️  MongoDB not connected: ${dbError.message}`);
      console.warn('   Server will start without DB. API routes needing DB will fail.\n');
    }

    // Start server regardless of DB status
    const server = app.listen(env.PORT, () => {
      console.log(`\n🚀 WebiGeeks API Server`);
      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Port: ${env.PORT}`);
      console.log(`   URL: http://localhost:${env.PORT}`);
      console.log(`   Health: http://localhost:${env.PORT}/health\n`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('💤 Server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error) => {
      console.error('❌ Unhandled Rejection:', reason.message);
      shutdown('UNHANDLED_REJECTION');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('❌ Uncaught Exception:', error.message);
      shutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
