import { sql } from "drizzle-orm";
import { db } from "../db";

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;

export type BoardResult =
  | { status: "ok"; name: string; ci: string; seat: string }
  | { status: "already"; name: string; seat: string; at: string }
  | { status: "wrong_departure"; origin: string; destination: string; at: string }
  | { status: "invalid" }
  | { status: "unauthorized" };

// Salidas de las últimas 6 horas y las próximas 48
export async function listBoardingDepartures() {
  const rows = await db.execute(sql`
    select d.id, d.departs_at, r.origin, r.destination, c.name as company,
      (select count(*)::int from bookings b
         join departure_seats s on s.id = b.seat_id
         where s.departure_id = d.id and b.status = 'paid') as paid_count,
      (select count(*)::int from bookings b
         join departure_seats s on s.id = b.seat_id
         where s.departure_id = d.id and b.status = 'paid' and b.boarded_at is not null) as boarded_count
    from departures d
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where d.status <> 'cancelled'
      and d.departs_at between now() - interval '6 hours' and now() + interval '48 hours'
    order by d.departs_at
  `);
  return rows as unknown as {
    id: string;
    departs_at: Date;
    origin: string;
    destination: string;
    company: string;
    paid_count: number;
    boarded_count: number;
  }[];
}

export async function getBoardingDeparture(id: string) {
  const rows = await db.execute(sql`
    select d.departs_at, r.origin, r.destination, c.name as company
    from departures d
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where d.id = ${id}
  `);
  return (rows[0] as unknown as {
    departs_at: Date;
    origin: string;
    destination: string;
    company: string;
  }) ?? null;
}

export async function listPassengers(departureId: string) {
  const rows = await db.execute(sql`
    select b.ticket_code, b.passenger_name, b.passenger_ci, s.seat_label, b.boarded_at
    from bookings b
    join departure_seats s on s.id = b.seat_id
    where s.departure_id = ${departureId} and b.status = 'paid'
    order by length(s.seat_label), s.seat_label
  `);
  return rows as unknown as {
    ticket_code: string;
    passenger_name: string;
    passenger_ci: string;
    seat_label: string;
    boarded_at: Date | null;
  }[];
}

// Marca el abordaje en UNA sola operación: si dos personas escanean el mismo QR
// a la vez, solo una lo logra y la otra ve "ya abordó".
export async function boardTicket(rawCode: string, departureId: string): Promise<BoardResult> {
  const code = rawCode.trim().toUpperCase();
  if (!CODE.test(code)) return { status: "invalid" };

  const updated = (await db.execute(sql`
    update bookings b
    set boarded_at = now()
    from departure_seats s
    where s.id = b.seat_id
      and s.departure_id = ${departureId}
      and b.ticket_code = ${code}
      and b.status = 'paid'
      and b.boarded_at is null
    returning b.passenger_name, b.passenger_ci, s.seat_label
  `)) as unknown as { passenger_name: string; passenger_ci: string; seat_label: string }[];

  if (updated.length > 0) {
    const u = updated[0];
    return { status: "ok", name: u.passenger_name, ci: u.passenger_ci, seat: u.seat_label };
  }

  // No se pudo marcar: averiguar por qué
  const rows = (await db.execute(sql`
    select b.status, b.boarded_at, b.passenger_name, s.seat_label, s.departure_id,
           d.departs_at, r.origin, r.destination
    from bookings b
    join departure_seats s on s.id = b.seat_id
    join departures d on d.id = s.departure_id
    join routes r on r.id = d.route_id
    where b.ticket_code = ${code}
  `)) as unknown as {
    status: string;
    boarded_at: Date | null;
    passenger_name: string;
    seat_label: string;
    departure_id: string;
    departs_at: Date;
    origin: string;
    destination: string;
  }[];

  const row = rows[0];
  if (!row || row.status !== "paid") return { status: "invalid" };

  if (row.departure_id !== departureId) {
    return {
      status: "wrong_departure",
      origin: row.origin,
      destination: row.destination,
      at: new Date(row.departs_at).toISOString(),
    };
  }
  if (row.boarded_at) {
    return {
      status: "already",
      name: row.passenger_name,
      seat: row.seat_label,
      at: new Date(row.boarded_at).toISOString(),
    };
  }
  return { status: "invalid" };
}

// Quita la marca de abordaje (para corregir un error del encargado)
export async function unboardTicket(rawCode: string, departureId: string) {
  const code = rawCode.trim().toUpperCase();
  if (!CODE.test(code)) return false;

  const rows = (await db.execute(sql`
    update bookings b
    set boarded_at = null
    from departure_seats s
    where s.id = b.seat_id
      and s.departure_id = ${departureId}
      and b.ticket_code = ${code}
      and b.status = 'paid'
      and b.boarded_at is not null
    returning b.id
  `)) as unknown as { id: string }[];

  return rows.length > 0;
}