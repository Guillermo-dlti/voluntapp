// Server logs carry event names, IDs, and counts only. Values are limited to primitives and any
// key that could hold personal data or a secret is dropped, so a careless call can't leak it.
type LogValue = string | number | boolean | null;
type LogFields = Record<string, LogValue>;

const blockedKey = /name|email|phone|birth|password|hash|token|secret|uri|note|contact|body/i;

function clean(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!blockedKey.test(key)) safe[key] = value;
  }
  return safe;
}

function write(level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) {
  const line = JSON.stringify({ level, event, ...clean(fields), at: new Date().toISOString() });
  if (level === 'info') console.log(line);
  else console.error(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
