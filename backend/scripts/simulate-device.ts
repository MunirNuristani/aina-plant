/**
 * Simulates an ESP32 device submitting a sensor reading, without needing
 * physical hardware. See backend/README.md's "Device simulator" section
 * for usage.
 */

import { randomUUID } from 'node:crypto';

const API_URL = process.env.SIMULATOR_API_URL ?? 'http://localhost:3000';

// Defaults to the dev-only seed fixture (see prisma/seed.ts) — never a
// real credential. Override with real env vars to simulate a different
// device or a different environment; nothing here is hardcoded for
// anything other than convenient local testing.
const DEVICE_IDENTIFIER = process.env.SIMULATOR_DEVICE_ID ?? 'dev-seed-device-001';
const DEVICE_KEY =
  process.env.SIMULATOR_DEVICE_KEY ?? 'dev-only-seed-credential-do-not-use-in-production';

type PublicDevice = {
  id: string;
  identifier: string;
  plantId: string | null;
  enabled: boolean;
};

type CliArgs = {
  replay: boolean;
  readingId?: string;
  rawMoisture?: number;
  moisturePercent?: number;
};

function parseArgs(argv: string[]): CliArgs {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index !== -1 ? argv[index + 1] : undefined;
  };

  const rawMoisture = get('--raw-moisture');
  const moisturePercent = get('--moisture-percent');

  return {
    replay: argv.includes('--replay'),
    readingId: get('--reading-id'),
    rawMoisture: rawMoisture !== undefined ? Number(rawMoisture) : undefined,
    moisturePercent: moisturePercent !== undefined ? Number(moisturePercent) : undefined,
  };
}

async function authenticate(): Promise<PublicDevice> {
  const res = await fetch(`${API_URL}/devices/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: DEVICE_IDENTIFIER, credential: DEVICE_KEY }),
  });

  const body = (await res.json()) as { device?: PublicDevice; error?: { message: string } };

  if (!res.ok || !body.device) {
    throw new Error(
      `Device authentication failed (${res.status}): ${body.error?.message ?? 'unknown error'}`,
    );
  }

  return body.device;
}

async function submitReading(readingId: string, deviceId: string, args: CliArgs) {
  const payload = {
    readingId,
    deviceId,
    recordedAt: new Date().toISOString(),
    rawMoisture: args.rawMoisture ?? Math.floor(Math.random() * 4096), // ESP32 12-bit ADC range
    moisturePercent: args.moisturePercent ?? Math.round(Math.random() * 1000) / 10,
  };

  const res = await fetch(`${API_URL}/api/v1/readings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': DEVICE_IDENTIFIER,
      'X-Device-Key': DEVICE_KEY,
    },
    body: JSON.stringify(payload),
  });

  return { status: res.status, body: await res.json(), payload };
}

async function fetchLatestReading(plantId: string) {
  const res = await fetch(`${API_URL}/api/v1/plants/${plantId}/readings/latest`);
  return { status: res.status, body: await res.json() };
}

function printSection(label: string, data: unknown): void {
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Simulating device "${DEVICE_IDENTIFIER}" against ${API_URL}`);

  const device = await authenticate();
  console.log(`Authenticated: device.id=${device.id} plantId=${device.plantId ?? '(none)'}`);

  if (!device.plantId) {
    console.error(
      '\nThis device is not assigned to a plant, so a reading cannot be stored or retrieved.' +
        ' Assign it first (see backend/README.md, "Device authentication" / assignment endpoint).',
    );
    process.exitCode = 1;
    return;
  }

  const readingId = args.readingId ?? randomUUID();
  console.log(`Reading ID: ${readingId}${args.readingId ? ' (reused, via --reading-id)' : ''}`);

  const first = await submitReading(readingId, device.id, args);
  printSection('SUBMIT', first);

  if (args.replay) {
    const second = await submitReading(readingId, device.id, args);
    printSection('REPLAY (same reading ID)', second);

    const status = (second.body as { status?: string }).status;
    if (status === 'duplicate') {
      console.log('\nDuplicate correctly recognized — no new record was created.');
    } else {
      console.warn(`\nExpected status "duplicate" on replay, got "${status}".`);
    }
  }

  const retrieved = await fetchLatestReading(device.plantId);
  printSection('RETRIEVE (latest reading for this plant)', retrieved);

  const retrievedId = (retrieved.body as { reading?: { id?: string } }).reading?.id;
  if (retrievedId === readingId) {
    console.log(
      '\nRetrieved reading matches the one just submitted. Pipeline verified end to end.',
    );
  } else {
    console.warn(
      '\nRetrieved reading does not match the one just submitted — another device may have' +
        ' reported for this plant more recently.',
    );
  }
}

main().catch((error: unknown) => {
  console.error('\nSimulator failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
