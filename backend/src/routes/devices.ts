import { Router } from 'express';
import {
  assignDeviceSchema,
  createDeviceSchema,
  updateDeviceConfigSchema,
} from '../validation/device';
import {
  assignDeviceToPlant,
  registerDevice,
  updateDeviceConfig,
} from '../services/device-service';
import { ValidationError } from '../http/errors';

export const devicesRouter = Router();

devicesRouter.post('/', async (req, res) => {
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid device registration payload', parsed.error.issues);
  }

  const result = await registerDevice(parsed.data);
  res.status(201).json(result);
});

devicesRouter.patch('/:id', async (req, res) => {
  const parsed = updateDeviceConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid device configuration payload', parsed.error.issues);
  }

  const device = await updateDeviceConfig(req.params.id, parsed.data);
  res.status(200).json(device);
});

devicesRouter.post('/:id/assign', async (req, res) => {
  const parsed = assignDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Invalid assignment payload', parsed.error.issues);
  }

  const device = await assignDeviceToPlant(
    req.params.id,
    parsed.data.plantId,
    parsed.data.reassign,
  );
  res.status(200).json(device);
});
