"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignDeviceAction,
  rotateDeviceCredentialAction,
  setDeviceEnabledAction,
  unassignDeviceAction,
} from "@/lib/actions/devices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { BoardSetupLink } from "@/components/board-setup-link";
import type { DeviceListItem, Plant } from "@/lib/types";

// A channel's identifier is "<boardIdentifier>-chN" (see
// board-pairing-flow.tsx / firmware's BOARD_IDENTIFIER comment). Falls
// back to treating the whole identifier as the board identifier and slot
// 1 for a device registered before boards existed (or any identifier
// that doesn't match the "-chN" convention) -- ProvisioningPortal's
// mismatch guard only ever compares against this same value, so a
// same-shaped fallback on both sides keeps rotation working either way.
function boardIdentifierAndSlot(identifier: string): { boardIdentifier: string; slot: number } {
  const match = identifier.match(/^(.*)-ch([1-4])$/);
  if (!match) {
    return { boardIdentifier: identifier, slot: 1 };
  }
  return { boardIdentifier: match[1], slot: Number(match[2]) };
}

export function DeviceDetailControls({
  device,
  unassignedPlants,
}: {
  device: DeviceListItem;
  unassignedPlants: Plant[];
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(device.enabled);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reconfigureCredential, setReconfigureCredential] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    setError(null);
    const result = await setDeviceEnabledAction(device.id, next);
    if (!result.ok) {
      setEnabled(!next);
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleAssign(plantId: string) {
    setBusy(true);
    setError(null);
    // reassign: true -- this device may already be assigned elsewhere
    // (that's exactly why the dialog is open), so a plain assign that
    // rejects on an existing assignment would just make "reassign" not work.
    const result = await assignDeviceAction(device.id, plantId, true);
    setBusy(false);
    if (result.ok) {
      setReassignOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleUnpair() {
    setBusy(true);
    setError(null);
    const result = await unassignDeviceAction(device.id);
    setBusy(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  // Issues a fresh device credential and shows the same setup link/QR
  // used right after initial registration -- for a device that's already
  // paired but just needs new Wi-Fi (moved, router changed). The
  // original credential was only ever shown once and isn't stored in
  // plaintext, so this is the only way to get a working setup link for
  // an existing device.
  async function handleReconfigureWifi() {
    setRotating(true);
    setError(null);
    const result = await rotateDeviceCredentialAction(device.id);
    setRotating(false);
    if (result.ok) {
      setReconfigureCredential(result.credential);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Switch checked={enabled} onChange={toggleEnabled} label="Device enabled" />
      </Card>

      {error ? (
        <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
          {error}
        </p>
      ) : null}

      <Button variant="secondary" onClick={() => setReassignOpen(true)} disabled={busy}>
        {device.plant ? "Reassign to another plant" : "Assign to a plant"}
      </Button>

      <Button variant="secondary" onClick={handleReconfigureWifi} disabled={busy || rotating}>
        {rotating ? "Preparing setup link…" : "Reconfigure Wi-Fi"}
      </Button>

      {device.plant ? (
        <Button variant="text" onClick={handleUnpair} disabled={busy}>
          Unpair device
        </Button>
      ) : null}

      <Dialog
        open={reassignOpen}
        title="Choose a plant"
        onClose={() => setReassignOpen(false)}
        footer={
          <Button variant="ghost" onClick={() => setReassignOpen(false)}>
            Close
          </Button>
        }
      >
        {unassignedPlants.length === 0 ? (
          <p className="text-text-muted [font:var(--text-body-m)]">
            No unassigned plants available. Add a plant first.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {unassignedPlants.map((plant) => (
              <button
                key={plant.id}
                type="button"
                onClick={() => handleAssign(plant.id)}
                disabled={busy}
                className="flex items-center justify-between rounded-m border border-border-default bg-surface-card p-4 text-left transition-shadow duration-200 ease-[var(--ease-standard)] hover:shadow-raised disabled:opacity-50"
              >
                <div className="flex flex-col">
                  <span className="text-text-primary [font:var(--text-heading-s)]">{plant.name}</span>
                  {plant.location ? (
                    <span className="text-text-muted [font:var(--text-body-s)]">{plant.location}</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        open={reconfigureCredential !== null}
        title="Reconfigure Wi-Fi"
        onClose={() => setReconfigureCredential(null)}
        footer={
          <Button variant="ghost" onClick={() => setReconfigureCredential(null)}>
            Close
          </Button>
        }
      >
        {reconfigureCredential
          ? (() => {
              const { boardIdentifier, slot } = boardIdentifierAndSlot(device.identifier);
              return (
                <BoardSetupLink
                  boardIdentifier={boardIdentifier}
                  slots={[{ slot, deviceId: device.id, deviceKey: reconfigureCredential }]}
                />
              );
            })()
          : null}
      </Dialog>
    </div>
  );
}
