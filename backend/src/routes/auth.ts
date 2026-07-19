import { Router } from 'express';
import { loginSchema, signupSchema } from '../validation/user';
import { login, signup } from '../services/user-service';
import { toFieldErrors, ValidationError } from '../http/errors';
import { loginRateLimit } from '../middleware/login-rate-limit';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid signup payload', toFieldErrors(parsed.error.issues));
  }

  const result = await signup(parsed.data);
  res.status(201).json(result);
});

authRouter.post('/login', loginRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid login payload', toFieldErrors(parsed.error.issues));
  }

  const result = await login(parsed.data);
  res.status(200).json(result);
});
