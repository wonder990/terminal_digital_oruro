"use server";

import { cookies } from "next/headers";
import { getBookingForUser } from "@/lib/services/bookings";
import { confirmPayment } from "@/lib/services/payments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function simulatePaymentAction(bookingId: string) {
  // El pago simulado NUNCA debe funcionar en producción: sería regalar pasajes
  if (process.env.NODE_ENV === "production") {
    return { ok: false as const, error: "No disponible." };
  }
  if (!UUID.test(bookingId)) return { ok: false as const, error: "Reserva inválida." };

  const store = await cookies();
  const userId = store.get("session_id")?.value;
  if (!userId || !UUID.test(userId)) return { ok: false as const, error: "Sesión inválida." };

  // Solo quien apartó el asiento puede pagar su reserva
  const booking = await getBookingForUser(bookingId, userId);
  if (!booking) return { ok: false as const, error: "Reserva no encontrada." };

  try {
    const { ticketCode } = await confirmPayment({
      bookingId,
      provider: "simulado",
      eventId: `sim-${bookingId}`,
      payload: { simulated: true },
    });
    return { ok: true as const, ticketCode };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "No se pudo confirmar el pago." };
  }
}