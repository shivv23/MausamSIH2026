import { z } from 'zod';

/**
 * Runtime contracts for the Mausam v1 API.
 *
 * The static types live in src/api/v1.ts (generated from the backend's
 * OpenAPI schema via `npm run api:gen`). Types alone don't protect against
 * server drift, so the payloads the client parses are validated here with zod
 * and every failure surfaces a readable message instead of a silent undefined.
 */

function describe(error: z.ZodError): string {
  const flat = z.treeifyError(error);
  return `API contract mismatch: ${JSON.stringify(flat)}`;
}

// ---- auth ----------------------------------------------------------------

const AuthSessionSchema = z
  .object({
    token: z.string().min(1),
    verified: z.boolean().default(true),
    contactVerificationRequired: z.boolean().default(false),
    message: z.string().default('ok'),
  })
  .passthrough();

export type AuthSessionContract = {
  token: string;
  verified: boolean;
  contactVerificationRequired: boolean;
  message: string;
};

export function parseAuthSession(raw: unknown): AuthSessionContract {
  const parsed = AuthSessionSchema.safeParse(raw);
  if (!parsed.success) throw new Error(describe(parsed.error as z.ZodError));
  return parsed.data;
}

// ---- notification inbox ---------------------------------------------------

const ServerNotificationSchema = z
  .object({
    id: z.string().default(''),
    alert_id: z.string(),
    severity: z.enum(['green', 'yellow', 'orange', 'red']),
    event_type: z.string(),
    headline: z.string(),
    body: z.string(),
    region: z.string(),
    read: z.boolean(),
    created_at: z.string(),
  })
  .passthrough();

const NotificationListSchema = z
  .object({
    unread: z.number().int().nonnegative().default(0),
    items: z.array(ServerNotificationSchema).default([]),
  })
  .passthrough();

export type ServerNotificationContract = {
  id: string;
  alert_id: string;
  severity: 'green' | 'yellow' | 'orange' | 'red';
  event_type: string;
  headline: string;
  body: string;
  region: string;
  read: boolean;
  created_at: string;
};

export function parseNotificationList(raw: unknown): {
  unread: number;
  items: ServerNotificationContract[];
} {
  const parsed = NotificationListSchema.safeParse(raw);
  if (!parsed.success) throw new Error(describe(parsed.error as z.ZodError));
  return parsed.data;
}

// ---- profile sync ---------------------------------------------------------

const SyncActivitySchema = z
  .object({
    type: z.string(),
    label: z.string().default(''),
    label_hi: z.string().optional(),
    time: z.string().default('09:00'),
  })
  .passthrough();

const SyncLocationSchema = z
  .object({
    type: z.string().default('home'),
    label: z.string().default(''),
  })
  .passthrough();

const ProfileSyncSchema = z
  .object({
    profile: z
      .object({
        id: z.string(),
        name: z.string().default(''),
        name_hi: z.string().optional(),
        personas: z.array(z.string()).default([]),
        conditions: z.array(z.string()).default([]),
        activities: z.array(SyncActivitySchema).default([]),
        locations: z.array(SyncLocationSchema).default([]),
        city: z.string().default('pune'),
        language: z.enum(['en', 'hi']).default('en'),
        behavior_bias: z.record(z.string(), z.number()).default({}),
      })
      .passthrough(),
    updated_at: z.string().nullish(),
  })
  .passthrough();

export type ProfileSyncContract = {
  profile: {
    id: string;
    name: string;
    name_hi?: string;
    personas: string[];
    conditions: string[];
    activities: Array<{ type: string; label: string; label_hi?: string; time: string }>;
    locations: Array<{ type: string; label: string }>;
    city: string;
    language: 'en' | 'hi';
    behavior_bias: Record<string, number>;
  };
  updated_at?: string | null;
};

export function parseProfileSync(raw: unknown): ProfileSyncContract {
  const parsed = ProfileSyncSchema.safeParse(raw);
  if (!parsed.success) throw new Error(describe(parsed.error as z.ZodError));
  return parsed.data;
}

// ---- DPDP portability export --------------------------------------------------

const AccountExportSchema = z
  .object({
    schema_version: z.string().default('2026-09-12'),
    user_id: z.string(),
    generated_at: z.string(),
    account: z.record(z.string(), z.unknown()).default({}),
    profile: z.record(z.string(), z.unknown()).nullish(),
    notifications: z.array(z.record(z.string(), z.unknown())).default([]),
    push_tokens: z.array(z.record(z.string(), z.unknown())).default([]),
  })
  .passthrough();

export type AccountExportContract = {
  schema_version: string;
  user_id: string;
  generated_at: string;
  account: Record<string, unknown>;
  profile?: Record<string, unknown> | null;
  notifications: Array<Record<string, unknown>>;
  push_tokens: Array<Record<string, unknown>>;
};

export function parseAccountExport(raw: unknown): AccountExportContract {
  const parsed = AccountExportSchema.safeParse(raw);
  if (!parsed.success) throw new Error(describe(parsed.error as z.ZodError));
  return parsed.data;
}