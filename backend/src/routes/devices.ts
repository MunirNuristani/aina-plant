import { Router } from 'express';
import {
  assignDeviceSchema,
  createDeviceSchema,
  deviceAuthSchema,
  updateDeviceConfigSchema,
} from '../validation/device';
import {
  assignDeviceToPlant,
  authenticateDevice,
  registerDevice,
  rotateDeviceCredential,
  updateDeviceConfig,
} from '../services/device-service';
import { toFieldErrors, ValidationError } from '../http/errors';

export const devicesRouter = Router();

devicesRouter.post('/auth', async (req, res) => {
  const parsed = deviceAuthSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid authentication payload', toFieldErrors(parsed.error.issues));
  }

  const device = await authenticateDevice(parsed.data.identifier, parsed.data.credential);
  res.status(200).json({ device });
});

devicesRouter.post('/', async (req, res) => {
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid device registration payload',
      toFieldErrors(parsed.error.issues),
    );
  }

  const result = await registerDevice(parsed.data);
  res.status(201).json(result);
});

devicesRouter.patch('/:id', async (req, res) => {
  const parsed = updateDeviceConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      'Invalid device configuration payload',
      toFieldErrors(parsed.error.issues),
    );
  }

  const device = await updateDeviceConfig(req.params.id, parsed.data);
  res.status(200).json(device);
});

devicesRouter.post('/:id/rotate-credential', async (req, res) => {
  const result = await rotateDeviceCredential(req.params.id);
  res.status(200).json(result);
});

devicesRouter.post('/:id/assign', async (req, res) => {
  const parsed = assignDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment payload', toFieldErrors(parsed.error.issues));
  }

  const device = await assignDeviceToPlant(
    req.params.id,
    parsed.data.plantId,
    parsed.data.reassign,
  );
  res.status(200).json(device);
});
