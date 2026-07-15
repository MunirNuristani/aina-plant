import { prisma } from '../src/db';
import { hashDeviceCredential } from '../src/lib/device-credential';

// Fixed IDs make seeding idempotent: re-running upserts the same rows
// instead of creating duplicates on every run.
const SEED_PLANT_ID = '00000000-0000-0000-0000-000000000001';
const SEED_READING_ID = '00000000-0000-0000-0000-000000000002';
const SEED_DEVICE_IDENTIFIER = 'dev-seed-device-001';

// A known, fixed credential so it's actually usable for local testing.
// Never used for real device registration, which always generates a
// fresh random secret (see registerDevice in device-service.ts).
const SEED_DEVICE_CREDENTIAL =
  process.env.SEED_DEVICE_CREDENTIAL ?? 'dev-only-seed-credential-do-not-use-in-production';

async function main() {
  const plant = await prisma.plant.upsert({
    where: { id: SEED_PLANT_ID },
    update: {},
    create: {
      id: SEED_PLANT_ID,
      name: '[DEV SEED] Test Plant',
      commonName: 'Development fixture — not real data',
      notes: 'Created by prisma/seed.ts for local development and testing.',
    },
  });

  const credentialHash = hashDeviceCredential(SEED_DEVICE_CREDENTIAL);

  const device = await prisma.device.upsert({
    where: { identifier: SEED_DEVICE_IDENTIFIER },
    update: { credentialHash, enabled: true, plantId: plant.id },
    create: {
      name: '[DEV SEED] Test Device',
      identifier: SEED_DEVICE_IDENTIFIER,
      credentialHash,
      plantId: plant.id,
    },
  });

  await prisma.sensorReading.upsert({
    where: { id: SEED_READING_ID },
    update: {},
    create: {
      id: SEED_READING_ID,
      deviceId: device.id,
      plantId: plant.id,
      recordedAt: new Date(),
      rawMoisture: 2048,
      moisturePercent: 45.5,
      firmwareVersion: '0.0.0-dev',
      wifiRssi: -55,
    },
  });

  console.log('Seed complete:');
  console.log(`  Plant:  ${plant.name} (${plant.id})`);
  console.log(`  Device: ${device.name} (${device.identifier}), assigned to plant`);
  console.log('');
  console.log('[DEVELOPMENT CREDENTIAL — DO NOT USE IN PRODUCTION]');
  console.log(`  identifier: ${SEED_DEVICE_IDENTIFIER}`);
  console.log(`  credential: ${SEED_DEVICE_CREDENTIAL}`);
  console.log('');
  console.log('Test it against the local API:');
  console.log(
    `  curl -X POST http://localhost:3000/devices/auth -H 'Content-Type: application/json' \\\n` +
      `    -d '{"identifier":"${SEED_DEVICE_IDENTIFIER}","credential":"${SEED_DEVICE_CREDENTIAL}"}'`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
