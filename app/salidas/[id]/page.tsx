import Link from "next/link";
import { notFound } from "next/navigation";
import { getDepartureWithSeats } from "@/lib/services/departures";
import SeatMap from "./seat-map";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DeparturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const data = await getDepartureWithSeats(id);
  if (!data) notFound();

  const { departure, seats } = data;

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="text-sm text-blue-700">
        ← Volver a las salidas
      </Link>

      <h1 className="mt-3 text-2xl font-bold">
        {departure.origin} → {departure.destination}
      </h1>
      <p className="mb-4 text-gray-600">
        {departure.company} ·{" "}
        {departure.departsAt.toLocaleString("es-BO", {
          timeZone: "America/La_Paz",
          dateStyle: "medium",
          timeStyle: "short",
        })}{" "}
        · Bs {(departure.priceCents / 100).toFixed(2)}
      </p>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span>🟩 Libre</span>
        <span>🟨 Ocupado temporalmente</span>
        <span>🟦 Tu asiento</span>
        <span>⬜ Vendido</span>
      </div>

      <SeatMap seats={seats} layout={departure.layout} />
    </main>
  );
}