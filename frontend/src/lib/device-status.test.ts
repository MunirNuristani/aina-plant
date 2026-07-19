import { describe, expect, it } from "vitest";
import { computeDeviceStatus, type DeviceStatus } from "./device-status";
import type { Device } from "./types";

const DEFAULT_INTERVAL = 900; // 15 min, matches the backend's Device default

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "dev-1",
    name: "Test ESP32",
    identifier: "esp32-test-01",
    enabled: true,
    lastSeenAt: new Date().toISOString(),
    reportingIntervalSeconds: DEFAULT_INTERVAL,
    firmwareVersion: "1.0.0",
    ...overrides,
  };
}

function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("computeDeviceStatus", () => {
  it("returns no-device when no device is assigned", () => {
    expect(computeDeviceStatus(undefined)).toBe("no-device");
  });

  it("returns never-connected when lastSeenAt is null, even for an otherwise-enabled device", () => {
    const device = makeDevice({ lastSeenAt: null });
    expect(computeDeviceStatus(device)).toBe("never-connected");
  });

  it("returns online for a device that just reported", () => {
    const device = makeDevice({ lastSeenAt: secondsAgo(30) });
    expect(computeDeviceStatus(device)).toBe("online");
  });

  it("returns online right at the reporting interval (one on-time check-in)", () => {
    const device = makeDevice({ lastSeenAt: secondsAgo(DEFAULT_INTERVAL) });
    expect(computeDeviceStatus(device)).toBe("online");
  });

  it("returns delayed after missing one check-in but not several", () => {
    // 1.5x the interval is the online→delayed boundary at this interval size.
    const device = makeDevice({ lastSeenAt: secondsAgo(DEFAULT_INTERVAL * 2) });
    expect(computeDeviceStatus(device)).toBe("delayed");
  });

  it("returns offline after missing many check-ins", () => {
    const device = makeDevice({ lastSeenAt: secondsAgo(DEFAULT_INTERVAL * 10) });
    expect(computeDeviceStatus(device)).toBe("offline");
  });

  it("uses the device's own configured reporting interval, not a fixed constant", () => {
    // Same age (40 minutes), two different intervals, two different verdicts
    // — this is the acceptance criterion "status uses the configured
    // reporting interval," made concrete: a slow-reporting device (1h
    // interval) is still "online" after 40 minutes of silence, while a
    // fast-reporting device (1 min interval, past even its floored 30-min
    // delayed threshold) is offline by then.
    const ageSeconds = 40 * 60;
    const slowDevice = makeDevice({ reportingIntervalSeconds: 3600, lastSeenAt: secondsAgo(ageSeconds) });
    const fastDevice = makeDevice({ reportingIntervalSeconds: 60, lastSeenAt: secondsAgo(ageSeconds) });

    expect(computeDeviceStatus(slowDevice)).toBe("online");
    expect(computeDeviceStatus(fastDevice)).toBe("offline");
  });

  it("floors the online/delayed thresholds for a very short reporting interval", () => {
    // A device reporting every 10s that's gone quiet for 2 minutes has
    // technically missed ~12 check-ins, but the floor (5 min) means a
    // short, ordinary network blip doesn't read as delayed/offline yet.
    const device = makeDevice({ reportingIntervalSeconds: 10, lastSeenAt: secondsAgo(120) });
    expect(computeDeviceStatus(device)).toBe("online");
  });

  it("does not floor away a real outage on a fast-reporting device", () => {
    const device = makeDevice({ reportingIntervalSeconds: 10, lastSeenAt: secondsAgo(60 * 60) });
    expect(computeDeviceStatus(device)).toBe("offline");
  });

  it("produces every documented status from realistic inputs", () => {
    const cases: [Device | undefined, DeviceStatus][] = [
      [undefined, "no-device"],
      [makeDevice({ lastSeenAt: null }), "never-connected"],
      [makeDevice({ lastSeenAt: secondsAgo(60) }), "online"],
      [makeDevice({ lastSeenAt: secondsAgo(DEFAULT_INTERVAL * 2) }), "delayed"],
      [makeDevice({ lastSeenAt: secondsAgo(DEFAULT_INTERVAL * 10) }), "offline"],
    ];

    for (const [device, expected] of cases) {
      expect(computeDeviceStatus(device)).toBe(expected);
    }
  });
});
