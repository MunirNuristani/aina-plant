import { Router } from 'express';
import { userAuthMiddleware } from '../middleware/user-auth';
import {
  assignDeviceSchema,
  createDeviceSchema,
  deviceAuthSchema,
  updateDeviceConfigSchema,
} from '../validation/device';
import {
  assignDeviceToPlant,
  authenticateDevice,
  getDeviceById,
  listDevices,
  registerDevice,
  rotateDeviceCredential,
  updateDeviceConfig,
} from '../services/device-service';
import { toFieldErrors, UnauthorizedError, ValidationError } from '../http/errors';

export const devicesRouter = Router();

// POST /auth is the device's own self-auth (identifier + credential
// headers), not a human user -- deliberately left without
// userAuthMiddleware. Every other route below is human-facing and gated
// per-route (this router can't go router-level like plantsRouter, since
// it mixes both audiences).
devicesRouter.post('/auth', async (req, res) => {
  const parsed = deviceAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid authentication payload', toFieldErrors(parsed.error.issues));
  }

  const device = await authenticateDevice(parsed.data.identifier, parsed.data.credential);
  res.status(200).json({ device });
});

devicesRouter.get('/', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const devices = await listDevices(req.user.id);
  res.status(200).json({ devices });
});

devicesRouter.get('/:id', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const device = await getDeviceById(req.params.id, req.user.id);
  res.status(200).json({ device });
});

devicesRouter.post('/', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid device registration payload',
      toFieldErrors(parsed.error.issues),
    );
  }

  const result = await registerDevice(parsed.data, req.user.id);
  res.status(201).json(result);
});

devicesRouter.patch('/:id', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = updateDeviceConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid device configuration payload',
      toFieldErrors(parsed.error.issues),
    );
  }

  const device = await updateDeviceConfig(req.params.id, req.user.id, parsed.data);
  res.status(200).json(device);
});

devicesRouter.post('/:id/rotate-credential', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const result = await rotateDeviceCredential(req.params.id, req.user.id);
  res.status(200).json(result);
});

devicesRouter.post('/:id/assign', userAuthMiddleware, async (req, res) => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  const parsed = assignDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment payload', toFieldErrors(parsed.error.issues));
  }

  const device = await assignDeviceToPlant(
    req.params.id,
    parsed.data.plantId,
    parsed.data.reassign,
    req.user.id,
  );
  res.status(200).json(device);
});
