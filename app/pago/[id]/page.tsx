import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getBookingForUser } from "@/lib/services/bookings";
import PayButton from "./pay-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Solo quien apartó el asiento puede ver esta reserva
  const booking = await getBookingForUser(id, userId);
  if (!booking) notFound();

  const paid = booking.status === "paid" && booking.ticket_code;
  const expired =
    booking.status !== "pending" ||
    !booking.held_until ||
    new Date(booking.held_until) < new Date();

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold">Resumen de tu compra</h1>

      <div className="space-y-1 rounded border p-4">
        <p className="text-lg font-semibold">
          {booking.origin} → {booking.destination}
        </p>
        <p className="text-gray-600">
          {booking.company} ·{" "}
          {new Date(booking.departs_at).toLocaleString("es-BO", {
            timeZone: "America/La_Paz",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
        <p>Asiento: <strong>{booking.seat_label}</strong></p>
        <p>Pasajero: <strong>{booking.passenger_name}</strong></p>
        <p>CI: {booking.passenger_ci}</p>
        <p>Celular: {booking.phone}</p>
        <p className="pt-2 text-xl font-bold">
          Total: Bs {(booking.price_cents / 100).toFixed(2)}
        </p>
      </div>

      {paid ? (
        <Link
          href={`/pasaje/${booking.ticket_code}`}
          className="mt-4 block rounded bg-green-600 p-3 text-center font-semibold text-white"
        >
          Esta compra ya está pagada. Ver mi pasaje
        </Link>
      ) : expired ? (
        <p className="mt-4 rounded bg-red-50 p-3 text-red-800">
          Esta reserva ya no está activa. Vuelve a elegir tu asiento.
        </p>
      ) : process.env.NODE_ENV !== "production" ? (
        <PayButton bookingId={booking.id} />
      ) : (
        <p className="mt-4 rounded border p-3 text-gray-600">
          El pago con QR estará disponible pronto.
        </p>
      )}
    </main>
  );
}