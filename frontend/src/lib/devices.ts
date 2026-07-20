import { apiFetch } from "./api";
import type { DeviceListItem } from "./types";

export async function getDevices(): Promise<DeviceListItem[]> {
  const res = await apiFetch("/devices", { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load devices (${res.status})`);
  }

  const data: { devices: DeviceListItem[] } = await res.json();
  return data.devices;
}

export async function getDevice(deviceId: string): Promise<DeviceListItem | null> {
  const res = await apiFetch(`/devices/${deviceId}`, { cache: "no-store" });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to load device ${deviceId} (${res.status})`);
  }

  const data: { device: DeviceListItem } = await res.json();
  return data.device;
}
