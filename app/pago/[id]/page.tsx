import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getPurchaseForUser } from "@/lib/services/purchases";
import PayButton from "./pay-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TZ = "America/La_Paz";

export default async function PaymentPage({
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
  if (rows.every((r) => r.status === "paid")) redirect(`/compra/${id}`);

  const now = Date.now();
  const expired = rows.some(
    (r) => r.status !== "pending" || !r.held_until || new Date(r.held_until).getTime() < now
  );
  const until = Math.min(
    ...rows.map((r) => (r.held_until ? new Date(r.held_until).getTime() : 0))
  );
  const first = rows[0];
  const total = rows.reduce((sum, r) => sum + r.price_cents, 0);

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold">Resumen de tu compra</h1>

      <div className="space-y-1 rounded border p-4">
        <p className="text-lg font-semibold">
          {first.origin} → {first.destination}
        </p>
        <p className="text-gray-600">
          {first.company} ·{" "}
          {new Date(first.departs_at).toLocaleString("es-BO", {
            timeZone: TZ,
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>

        <ul className="divide-y pt-2">
          {rows.map((r) => (
            <li key={r.id} className="py-2">
              <p>
                Asiento <strong>{r.seat_label}</strong> · {r.passenger_name}
              </p>
              <p className="text-sm text-gray-600">
                CI {r.passenger_ci} · Bs {(r.price_cents / 100).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-sm text-gray-600">Celular: {first.phone}</p>
        <p className="pt-2 text-xl font-bold">Total: Bs {(total / 100).toFixed(2)}</p>
      </div>

      {expired ? (
        <p className="mt-4 rounded bg-red-50 p-3 text-red-800">
          Esta reserva ya no está activa. Vuelve a elegir tus asientos.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-700">
            Tus asientos están apartados hasta las{" "}
            <strong>
              {new Date(until).toLocaleTimeString("es-BO", {
                timeZone: TZ,
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
            .
          </p>
          {process.env.ENABLE_FAKE_PAYMENTS === "true" ? (
            <PayButton bookingId={id} />
          ) : (
            <p className="mt-4 rounded border p-3 text-gray-600">
              El pago con QR estará disponible pronto.
            </p>
          )}
        </>
      )}
    </main>
  );
}