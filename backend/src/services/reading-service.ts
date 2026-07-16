import { prisma } from '../db';
import { isUniqueConstraintViolation } from '../lib/prisma-errors';
import { ConflictError, ValidationError } from '../http/errors';
import type { PublicDevice } from './device-service';
import type { SensorReadingInput } from '../validation/reading';

export type IngestReadingResult = {
  readingId: string;
  status: 'created' | 'duplicate';
};

function touchLastSeen(deviceId: string): Promise<unknown> {
  return prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() } });
}

export async function ingestReading(
  input: SensorReadingInput,
  device: PublicDevice,
): Promise<IngestReadingResult> {
  if (input.deviceId !== device.id) {
    throw new ValidationError('deviceId does not match the authenticated device');
  }

  if (!device.plantId) {
    throw new ConflictError('Device is not assigned to a plant');
  }

  const existing = await prisma.sensorReading.findUnique({ where: { id: input.readingId } });
  if (existing) {
    if (existing.deviceId !== device.id) {
      throw new ConflictError('readingId is already used by a different device');
    }

    await touchLastSeen(device.id);
    return { readingId: existing.id, status: 'duplicate' };
  }

  try {
    const reading = await prisma.sensorReading.create({
      data: {
        id: input.readingId,
        deviceId: device.id,
        plantId: device.plantId,
        recordedAt: new Date(input.recordedAt),
        rawMoisture: input.rawMoisture,
        moisturePercent: input.moisturePercent,
        firmwareVersion: input.firmwareVersion,
        wifiRssi: input.wifiRssi,
      },
    });

    await touchLastSeen(device.id);
    return { readingId: reading.id, status: 'created' };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // Lost a race with a concurrent identical retry — treat as idempotent success.
      const reading = await prisma.sensorReading.findUniqueOrThrow({
        where: { id: input.readingId },
      });
      await touchLastSeen(device.id);
      return { readingId: reading.id, status: 'duplicate' };
    }
    throw error;
  }
}
