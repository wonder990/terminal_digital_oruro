import { sql } from "drizzle-orm";
import { db } from "../db";

export type Ticket = {
  ticket_code: string;
  passenger_name: string;
  passenger_ci: string;
  seat_label: string;
  departs_at: Date;
  price_cents: number;
  origin: string;
  destination: string;
  company: string;
};

export async function getTicketByCode(code: string) {
  const rows = await db.execute(sql`
    select b.ticket_code, b.passenger_name, b.passenger_ci,
           s.seat_label, d.departs_at, d.price_cents,
           r.origin, r.destination, c.name as company
    from bookings b
    join departure_seats s on s.id = b.seat_id
    join departures d on d.id = s.departure_id
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where b.ticket_code = ${code} and b.status = 'paid'
  `);
  return (rows[0] as unknown as Ticket) ?? null;
}