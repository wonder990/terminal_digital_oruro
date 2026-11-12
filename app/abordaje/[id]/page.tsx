import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isStaff } from "@/lib/staff-auth";
import { getBoardingDeparture, listPassengers } from "@/lib/services/boarding";
import BoardingPanel from "./boarding-panel";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BoardingDeparturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isStaff())) redirect("/abordaje");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const dep = await getBoardingDeparture(id);
  if (!dep) notFound();

  const passengers = await listPassengers(id);

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/abordaje" className="text-sm text-blue-700">← Salidas</Link>
      <h1 className="mt-2 text-2xl font-bold">
        {dep.origin} → {dep.destination}
      </h1>
      <p className="mb-4 text-gray-600">
        {dep.company} ·{" "}
        {new Date(dep.departs_at).toLocaleString("es-BO", {
          timeZone: "America/La_Paz",
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>

      <BoardingPanel
        departureId={id}
        initialPassengers={passengers.map((p) => ({
          code: p.ticket_code,
          name: p.passenger_name,
          ci: p.passenger_ci,
          seat: p.seat_label,
          boarded: p.boarded_at !== null,
        }))}
      />
    </main>
  );
}