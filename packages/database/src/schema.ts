import { pgTable, text, boolean, timestamp, uuid, integer, bigint, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
export const user = pgTable("auth_user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
export const session = pgTable("auth_session", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), ipAddress: text("ip_address"), userAgent: text("user_agent")
});
export const account = pgTable("auth_account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), scope: text("scope"), password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, t => [uniqueIndex("auth_account_provider_unique").on(t.providerId, t.accountId)]);
export const verification = pgTable("auth_verification", { id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() });
export const twoFactor = pgTable("auth_two_factor", { id: text("id").primaryKey(), secret: text("secret").notNull(), backupCodes: text("backup_codes").notNull(), userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }), verified: boolean("verified").default(true), failedVerificationCount: integer("failed_verification_count").default(0), lockedUntil: timestamp("locked_until", { withTimezone: true }) });
export const rateLimit = pgTable("auth_rate_limit", { id: text("id").primaryKey(), key: text("key").notNull().unique(), count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull() });
export const legalEntities = pgTable("legal_entities", { id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const activities = pgTable("activities", { id: text("id").primaryKey(), legalEntityId: uuid("legal_entity_id").references(() => legalEntities.id), name: text("name").notNull(), settings: jsonb("settings").notNull().default({}) });
export const memberships = pgTable("memberships", { id: uuid("id").primaryKey().defaultRandom(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), activityId: text("activity_id").notNull().references(() => activities.id), role: text("role").notNull().default("owner") }, t => [uniqueIndex("membership_user_activity_unique").on(t.userId, t.activityId)]);
export const contactRequests = pgTable("contact_requests", {
  id: uuid("id").primaryKey(), activityId: text("activity_id").notNull().references(() => activities.id), name: text("name").notNull(), email: text("email").notNull(), phone: text("phone"), goal: text("goal").notNull(), experience: text("experience"), format: text("format"), message: text("message"), locale: text("locale").notNull(), status: text("status").notNull().default("new"), version: integer("version").notNull().default(1), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), retentionAt: timestamp("retention_at", { withTimezone: true }).notNull()
});
export const mailOutbox = pgTable("mail_outbox", { id: uuid("id").primaryKey().defaultRandom(), contactId: uuid("contact_id").notNull().references(() => contactRequests.id, { onDelete: "cascade" }), kind: text("kind").notNull(), attempts: integer("attempts").notNull().default(0), availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(), leaseUntil: timestamp("lease_until", { withTimezone: true }), sentAt: timestamp("sent_at", { withTimezone: true }), providerId: text("provider_id") }, t => [uniqueIndex("mail_contact_kind_unique").on(t.contactId, t.kind)]);
