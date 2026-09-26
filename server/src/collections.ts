import { MongoServerError } from 'mongodb';
import type { Db, Document, IndexDescription, ObjectId } from 'mongodb';
import { log } from './logger.js';

export type StaffRole = 'admin' | 'coordinator' | 'supervisor';

export interface StaffSession {
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface StaffUser {
  _id: ObjectId;
  fullName: string;
  email: string;
  passwordHash: string;
  role: StaffRole;
  active: boolean;
  sessions?: StaffSession[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Volunteer {
  _id: ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  birthDate?: Date;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: 'active' | 'inactive';
  notes?: string;
  // Internal: rewritten in every assignment transaction so two of them for the same person collide.
  assignmentLock?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface Activity {
  _id: ObjectId;
  name: string;
  description?: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  // Number of `assigned` assignments; the capacity check runs against it atomically.
  assignedCount: number;
  requirements?: string;
  status: 'draft' | 'open' | 'closed' | 'cancelled';
  supervisorId?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  _id: ObjectId;
  volunteerId: ObjectId;
  activityId: ObjectId;
  assignedBy: ObjectId;
  status: 'assigned' | 'cancelled';
  cancelledReason?: string;
  cancelledAt?: Date;
  cancelledBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attendance {
  _id: ObjectId;
  assignmentId: ObjectId;
  status: 'present' | 'absent' | 'late';
  checkInAt?: Date;
  checkOutAt?: Date;
  hours: number;
  recordedBy: ObjectId;
  finalized: boolean;
  finalizedAt?: Date;
  finalizedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AuditAction = 'insert' | 'update' | 'export' | 'login' | 'logout';

export interface AuditEntry {
  _id: ObjectId;
  actorId: ObjectId;
  action: AuditAction;
  collection: string;
  recordId?: ObjectId;
  before?: Document;
  after?: Document;
  createdAt: Date;
}

const date = { bsonType: 'date' };
const objectId = { bsonType: 'objectId' };
const text = (maxLength: number, minLength = 1) => ({ bsonType: 'string', minLength, maxLength });
const timestamps = { createdAt: date, updatedAt: date };

interface CollectionDefinition {
  name: string;
  validator: Document;
  indexes: IndexDescription[];
}

// Validators are the database's last line of defense: the API validates with zod first,
// but a buggy or bypassed write path still can't store a malformed document.
const definitions: CollectionDefinition[] = [
  {
    name: 'staff_users',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['fullName', 'email', 'passwordHash', 'role', 'active', 'createdAt', 'updatedAt'],
        properties: {
          fullName: text(100, 2),
          email: text(254, 3),
          passwordHash: { bsonType: 'string', pattern: '^\\$argon2id\\$' },
          role: { enum: ['admin', 'coordinator', 'supervisor'] },
          active: { bsonType: 'bool' },
          sessions: {
            bsonType: 'array',
            maxItems: 5,
            items: {
              bsonType: 'object',
              required: ['tokenHash', 'createdAt', 'expiresAt'],
              properties: { tokenHash: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, createdAt: date, expiresAt: date },
            },
          },
          ...timestamps,
        },
      },
    },
    indexes: [
      { key: { email: 1 }, name: 'staff_users_email_unique', unique: true },
      { key: { 'sessions.tokenHash': 1 }, name: 'staff_users_session_tokens', sparse: true },
    ],
  },
  {
    name: 'volunteers',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['firstName', 'lastName', 'phone', 'emergencyContactName', 'emergencyContactPhone', 'status', 'createdBy', 'createdAt', 'updatedAt'],
        properties: {
          firstName: text(60),
          lastName: text(80),
          email: text(254, 3),
          phone: { bsonType: 'string', pattern: '^\\+[1-9][0-9]{7,14}$' },
          birthDate: date,
          emergencyContactName: text(100),
          emergencyContactPhone: { bsonType: 'string', pattern: '^\\+[1-9][0-9]{7,14}$' },
          status: { enum: ['active', 'inactive'] },
          notes: text(1000, 0),
          assignmentLock: objectId,
          createdBy: objectId,
          ...timestamps,
        },
      },
    },
    indexes: [
      // Email is optional, so uniqueness only applies to documents that have one.
      { key: { email: 1 }, name: 'volunteers_email_unique', unique: true, partialFilterExpression: { email: { $type: 'string' } } },
      { key: { status: 1, lastName: 1, firstName: 1 }, name: 'volunteers_status_name' },
    ],
  },
  {
    name: 'activities',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['name', 'location', 'startsAt', 'endsAt', 'capacity', 'assignedCount', 'status', 'createdBy', 'createdAt', 'updatedAt'],
        properties: {
          name: text(120, 3),
          description: text(2000, 0),
          location: text(200, 2),
          startsAt: date,
          endsAt: date,
          capacity: { bsonType: 'int', minimum: 1, maximum: 1000 },
          assignedCount: { bsonType: 'int', minimum: 0 },
          requirements: text(1000, 0),
          status: { enum: ['draft', 'open', 'closed', 'cancelled'] },
          supervisorId: objectId,
          createdBy: objectId,
          ...timestamps,
        },
      },
      $expr: { $and: [{ $gt: ['$endsAt', '$startsAt'] }, { $lte: ['$assignedCount', '$capacity'] }] },
    },
    indexes: [{ key: { status: 1, startsAt: 1 }, name: 'activities_status_starts' }],
  },
  {
    name: 'assignments',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['volunteerId', 'activityId', 'assignedBy', 'status', 'createdAt', 'updatedAt'],
        properties: {
          volunteerId: objectId,
          activityId: objectId,
          assignedBy: objectId,
          status: { enum: ['assigned', 'cancelled'] },
          cancelledReason: text(500, 0),
          cancelledAt: date,
          cancelledBy: objectId,
          ...timestamps,
        },
      },
    },
    indexes: [
      { key: { volunteerId: 1, activityId: 1 }, name: 'assignments_volunteer_activity_unique', unique: true },
      { key: { activityId: 1, status: 1 }, name: 'assignments_activity_status' },
      { key: { volunteerId: 1, status: 1 }, name: 'assignments_volunteer_status' },
    ],
  },
  {
    name: 'attendance',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['assignmentId', 'status', 'hours', 'recordedBy', 'finalized', 'createdAt', 'updatedAt'],
        properties: {
          assignmentId: objectId,
          status: { enum: ['present', 'absent', 'late'] },
          checkInAt: date,
          checkOutAt: date,
          hours: { bsonType: ['double', 'int', 'decimal'], minimum: 0, maximum: 24 },
          recordedBy: objectId,
          finalized: { bsonType: 'bool' },
          finalizedAt: date,
          finalizedBy: objectId,
          ...timestamps,
        },
      },
      // Only compare the times when both exist; the API also checks hours against the activity length.
      $expr: {
        $or: [
          { $eq: [{ $type: '$checkInAt' }, 'missing'] },
          { $eq: [{ $type: '$checkOutAt' }, 'missing'] },
          { $gt: ['$checkOutAt', '$checkInAt'] },
        ],
      },
    },
    indexes: [{ key: { assignmentId: 1 }, name: 'attendance_assignment_unique', unique: true }],
  },
  {
    name: 'audit_log',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['actorId', 'action', 'collection', 'createdAt'],
        properties: {
          actorId: objectId,
          action: { enum: ['insert', 'update', 'export', 'login', 'logout'] },
          collection: text(60),
          recordId: objectId,
          before: { bsonType: 'object' },
          after: { bsonType: 'object' },
          createdAt: date,
        },
      },
    },
    indexes: [
      { key: { createdAt: -1 }, name: 'audit_log_created' },
      { key: { collection: 1, recordId: 1 }, name: 'audit_log_record' },
      { key: { actorId: 1, createdAt: -1 }, name: 'audit_log_actor' },
    ],
  },
];

