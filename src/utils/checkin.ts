// Same pattern as server/src/checkin-token.ts. A QR that doesn't match it can't be a volunteer's code,
// so the scanner refuses it without calling the API.
const CHECKIN_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

// A code held in front of the camera is read many times a second; it counts once per this window.
export const REPEAT_WINDOW_MS = 3000;

export function isCheckinToken(text: string): boolean {
  return CHECKIN_TOKEN_PATTERN.test(text);
}

export interface LastRead {
  code: string;
  at: number;
}

// Whether a camera read should be handled: never while a request is in flight, and not the same code
// again within the repeat window.
export function shouldHandleScan(code: string, now: number, inFlight: boolean, last: LastRead | null): boolean {
  if (inFlight) return false;
  return !last || last.code !== code || now - last.at >= REPEAT_WINDOW_MS;
}
