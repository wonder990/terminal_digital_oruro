"use server";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { holdSeat, releaseOtherSeats } from "@/lib/services/seats";
import { createBooking, validatePassenger } from "@/lib/services/bookings";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Identifica al visitante con un código guardado en una cookie
async function getSessionId() {
  const store = await cookies();
  let id = store.get("session_id")?.value;

  if (!id || !UUID.test(id)) {
    id = randomUUID();
    store.set("session_id", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return id;
}

export async function holdSeatAction(seatId: string) {
  if (!UUID.test(seatId)) return { ok: false as const, error: "INVALID" };

  const userId = await getSessionId();

  try {
    const row = await holdSeat(seatId, userId);
    await releaseOtherSeats(userId, seatId);
    return {
      ok: true as const,
      heldUntil: new Date(row.held_until).toISOString(),
    };
  } catch (e) {
    if (e instanceof Error && e.message === "SEAT_UNAVAILABLE") {
      return { ok: false as const, error: "SEAT_UNAVAILABLE" };
    }
    console.error(e);
    return { ok: false as const, error: "UNKNOWN" };
  }
}

export async function createBookingAction(
  seatId: string,
  form: { name: string; ci: string; phone: string }
) {
  if (!UUID.test(seatId)) {
    return { ok: false as const, error: "Asiento inválido." };
  }

  const checked = validatePassenger(form);
  if (!checked.ok) return { ok: false as const, error: checked.error };

  const userId = await getSessionId();

  try {
    const bookingId = await createBooking(seatId, userId, checked.value);
    return { ok: true as const, bookingId };
  } catch (e) {
    if (e instanceof Error && e.message === "HOLD_EXPIRED") {
      return {
        ok: false as const,
        error: "Se acabó el tiempo de tu asiento. Elige uno de nuevo.",
      };
    }
    console.error(e);
    return { ok: false as const, error: "Ocurrió un error. Intenta de nuevo." };
  }
}