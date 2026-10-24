import { randomInt } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";

// 32 caracteres, sin 0/O ni 1/I para evitar confusiones al leerlo
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateTicketCode() {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

type BookingRow = {
  booking_status: string;
  ticket_code: string | null;
  seat_id: string;
  seat_status: string;
  price_cents: number;
};

// Confirma un pago. Se puede llamar varias veces con el mismo eventId sin duplicar nada.
export async function confirmPayment(input: {
  bookingId: string;
  provider: string;
  eventId: string;
  payload?: unknown;
}) {
  return db.transaction(async (tx) => {
    // 1. Registrar el evento. Si ya existía, no se inserta (idempotencia).
    const inserted = await tx.execute(sql`
      insert into payment_events (provider, event_id, payload)
      values (${input.provider}, ${input.eventId}, ${JSON.stringify(input.payload ?? {})}::jsonb)
      on conflict (provider, event_id) do nothing
      returning id
    `);

    // 2. Bloquear la reserva y el asiento mientras se procesa
    const rows = await tx.execute(sql`
      select b.status as booking_status, b.ticket_code,
             s.id as seat_id, s.status as seat_status,
             d.price_cents
      from bookings b
      join departure_seats s on s.id = b.seat_id
      join departures d on d.id = s.departure_id
      where b.id = ${input.bookingId}
      for update of b, s
    `);
    const row = rows[0] as unknown as BookingRow | undefined;
    if (!row) throw new Error("BOOKING_NOT_FOUND");

    // Evento repetido o reserva ya pagada: devolver el mismo pasaje
    if ((inserted.length === 0 || row.booking_status === "paid") && row.ticket_code) {
      return { ticketCode: row.ticket_code, alreadyProcessed: true };
    }

    if (row.booking_status !== "pending") throw new Error("BOOKING_NOT_PENDING");
    if (row.seat_status === "sold") throw new Error("SEAT_TAKEN");

    // 3. Todo en una sola transacción: reserva pagada, asiento vendido, pago registrado
    const ticketCode = generateTicketCode();

    await tx.execute(sql`
      update bookings set status = 'paid', ticket_code = ${ticketCode}
      where id = ${input.bookingId}
    `);
    await tx.execute(sql`
      update departure_seats set status = 'sold', held_until = null
      where id = ${row.seat_id}
    `);
    await tx.execute(sql`
      insert into payments (booking_id, provider, provider_ref, amount_cents, status)
      values (${input.bookingId}, ${input.provider}, ${input.eventId}, ${row.price_cents}, 'confirmed')
    `);

    return { ticketCode, alreadyProcessed: false };
  });
}