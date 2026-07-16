import { prisma } from '../db';
import type { Plant } from '../generated/prisma/client';
import type { CreatePlantInput } from '../validation/plant';

// Plant names aren't unique (see prisma/schema.prisma -- no @unique on
// name, unlike Device.identifier), so unlike registerDevice() there's no
// duplicate case to handle here: every valid submission creates a new row.
export function createPlant(input: CreatePlantInput): Promise<Plant> {
  return prisma.plant.create({ data: input });
}
