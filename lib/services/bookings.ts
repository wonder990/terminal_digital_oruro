import { sql } from "drizzle-orm";
import { db } from "../db";

export type PassengerInput = { name: string; ci: string; phone: string };

// Limpia y valida los datos que escribe el pasajero
export function validatePassenger(raw: PassengerInput) {
  const name = raw.name.trim().replace(/\s+/g, " ");
  const ci = raw.ci.trim().toUpperCase().replace(/\s+/g, "");
  const phone = raw.phone.replace(/[\s-]/g, "").replace(/^\+?591/, "");

  if (name.length < 3 || name.length > 80 || !/^[\p{L}\s.'-]+$/u.test(name)) {
    return { ok: false, error: "Escribe tu nombre completo." } as const;
  }
  if (!/^\d{5,10}(-[0-9A-Z]{1,2})?$/.test(ci)) {
    return { ok: false, error: "Revisa tu número de carnet (CI)." } as const;
  }
  if (!/^[67]\d{7}$/.test(phone)) {
    return { ok: false, error: "Escribe un celular boliviano de 8 dígitos." } as const;
  }
  return { ok: true, value: { name, ci, phone } } as const;
}

// Crea la reserva pendiente. Solo funciona si el asiento sigue apartado para este usuario.
export async function createBooking(seatId: string, userId: string, p: PassengerInput) {
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      select id from departure_seats
      where id = ${seatId}
        and status = 'held'
        and held_by = ${userId}
        and held_until > now()
      for update
    `);
    if (locked.length === 0) throw new Error("HOLD_EXPIRED");

    // Si había una reserva pendiente anterior para este asiento, se cancela
    await tx.execute(sql`
      update bookings set status = 'cancelled'
      where seat_id = ${seatId} and status = 'pending'
    `);

    const inserted = await tx.execute(sql`
      insert into bookings (seat_id, passenger_name, passenger_ci, phone)
      values (${seatId}, ${p.name}, ${p.ci}, ${p.phone})
      returning id
    `);
    return (inserted[0] as unknown as { id: string }).id;
  });
}

// Datos de una reserva, solo si pertenece a quien tiene el asiento apartado
export async function getBookingForUser(bookingId: string, userId: string) {
  const rows = await db.execute(sql`
    select b.id, b.status, b.ticket_code, b.passenger_name, b.passenger_ci, b.phone,
           s.seat_label, s.held_until,
           d.price_cents, d.departs_at,
           r.origin, r.destination, c.name as company
    from bookings b
    join departure_seats s on s.id = b.seat_id
    join departures d on d.id = s.departure_id
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where b.id = ${bookingId} and s.held_by = ${userId}
  `);
  return (rows[0] as unknown as {
    id: string;
    status: string;
    ticket_code: string | null;
    passenger_name: string;
    passenger_ci: string;
    phone: string;
    seat_label: string;
    held_until: Date | null;
    price_cents: number;
    departs_at: Date;
    origin: string;
    destination: string;
    company: string;
  }) ?? null;
}