import { prisma } from '../db';
import type { Plant, Prisma } from '../generated/prisma/client';
import { NotFoundError } from '../http/errors';
import type { CreatePlantInput } from '../validation/plant';

// Plant names aren't unique (see prisma/schema.prisma -- no @unique on
// name, unlike Device.identifier), so unlike registerDevice() there's no
// duplicate case to handle here: every valid submission creates a new row.
export function createPlant(input: CreatePlantInput, userId: string): Promise<Plant> {
  return prisma.plant.create({ data: { ...input, userId } });
}

// Device.plantId has no unique constraint (see prisma/schema.prisma), so a
// plant's `devices` relation is an array even though exactly one is the
// common case. Only *enabled* devices are included -- a disabled device is
// still assigned (the foreign key still points here), but it isn't
// actively reporting, which is what "device assignment" means to a
// consumer of this API: is this plant currently being monitored.
// credentialHash is deliberately never selected, mirroring
// toPublicDevice()'s rule elsewhere.
const activeDeviceSelect = {
  id: true,
  name: true,
  identifier: true,
  enabled: true,
  lastSeenAt: true,
  reportingIntervalSeconds: true,
  firmwareVersion: true,
} satisfies Prisma.DeviceSelect;

const plantWithActiveDevicesInclude = {
  devices: { where: { enabled: true }, select: activeDeviceSelect },
} satisfies Prisma.PlantInclude;

export type PlantWithActiveDevices = Prisma.PlantGetPayload<{
  include: typeof plantWithActiveDevicesInclude;
}>;

export function listPlants(userId: string): Promise<PlantWithActiveDevices[]> {
  return prisma.plant.findMany({
    where: { userId },
    include: plantWithActiveDevicesInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export async function getPlantById(plantId: string, userId: string): Promise<PlantWithActiveDevices> {
  const plant = await prisma.plant.findFirst({
    where: { id: plantId, userId },
    include: plantWithActiveDevicesInclude,
  });

  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  return plant;
}
