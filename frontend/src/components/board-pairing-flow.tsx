"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Check, Cpu, QrCode } from "lucide-react";
import { assignDeviceAction, registerDeviceAction } from "@/lib/actions/devices";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { BoardSetupLink } from "@/components/board-setup-link";
import { QrIdentifierScanner, useIsBarcodeDetectorSupported } from "@/components/qr-identifier-scanner";
import type { DeviceSetupSlot } from "@/lib/device-setup-url";
import type { Plant } from "@/lib/types";

type Step = "form" | "assign" | "done";

// A board has at most 4 channels (see firmware/lib/DeviceConfigStore's
// CHANNEL_COUNT) -- not a generic N-sensor flow, just a fixed ceiling of
// 4. How many are actually wired on a given unit is the user's choice
// (see sensorCount below): firmware already treats an unconfigured
// channel as "not in use" and skips it entirely (see
// DeviceConfigStore::load()'s and main.cpp's runChannelCycle() comments),
// so registering fewer than 4 is a fully supported, permanent
// configuration, not a placeholder for "the rest later."
const MAX_CHANNEL_COUNT = 4;
const SENSOR_COUNT_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }));

type RegisteredChannel = { deviceId: string; credential: string };

// Registers a board's sensors (1-4, user's choice) as independent backend
// Device rows (identifiers "<boardIdentifier>-ch1".."chN" -- see
// firmware's BOARD_IDENTIFIER comment for why one base identifier with
// derived suffixes, not hand-typed ones), lets the user assign each to
// its own plant, then hands back a single combined Wi-Fi/credential setup
// link/QR for the whole board (see BoardSetupLink) -- one AP join, one
// submission, not one per sensor.
export function BoardPairingFlow({
  unassignedPlants,
  initialPlantId,
}: {
  unassignedPlants: Plant[];
  initialPlantId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [boardIdentifier, setBoardIdentifier] = useState("");
  const [boardName, setBoardName] = useState("");
  const [sensorCount, setSensorCount] = useState(MAX_CHANNEL_COUNT);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredChannels, setRegisteredChannels] = useState<RegisteredChannel[]>([]);
  const [plantSelections, setPlantSelections] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const canScanQr = useIsBarcodeDetectorSupported();

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmedBoardIdentifier = boardIdentifier.trim();
    if (trimmedBoardIdentifier === "") {
      setFieldErrors({ boardIdentifier: "Enter the identifier printed on the board." });
      return;
    }

    setSubmitting(true);

    // Sequential, not Promise.all -- so a failure (most likely a 409 if
    // this board was already registered) is attributable to a specific
    // sensor rather than an ambiguous batch failure. No rollback of
    // already-registered slots on a later failure: no bulk-delete
    // endpoint exists, and this is a low-frequency, manually-recoverable
    // case, not worth building cleanup machinery for.
    const channels: RegisteredChannel[] = [];
    for (let i = 1; i <= sensorCount; i++) {
      const identifier = `${trimmedBoardIdentifier}-ch${i}`;
      const trimmedBoardName = boardName.trim();
      const name = trimmedBoardName ? `${trimmedBoardName} — Sensor ${i}` : identifier;

      try {
        const result = await registerDeviceAction({ name, identifier });
        if (!result.ok) {
          setFieldErrors(result.fieldErrors);
          setFormError(result.formError ?? `Sensor ${i} failed to register.`);
          setSubmitting(false);
          return;
        }
        channels.push({ deviceId: result.device.id, credential: result.credential });
      } catch {
        setFormError(`Something went wrong registering sensor ${i}.`);
        setSubmitting(false);
        return;
      }
    }

    setRegisteredChannels(channels);
    setPlantSelections(Array.from({ length: sensorCount }, (_, i) => (i === 0 ? (initialPlantId ?? "") : "")));
    setSubmitting(false);
    setStep("assign");
  }

  async function handleAssignConfirm() {
    setAssigning(true);
    setAssignError(null);

    for (let i = 0; i < registeredChannels.length; i++) {
      const plantId = plantSelections[i];
      if (!plantId) continue;

      const result = await assignDeviceAction(registeredChannels[i].deviceId, plantId);
      if (!result.ok) {
        setAssignError(`Sensor ${i + 1} could not be assigned: ${result.error}`);
        setAssigning(false);
        return;
      }
    }

    setAssigning(false);
    setStep("done");
  }

  function finish() {
    router.push("/devices");
    router.refresh();
  }

  if (step === "done") {
    const slots: DeviceSetupSlot[] = registeredChannels.map((channel, index) => ({
      slot: index + 1,
      deviceId: channel.deviceId,
      deviceKey: channel.credential,
    }));

    return (
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-status-healthy-bg">
          <Check size={40} className="text-status-healthy-fg" />
        </div>
        <p className="text-text-primary [font:var(--text-heading-m)]">Board registered</p>

        <BoardSetupLink boardIdentifier={boardIdentifier.trim()} slots={slots} />

        <Button variant="primary" onClick={finish}>
          Done
        </Button>
      </div>
    );
  }

  if (step === "assign") {
    const plantOptions = [
      { value: "", label: "Unassigned" },
      ...unassignedPlants.map((plant) => ({ value: plant.id, label: plant.name })),
    ];

    return (
      <div className="flex flex-col gap-5">
        <p className="text-text-secondary [font:var(--text-body-m)]">
          Choose which plant each sensor is watching.
        </p>

        <div className="flex flex-col gap-4">
          {plantSelections.map((selected, i) => (
            <Select
              key={i}
              label={`Sensor ${i + 1}`}
              value={selected}
              onChange={(event) => {
                const next = [...plantSelections];
                next[i] = event.target.value;
                setPlantSelections(next);
              }}
              options={plantOptions}
            />
          ))}
        </div>

        {assignError ? (
          <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
            {assignError}
          </p>
        ) : null}

        <Button variant="primary" onClick={handleAssignConfirm} disabled={assigning}>
          {assigning ? "Assigning…" : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-moss-tint">
          <Cpu size={40} className="text-action-primary" />
        </div>
        <p className="text-text-secondary [font:var(--text-body-m)]">
          Enter the identifier printed on your AINA sensor board to register its sensors.
        </p>
      </div>

      <form onSubmit={handleRegisterSubmit} noValidate className="flex flex-col gap-4">
        <Input
          id="boardIdentifier"
          label="Board identifier"
          placeholder="e.g. esp32-quad-01"
          value={boardIdentifier}
          onChange={(event) => setBoardIdentifier(event.target.value)}
          error={fieldErrors.boardIdentifier ?? fieldErrors.identifier}
        />

        {canScanQr ? (
          <Button type="button" variant="text" onClick={() => setScannerOpen(true)} className="self-start">
            <QrCode size={16} />
            Scan QR code instead
          </Button>
        ) : null}

        <Input
          id="boardName"
          label="Name (optional)"
          placeholder="e.g. Balcony board"
          value={boardName}
          onChange={(event) => setBoardName(event.target.value)}
        />

        <Select
          id="sensorCount"
          label="How many sensors are wired up?"
          value={String(sensorCount)}
          onChange={(event) => setSensorCount(Number(event.target.value))}
          options={SENSOR_COUNT_OPTIONS}
        />

        {formError ? (
          <p className="rounded-s bg-status-critical-bg px-3 py-2 text-status-critical-fg [font:var(--text-body-s)]">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Registering…" : "Register board"}
        </Button>
      </form>

      <Dialog
        open={scannerOpen}
        title="Scan board QR code"
        onClose={() => setScannerOpen(false)}
        footer={
          <Button variant="ghost" onClick={() => setScannerOpen(false)}>
            Cancel
          </Button>
        }
      >
        {scannerOpen ? (
          <QrIdentifierScanner
            onScan={(value) => {
              setBoardIdentifier(value);
              setScannerOpen(false);
            }}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
