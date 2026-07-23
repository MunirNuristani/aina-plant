"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Minimal wrapper around the browser's native BarcodeDetector API --
// deliberately no fallback decode library (e.g. jsQR): manual identifier
// entry already fully works in board-pairing-flow.tsx, so a library
// purely to cover the Safari/iOS gap (BarcodeDetector isn't available
// there) isn't worth the bundle weight for what's already an optional
// convenience. Callers should feature-detect via `useIsBarcodeDetectorSupported()`
// and simply not offer the "Scan QR" entry point when it's false.
export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

// BarcodeDetector support never changes after the page loads, so there's
// nothing to actually subscribe to -- this no-op satisfies
// useSyncExternalStore's subscribe contract below, which exists purely to
// read this browser-only value without a server/client hydration
// mismatch (calling isBarcodeDetectorSupported() directly during render
// would read `window` on the client's very first render too, before
// hydration reconciles against the server's markup, since the server
// snapshot is always false with no `window`).
function subscribeToNothing() {
  return () => {};
}

export function useIsBarcodeDetectorSupported(): boolean {
  return useSyncExternalStore(subscribeToNothing, isBarcodeDetectorSupported, () => false);
}

// Renders a live camera feed and calls onScan once with the first QR
// code's decoded text. Mount this only while actually scanning (e.g.
// inside an open Dialog) -- mounting requests camera access immediately,
// and unmounting is what stops the camera stream (see the cleanup effect
// below), so there's no separate "start/stop" API to call.
export function QrIdentifierScanner({
  onScan,
  onError,
}: {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [statusMessage, setStatusMessage] = useState("Requesting camera access…");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detectIntervalId: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function start() {
      if (!isBarcodeDetectorSupported()) {
        setStatusMessage("QR scanning isn't supported in this browser.");
        onError?.("QR scanning isn't supported in this browser.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        if (cancelled) return;
        setStatusMessage("Camera access was denied.");
        onError?.("Camera access was denied.");
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setStatusMessage("Point the camera at the device's QR code.");

      // BarcodeDetector isn't in the standard lib.dom.d.ts yet -- narrow
      // cast at the one call site that needs it, rather than widening
      // this component's types.
      type BarcodeDetectorLike = {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
      };
      const DetectorCtor = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
      const detector = new DetectorCtor({ formats: ["qr_code"] });

      detectIntervalId = setInterval(async () => {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0 && !cancelled) {
            onScan(barcodes[0].rawValue);
          }
        } catch {
          // A transient decode error on one frame isn't worth surfacing --
          // the next interval tick just tries again.
        }
      }, 300);
    }

    start();

    return () => {
      cancelled = true;
      if (detectIntervalId !== null) clearInterval(detectIntervalId);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onScan/onError are expected to be stable per mount; re-subscribing mid-scan would restart the camera
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <video ref={videoRef} muted playsInline className="w-full rounded-m bg-black" />
      <p className="text-text-muted [font:var(--text-body-s)]">{statusMessage}</p>
    </div>
  );
}
