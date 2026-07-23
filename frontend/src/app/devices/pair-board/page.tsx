import { BackHeader } from "@/components/back-header";
import { BoardPairingFlow } from "@/components/board-pairing-flow";
import { getPlants } from "@/lib/plants";

export default async function PairBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ plantId?: string }>;
}) {
  const { plantId } = await searchParams;
  const plants = await getPlants();
  const unassignedPlants = plants.filter((plant) => plant.devices.length === 0);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pt-6 pb-4">
      <BackHeader backHref="/devices" title="Add a sensor board" />
      <BoardPairingFlow unassignedPlants={unassignedPlants} initialPlantId={plantId} />
    </div>
  );
}
