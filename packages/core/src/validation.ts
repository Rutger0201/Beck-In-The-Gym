import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), "invalid characters");
export const goals = ["strength", "muscle", "fitness", "technique", "unsure"] as const;
export const contactStatuses = ["new", "in_progress", "contacted", "closed"] as const;
export type ContactStatus = (typeof contactStatuses)[number];
export const contactSchema = z.object({
  name: text(100).min(2),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  goal: z.enum(goals),
  phone: text(30).refine(value => !value || /^[+()\d\s.-]{6,30}$/.test(value)).optional().default(""),
  experience: z.enum(["", "beginner", "some", "experienced"]).optional().default(""),
  format: z.enum(["", "one", "duo", "group", "plan", "technique"]).optional().default(""),
  message: text(2000).optional().default(""),
  locale: z.enum(["nl", "en"]),
  website: z.string().max(200).optional().default(""),
  requestId: z.uuid()
}).strict();
export type ContactInput = z.infer<typeof contactSchema>;
export const statusSchema = z.object({ status: z.enum(contactStatuses), expectedVersion: z.number().int().positive() }).strict();
