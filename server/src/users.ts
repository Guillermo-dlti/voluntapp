import { argon2id, hash } from 'argon2';
import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import { z } from 'zod';

export interface UserSession {
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface User {
  sessions?: UserSession[];
  _id: ObjectId;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'volunteer' | 'bamx_admin' | 'technical_admin';
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export const registrationSchema = z.strictObject({
  name: z.string().trim().min(2).max(100).regex(/^[^\p{Cc}]+$/u),
  username: z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_.]+$/),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(15).max(128),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
});

export type Registration = z.infer<typeof registrationSchema>;

export const fieldMessages: Record<keyof Registration, string> = {
  name: 'Escribe tu nombre con entre 2 y 100 caracteres.',
  username: 'Usa entre 3 y 30 letras, números, puntos o guiones bajos para tu usuario.',
  email: 'Escribe un correo electrónico válido.',
  password: 'Usa una contraseña de entre 15 y 128 caracteres.',
  phone: 'Escribe el teléfono con + y entre 8 y 15 dígitos, incluyendo el código de país.',
};

export async function registerUser(users: Collection<User>, input: Registration) {
  const passwordHash = await hash(input.password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const now = new Date();
  const result = await users.insertOne({
    _id: new ObjectId(),
    name: input.name,
    username: input.username,
    email: input.email,
    passwordHash,
    role: 'volunteer',
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Explicit response fields keep password hashes out of API responses.
  return {
    id: result.insertedId.toHexString(),
    name: input.name,
    username: input.username,
    email: input.email,
    role: 'volunteer' as const,
    status: 'active' as const,
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function publicUser(user: User) {
  return {
    id: user._id.toHexString(), name: user.name, username: user.username,
    email: user.email, role: user.role, status: user.status,
    ...(user.phone === undefined ? {} : { phone: user.phone }),
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
  };
}
