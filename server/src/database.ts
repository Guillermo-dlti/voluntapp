import { MongoClient } from 'mongodb';
import { ensureCollections, v2Collections } from './collections.js';

export async function connectDatabase(uri: string, databaseName: string) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    maxPoolSize: 10,
  });
  try {
    await client.connect();
    const database = client.db(databaseName);
    await database.command({ ping: 1 });
    await ensureCollections(database);
    return { client, database, collections: v2Collections(database) };
  } catch (error: unknown) {
    await client.close();
    throw error;
  }
}
