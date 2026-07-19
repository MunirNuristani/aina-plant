import { z } from 'zod';

// Normalized lowercase at the validation boundary — schema.prisma's
// User.email comment documents that the DB unique constraint is
// case-sensitive, so every write and lookup must go through this same
// normalization or "Person@x.com" and "person@x.com" would silently
// collide/not-collide inconsistently.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'email is required')
  .email('email must be a valid email address');

export const signupSchema = z.object({
  email: emailSchema,
  // No complexity regex — length alone (matching common practice: length
  // is a much stronger signal than forced character-class mixing).
  password: z.string().min(8, 'password must be at least 8 characters'),
  name: z.string().trim().min(1).max(100).optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
