import { MongoServerError, ObjectId, type ClientSession, type MongoClient } from 'mongodb';

export function parseId(value: unknown): ObjectId | null {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value) ? new ObjectId(value) : null;
}

export function isDuplicate(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

// A change and its audit entry commit together, or neither does. withTransaction also retries the
// whole callback on a write conflict, which is what serializes competing assignments.
export function inTransaction<T>(client: MongoClient, work: (session: ClientSession) => Promise<T>): Promise<T> {
  return client.withSession((session) => session.withTransaction(() => work(session)));
}

// Search should find "López" when staff type "lopez", so each vowel (and n) matches its accented forms.
const accentClasses: Record<string, string> = { a: '[aáä]', e: '[eéë]', i: '[iíï]', o: '[oóö]', u: '[uúü]', n: '[nñ]' };
export function searchPattern(word: string): RegExp {
  const escaped = word.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped.replace(/[aeioun]/gi, (char) => accentClasses[char.toLowerCase()] ?? char), 'i');
}

// Up to five search words; under 2 characters in total matches almost everything, so it's no search.
export function searchWords(q: string | undefined): string[] {
  const words = (q ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  return words.join('').length < 2 ? [] : words;
}
