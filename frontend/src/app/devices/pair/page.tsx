import { BackHeader } from "@/components/back-header";
import { DevicePairingFlow } from "@/components/device-pairing-flow";

export default async function DevicePairingPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const { plantId } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pt-6 pb-4">
      <BackHeader backHref={plantId ? `/plants/${plantId}` : "/devices"} title="Add a device" />
      <DevicePairingFlow plantId={plantId} />
    </div>
  );
}
