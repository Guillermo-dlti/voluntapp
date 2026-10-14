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

// BAMX works in Guadalajara: calendar days in requests and dates in exports follow its clock.
export const timeZone = 'America/Mexico_City';

const wallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// A moment as Guadalajara wall clock parts, all zero padded.
export function mexicoParts(moment: Date): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = Object.fromEntries(wallClock.formatToParts(moment).map((part) => [part.type, part.value]));
  return { year: parts.year ?? '', month: parts.month ?? '', day: parts.day ?? '', hour: parts.hour ?? '', minute: parts.minute ?? '' };
}

// True for a real YYYY-MM-DD day; 2026-02-30 fails because Date would roll it over to March.
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// The UTC instant when a Guadalajara calendar day starts. The offset is read from Intl (twice, to
// settle on the right side of a change) instead of a fixed −6, so it stays right if daylight saving returns.
export function mexicoDayStart(date: string): Date {
  const wall = Date.parse(`${date}T00:00:00Z`);
  const offsetAt = (instant: number) => {
    const p = mexicoParts(new Date(instant));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)) - instant;
  };
  let instant = wall - offsetAt(wall);
  instant = wall - offsetAt(instant);
  return new Date(instant);
}

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
