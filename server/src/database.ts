import { MongoClient } from 'mongodb';
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
    const users = database.collection<User>('users');
    await users.createIndexes([
      { key: { email: 1 }, name: 'users_email_unique', unique: true },
      { key: { username: 1 }, name: 'users_username_unique', unique: true },
    ]);
    return { client, database, users };
  } catch (error: unknown) {
    await client.close();
    throw error;
  }
}
