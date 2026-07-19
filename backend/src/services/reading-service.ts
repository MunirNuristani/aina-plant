import { prisma } from '../db';
import type { Prisma, SensorReading } from '../generated/prisma/client';
import { isUniqueConstraintViolation } from '../lib/prisma-errors';
import { logger } from '../lib/logger';
import { ConflictError, NotFoundError, ValidationError } from '../http/errors';
import type { PublicDevice } from './device-service';
import type { SensorReadingInput } from '../validation/reading';

export type IngestReadingResult = {
  readingId: string;
  status: 'created' | 'duplicate';
  recordedAt: string;
  receivedAt: string;
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

    logger.info(
      { readingId: existing.id, deviceId: device.id },
      'Duplicate reading ignored (idempotent retry)',
    );

    await touchLastSeen(device.id);
    return {
      readingId: existing.id,
      status: 'duplicate',
      recordedAt: existing.recordedAt.toISOString(),
      receivedAt: existing.receivedAt.toISOString(),
    };
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

    logger.info(
      { readingId: reading.id, deviceId: device.id, plantId: device.plantId },
      'Reading ingested',
    );

    await touchLastSeen(device.id);
    return {
      readingId: reading.id,
      status: 'created',
      recordedAt: reading.recordedAt.toISOString(),
      receivedAt: reading.receivedAt.toISOString(),
    };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // Lost a race with a concurrent identical retry — treat as idempotent success.
      const reading = await prisma.sensorReading.findUniqueOrThrow({
        where: { id: input.readingId },
      });

      logger.info(
        { readingId: reading.id, deviceId: device.id },
        'Duplicate reading ignored (concurrent retry)',
      );

      await touchLastSeen(device.id);
      return {
        readingId: reading.id,
        status: 'duplicate',
        recordedAt: reading.recordedAt.toISOString(),
        receivedAt: reading.receivedAt.toISOString(),
      };
    }

    logger.error(
      { err: error, readingId: input.readingId, deviceId: device.id },
      'Reading ingestion failed due to a database error',
    );
    throw error;
  }
}

export async function getLatestReadingForPlant(
  plantId: string,
  userId: string,
): Promise<SensorReading | null> {
  const plant = await prisma.plant.findFirst({ where: { id: plantId, userId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  // "Newest" means most recently measured (recordedAt), not most recently
  // received — a late-arriving buffered reading shouldn't shadow a genuinely
  // more recent one just because it happened to reach the server first.
  return prisma.sensorReading.findFirst({
    where: { plantId },
    orderBy: { recordedAt: 'desc' },
  });
}

export type ListReadingsOptions = {
  start?: Date;
  end?: Date;
  sort: 'asc' | 'desc';
  limit: number;
};

export async function listReadingsForPlant(
  plantId: string,
  userId: string,
  options: ListReadingsOptions,
): Promise<SensorReading[]> {
  const plant = await prisma.plant.findFirst({ where: { id: plantId, userId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  const hasRange = options.start !== undefined || options.end !== undefined;

  return prisma.sensorReading.findMany({
    where: {
      plantId,
      ...(hasRange
        ? {
            recordedAt: {
              ...(options.start !== undefined ? { gte: options.start } : {}),
              ...(options.end !== undefined ? { lte: options.end } : {}),
            },
          }
        : {}),
    },
    orderBy: { recordedAt: options.sort },
    take: options.limit,
  });
}

const recentReadingInclude = {
  device: { select: { identifier: true } },
  plant: { select: { name: true } },
} satisfies Prisma.SensorReadingInclude;

export type RecentReading = Prisma.SensorReadingGetPayload<{
  include: typeof recentReadingInclude;
}>;

export async function listRecentReadings(limit: number, userId: string): Promise<RecentReading[]> {
  // Ordered by receivedAt (when the pipeline actually processed it), not
  // recordedAt — this view is "what has the pipeline been doing lately,"
  // not "what is the true measurement history" (that's the plant-history
  // endpoint's job, which orders by recordedAt on purpose).
  return prisma.sensorReading.findMany({
    where: { plant: { userId } },
    orderBy: { receivedAt: 'desc' },
    take: limit,
    include: recentReadingInclude,
  });
}
