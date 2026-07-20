import { AddPlantForm } from "@/components/add-plant-form";
import { BackHeader } from "@/components/back-header";

export default function AddPlantPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pt-6 pb-4">
      <BackHeader backHref="/plants" title="New plant" />
      <AddPlantForm />
    </div>
  );
}
