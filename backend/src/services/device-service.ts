import { prisma } from '../db';
import type { Device } from '../generated/prisma/client';
import { generateDeviceCredential, verifyDeviceCredential } from '../lib/device-credential';
import { isUniqueConstraintViolation } from '../lib/prisma-errors';
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
  input: UpdateDeviceConfigInput,
): Promise<PublicDevice> {
  const existing = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!existing) {
    throw new NotFoundError('Device not found');
  }

  const device = await prisma.device.update({
    where: { id: deviceId },
    data: input,
  });

  return toPublicDevice(device);
}

export async function assignDeviceToPlant(
  deviceId: string,
  plantId: string,
  reassign: boolean,
): Promise<PublicDevice> {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    throw new NotFoundError('Device not found');
  }

  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
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
    console.warn(`[device-auth] rejected identifier="${identifier}" reason="invalid credentials"`);
    throw new UnauthorizedError('Invalid device identifier or credential');
  }

  if (!device.enabled) {
    console.warn(`[device-auth] rejected identifier="${identifier}" reason="device disabled"`);
    throw new ForbiddenError('Device is disabled');
  }

  return toPublicDevice(device);
}
