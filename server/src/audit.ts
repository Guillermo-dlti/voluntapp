import { ObjectId } from 'mongodb';
import type { ClientSession, Document } from 'mongodb';
import type { AuditAction, V2Collections } from './collections.js';

// Never copied into an audit snapshot: credentials and live sessions must not spread to a second place.
const secretFields = new Set(['passwordHash', 'sessions']);

function snapshot(record: Document | null | undefined): Document | undefined {
  if (!record) return undefined;
  const copy: Document = {};
  for (const [key, value] of Object.entries(record)) {
    if (!secretFields.has(key)) copy[key] = value;
  }
  return copy;
}

export interface AuditInput {
  actorId: ObjectId;
  action: AuditAction;
  collection: string;
  recordId?: ObjectId;
  before?: Document | null;
  after?: Document | null;
}

// The only write path to audit_log, and it only inserts. Pass the transaction's session so the
// entry commits or rolls back together with the change it describes.
export async function writeAudit(
  collections: Pick<V2Collections, 'auditLog'>,
  entry: AuditInput,
  session?: ClientSession,
): Promise<void> {
  const before = snapshot(entry.before);
  const after = snapshot(entry.after);
  await collections.auditLog.insertOne({
    _id: new ObjectId(),
    actorId: entry.actorId,
    action: entry.action,
    collection: entry.collection,
    ...(entry.recordId ? { recordId: entry.recordId } : {}),
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
    createdAt: new Date(),
  }, session ? { session } : {});
}
