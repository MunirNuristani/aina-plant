import { prisma } from '../db';
import type { CareEvent } from '../generated/prisma/client';
import { NotFoundError } from '../http/errors';
import type { CreateCareEventInput, UpdateCareEventInput } from '../validation/care-event';

export async function createCareEvent(
  plantId: string,
  input: CreateCareEventInput,
): Promise<CareEvent> {
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  return prisma.careEvent.create({
    data: {
      plantId,
      type: input.type,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      amount: input.amount,
      unit: input.unit,
      notes: input.notes,
    },
  });
}

// Excludes soft-deleted rows (deletedAt: null) -- see CareEvent's schema
// comment: every read query against this model must filter that itself,
// there's no declarative way to make Prisma do it automatically.
export async function listCareEventsForPlant(plantId: string): Promise<CareEvent[]> {
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  return prisma.careEvent.findMany({
    where: { plantId, deletedAt: null },
    orderBy: { occurredAt: 'desc' },
  });
}

// Scoped by plantId as well as id (not just id) -- a nested
// /plants/:plantId/care-events/:careEventId URL implies the event
// actually belongs to that plant; a mismatched plantId is treated the
// same as a nonexistent event (404), not silently ignored. Also excludes
// already-soft-deleted rows, so updating (or deleting) a deleted event
// correctly 404s rather than reviving it.
async function findActiveCareEvent(plantId: string, careEventId: string): Promise<CareEvent> {
  const event = await prisma.careEvent.findFirst({
    where: { id: careEventId, plantId, deletedAt: null },
  });
  if (!event) {
    throw new NotFoundError('Care event not found');
  }
  return event;
}

export async function updateCareEvent(
  plantId: string,
  careEventId: string,
  input: UpdateCareEventInput,
): Promise<CareEvent> {
  await findActiveCareEvent(plantId, careEventId);

  return prisma.careEvent.update({
    where: { id: careEventId },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.occurredAt !== undefined ? { occurredAt: new Date(input.occurredAt) } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

// Soft delete only -- see CareEvent's schema comment for why an actual
// DELETE would silently rewrite moisture-history comparisons.
export async function deleteCareEvent(plantId: string, careEventId: string): Promise<void> {
  await findActiveCareEvent(plantId, careEventId);

  await prisma.careEvent.update({
    where: { id: careEventId },
    data: { deletedAt: new Date() },
  });
}
