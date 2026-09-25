import { MongoClient } from 'mongodb';
import { ensureCollections } from './collections.js';
import type { User } from './users.js';

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
    // v1 volunteer accounts; still used by the current login until staff auth replaces it.
    const users = database.collection<User>('users');
    await users.createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      { key: { username: 1 }, name: 'users_username_unique', unique: true },
      { key: { 'sessions.tokenHash': 1 }, name: 'users_session_tokens', sparse: true },
    ]);
    return { client, database, users };
  } catch (error: unknown) {
    await client.close();
    throw error;
  }
}
