import { prisma } from '../db';
import type { Device } from '../generated/prisma/client';
import { generateDeviceCredential, verifyDeviceCredential } from '../lib/device-credential';
import { isUniqueConstraintViolation } from '../lib/prisma-errors';
import { logger } from '../lib/logger';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../http/errors';
import type { CreateDeviceInput, UpdateDeviceConfigInput } from '../validation/device';

const DEFAULT_REPORTING_INTERVAL_SECONDS = 900;

export type PublicDevice = Omit<Device, 'credentialHash'>;

function toPublicDevice(device: Device): PublicDevice {
  const { credentialHash: _credentialHash, ...publicDevice } = device;
  return publicDevice;
}

export async function registerDevice(
  input: CreateDeviceInput,
  userId: string,
): Promise<{ device: PublicDevice; credential: string }> {
  const { secret, hash } = generateDeviceCredential();

  try {
    const device = await prisma.device.create({
      data: {
        name: input.name,
        identifier: input.identifier,
        firmwareVersion: input.firmwareVersion,
        reportingIntervalSeconds:
          input.reportingIntervalSeconds ?? DEFAULT_REPORTING_INTERVAL_SECONDS,
        credentialHash: hash,
        userId,
      },
    });

    return { device: toPublicDevice(device), credential: secret };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError(`Device identifier "${input.identifier}" is already registered`);
    }
    throw error;
  }
}

export async function updateDeviceConfig(
  deviceId: string,
  userId: string,
  input: UpdateDeviceConfigInput,
): Promise<PublicDevice> {
  const existing = await prisma.device.findFirst({ where: { id: deviceId, userId } });
  if (!existing) {
    throw new NotFoundError('Device not found');
  }

  const device = await prisma.device.update({
    where: { id: deviceId },
    data: input,
  });

  return toPublicDevice(device);
}

// Issues a new credential for an existing device, without touching its id,
// identifier, plant assignment, or anything else -- the only thing that
// changes is credentialHash. This is the rotation "path": if a device's
// key is ever suspected compromised, or a device needs its secret
// reprovisioned, this replaces it in place rather than needing the device
// deleted and re-registered (which would mint a new id and break its
// SensorReading history's deviceId references).
//
// Like registerDevice(), the plaintext secret is returned exactly once,
// here, and never persisted -- only its hash is stored.
export async function rotateDeviceCredential(
  deviceId: string,
  userId: string,
): Promise<{ device: PublicDevice; credential: string }> {
  const existing = await prisma.device.findFirst({ where: { id: deviceId, userId } });
  if (!existing) {
    throw new NotFoundError('Device not found');
  }

  const { secret, hash } = generateDeviceCredential();

  const device = await prisma.device.update({
    where: { id: deviceId },
    data: { credentialHash: hash },
  });

  return { device: toPublicDevice(device), credential: secret };
}

export async function assignDeviceToPlant(
  deviceId: string,
  plantId: string,
  reassign: boolean,
  userId: string,
): Promise<PublicDevice> {
  // Both sides scoped to the caller -- neither a device nor a plant
  // belonging to a different user can be assigned to each other, even if
  // both happen to belong to the *same* other user.
  const device = await prisma.device.findFirst({ where: { id: deviceId, userId } });
  if (!device) {
    throw new NotFoundError('Device not found');
  }

  const plant = await prisma.plant.findFirst({ where: { id: plantId, userId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  if (!device.enabled) {
    throw new ConflictError('Device is disabled and cannot be assigned to a plant');
  }

  if (device.plantId && device.plantId !== plantId && !reassign) {
    throw new ConflictError(
      'Device is already assigned to a different plant. Pass reassign: true to move it.',
      { currentPlantId: device.plantId },
    );
  }

  const updated = await prisma.device.update({
    where: { id: deviceId },
    data: { plantId },
  });

  return toPublicDevice(updated);
}

export async function authenticateDevice(
  identifier: string,
  credential: string,
): Promise<PublicDevice> {
  const device = await prisma.device.findUnique({ where: { identifier } });

  // Never log `credential` here or anywhere below — only the identifier,
  // which is a lookup key, not a secret.
  if (!device || !verifyDeviceCredential(credential, device.credentialHash)) {
    logger.warn({ identifier }, 'device auth rejected: invalid credentials');
    throw new UnauthorizedError('Invalid device identifier or credential');
  }

  if (!device.enabled) {
    logger.warn({ identifier }, 'device auth rejected: device disabled');
    throw new ForbiddenError('Device is disabled');
  }

  return toPublicDevice(device);
}
