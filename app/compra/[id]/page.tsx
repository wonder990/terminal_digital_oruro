import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getPurchaseForUser } from "@/lib/services/purchases";
import SaveTicket from "@/app/pasaje/[codigo]/save-ticket";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = "America/La_Paz";

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const store = await cookies();
  const userId = store.get("session_id")?.value;
  if (!userId || !UUID.test(userId)) notFound();

  const rows = await getPurchaseForUser(id, userId);
  if (rows.length === 0) notFound();
  if (rows.some((r) => r.status !== "paid" || !r.ticket_code)) redirect(`/pago/${id}`);

  const first = rows[0];

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold">Compra confirmada</h1>
      <p className="mb-4 text-gray-600">
        {first.origin} → {first.destination} ·{" "}
        {new Date(first.departs_at).toLocaleString("es-BO", {
          timeZone: TZ,
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>

      <p className="mb-3 text-sm text-gray-700">
        Cada pasajero tiene su propio boleto. Abre cada uno para descargarlo o enviarlo por WhatsApp.
      </p>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <SaveTicket
              code={r.ticket_code as string}
              route={`${r.origin} → ${r.destination}`}
              departsAt={new Date(r.departs_at).toISOString()}
            />
            <Link
              href={`/pasaje/${r.ticket_code}`}
              className="block rounded-lg border p-4 hover:bg-gray-50"
            >
              <div className="font-semibold">
                Asiento {r.seat_label} · {r.passenger_name}
              </div>
              <div className="font-mono text-sm">{r.ticket_code}</div>
              <div className="text-sm text-blue-700">Ver boleto →</div>
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/" className="mt-6 block text-center text-sm text-blue-700">
        ← Volver al inicio
      </Link>
    </main>
  );
}