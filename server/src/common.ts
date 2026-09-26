import { MongoServerError, ObjectId, type ClientSession, type MongoClient } from 'mongodb';
import type { Request, Response } from 'express';

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

export const noControlChars = /^[^\p{Cc}]*$/u;

// Thrown inside a transaction to abort it and answer with a plain message.
export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: Record<string, unknown>) { super('http'); }
}
export const conflict = (message: string, extra: Record<string, unknown> = {}) => new HttpError(409, { message, ...extra });

// Runs a handler that may throw HttpError (usually from inside a transaction) and answers with it.
export async function answering(response: Response, work: () => Promise<void>) {
  try {
    await work();
  } catch (error: unknown) {
    if (error instanceof HttpError) { response.status(error.status).json(error.body); return; }
    throw error;
  }
}

export function jsonBody(request: Request, response: Response): boolean {
  if (request.is('application/json')) return true;
  response.status(400).json({ message: 'No pudimos leer los datos enviados.' });
  return false;
}
