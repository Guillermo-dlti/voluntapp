import { mexicoParts } from './common.js';

// A cell is either text (anything that came from a person: names, places) or a value the server
// formatted itself (numbers, dates). Only text can carry a formula, so only text is guarded.
export type CsvCell = { text: string } | { plain: string };

export const text = (value: string): CsvCell => ({ text: value });
export const plain = (value: string): CsvCell => ({ plain: value });
export const hours = (value: number): CsvCell => plain(value.toFixed(2));
export const count = (value: number): CsvCell => plain(String(Math.trunc(value)));

// "dd/mm/aaaa HH:mm" in Guadalajara time, the way staff read dates in Excel.
export function dateTime(moment: Date): CsvCell {
  const p = mexicoParts(moment);
  return plain(`${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`);
}

// Excel runs a cell that starts with one of these as a formula (=HYPERLINK(...) can leak data or
// launch commands). A leading apostrophe makes it show as plain text instead.
const formulaStart = /^[=+\-@\t\r]/;

function quoted(value: string): string {
  const safe = formulaStart.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function cell(value: CsvCell): string {
  return 'text' in value ? quoted(value.text) : value.plain;
}

// UTF-8 with a byte order mark (so Excel reads accents right), comma separated, CRLF line endings.
// Comma and dot decimal match Mexico's regional settings, so the file opens in columns in es-MX Excel.
export function buildCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header.map(quoted), ...rows.map((row) => row.map(cell))].map((line) => line.join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
