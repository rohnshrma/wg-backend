/* eslint-disable no-console */
// Standalone local MongoDB instance for development on machines without a
// system-installed MongoDB. Not used in production or in the test suite
// (see jest.setup.ts for the per-test-run instance) — this one persists
// data to disk across restarts within this checkout.
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  const dbPath = path.join(__dirname, '..', '.devdata', 'mongo');
  const mongod = await MongoMemoryServer.create({
    instance: {
      port: 27017,
      dbPath,
      storageEngine: 'wiredTiger',
      launchTimeout: 60000,
    },
  });

  const uri = mongod.getUri('webigeeks');
  console.log(`Local dev MongoDB running at ${uri}`);
  console.log('Press Ctrl+C to stop.');

  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start local dev MongoDB:', err);
  process.exit(1);
});
