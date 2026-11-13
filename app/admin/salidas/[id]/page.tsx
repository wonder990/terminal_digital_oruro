import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getDepartureWithSeats } from "@/lib/services/departures";
import BlockMap from "./block-map";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BlockSeatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const data = await getDepartureWithSeats(id);
  if (!data) notFound();
  const { departure, seats } = data;

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/admin" className="text-sm text-blue-700">← Volver al panel</Link>
      <h1 className="mt-3 text-2xl font-bold">
        {departure.origin} → {departure.destination}
      </h1>
      <p className="mb-2 text-gray-600">
        {departure.company} ·{" "}
        {departure.departsAt.toLocaleString("es-BO", {
          timeZone: "America/La_Paz",
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <p className="mb-4 text-sm text-gray-700">
        Toca un asiento libre para bloquearlo (no se venderá por la app) y vuelve a tocarlo para
        desbloquearlo. Los vendidos y los apartados no se pueden cambiar.
      </p>

      <BlockMap seats={seats} layout={departure.layout} />
    </main>
  );
}