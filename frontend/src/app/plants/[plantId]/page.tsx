import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlant } from "@/lib/plants";

export default async function PlantDashboardPage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  const plant = await getPlant(plantId);

  if (!plant) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
      <Link href="/plants" className="font-mono text-xs uppercase tracking-widest text-ink-muted hover:text-primary">
        &larr; all plants
      </Link>
      <h1 className="font-display text-3xl tracking-tight text-ink">{plant.name}</h1>
      <p className="text-ink-muted">Dashboard for this plant is coming soon.</p>
    </div>
  );
}