// Creates each v2 collection with its validator, or refreshes the validator if it already exists,
// then creates its indexes. Safe to run on every startup.
export async function ensureCollections(database: Db): Promise<void> {
  const existing = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const definition of definitions) {
    if (!existing.has(definition.name)) {
      await database.createCollection(definition.name, {
        validator: definition.validator,
        validationLevel: 'strict',
        validationAction: 'error',
      });
    } else {
      try {
        await database.command({ collMod: definition.name, validator: definition.validator, validationLevel: 'strict', validationAction: 'error' });
      } catch (error: unknown) {
        // collMod needs the dbAdmin role; a readWrite-only user keeps the validator it was created with.
        if (!(error instanceof MongoServerError && error.code === 13)) throw error;
        log.warn('validator_update_skipped', { collection: definition.name });
      }
    }
    await database.collection(definition.name).createIndexes(definition.indexes);
  }
}

export function v2Collections(database: Db) {
  return {
    staffUsers: database.collection<StaffUser>('staff_users'),
    volunteers: database.collection<Volunteer>('volunteers'),
    activities: database.collection<Activity>('activities'),
    assignments: database.collection<Assignment>('assignments'),
    attendance: database.collection<Attendance>('attendance'),
    auditLog: database.collection<AuditEntry>('audit_log'),
  };
}

export type V2Collections = ReturnType<typeof v2Collections>;
