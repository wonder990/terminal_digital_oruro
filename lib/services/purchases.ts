import { randomInt, randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { bookings } from "../db/schema";

export const MAX_SEATS_PER_PURCHASE = 4;

export type PurchaseItem = { seatId: string; name: string; ci: string; phone: string };

// Aparta TODOS los asientos o NINGUNO, y crea una reserva por pasajero
// Tope de asientos apartados sin pagar por salida: 40 % y mínimo 8
const HOLD_CAP_PERCENT = 0.4;
const HOLD_CAP_MIN = 8;

// Aparta TODOS los asientos o NINGUNO, y crea una reserva por pasajero
export async function createPurchase(userId: string, items: PurchaseItem[]) {
  const ids = items.map((i) => i.seatId);
  const groupId = randomUUID();

  return db.transaction(async (tx) => {
    const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);

    // 0. Todos los asientos deben ser de la misma salida
    const deps = (await tx.execute(sql`
      select distinct departure_id from departure_seats where id in (${idList})
    `)) as unknown as { departure_id: string }[];
    if (deps.length !== 1) throw new Error("SEAT_UNAVAILABLE");
    const departureId = deps[0].departure_id;

    // Un candado por salida: las compras de una misma salida se procesan de una en una
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${departureId}::text))`);

    // 1. Soltar lo que esta persona tenía apartado antes
    await tx.execute(sql`
      update bookings set status = 'cancelled'
      where status = 'pending'
        and seat_id in (select id from departure_seats where held_by = ${userId} and status = 'held')
    `);
    await tx.execute(sql`
      update departure_seats set status = 'available', held_by = null, held_until = null
      where held_by = ${userId} and status = 'held'
    `);

    // 2. Revisar el tope de apartados de esta salida
    const stats = (await tx.execute(sql`
      select count(*)::int as total,
             (count(*) filter (where status = 'held' and held_until > now()))::int as held
      from departure_seats where departure_id = ${departureId}
    `)) as unknown as { total: number; held: number }[];
    const cap = Math.max(HOLD_CAP_MIN, Math.ceil(stats[0].total * HOLD_CAP_PERCENT));
    if (stats[0].held + ids.length > cap) throw new Error("HOLD_CAP");

    // 3. Apartar todos (salida abierta y que no haya partido)
    const held = (await tx.execute(sql`
      update departure_seats s
      set status = 'held', held_by = ${userId}, held_until = now() + interval '10 minutes'
      from departures d
      where d.id = s.departure_id
        and d.status = 'open'
        and d.departs_at > now()
        and s.id in (${idList})
        and (s.status = 'available' or (s.status = 'held' and s.held_until < now()))
      returning s.id
    `)) as unknown as { id: string }[];
    if (held.length !== ids.length) throw new Error("SEAT_UNAVAILABLE");

    // 4. Cancelar reservas pendientes viejas de esos asientos
    await tx.execute(sql`
      update bookings set status = 'cancelled'
      where status = 'pending' and seat_id in (${idList})
    `);

    // 5. Una reserva por pasajero
    await tx.insert(bookings).values(
      items.map((i) => ({
        seatId: i.seatId,
        groupId,
        passengerName: i.name,
        passengerCi: i.ci,
        phone: i.phone,
      }))
    );

    return groupId;
  });
}

export type PurchaseRow = {
  id: string;
  status: string;
  ticket_code: string | null;
  passenger_name: string;
  passenger_ci: string;
  phone: string;
  seat_label: string;
  held_until: Date | string | null;
  price_cents: number;
  departs_at: Date | string;
  origin: string;
  destination: string;
  company: string;
};

// Solo quien apartó los asientos puede ver la compra
export async function getPurchaseForUser(groupId: string, userId: string) {
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
    where b.group_id = ${groupId}
      and s.held_by = ${userId}
      and b.status in ('pending', 'paid')
    order by length(s.seat_label), s.seat_label
  `);
  return rows as unknown as PurchaseRow[];
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateTicketCode() {
  let code = "";
  for (let i = 0; i < 10; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

// Confirma el pago de TODA la compra en una sola transacción. Se puede repetir sin duplicar nada.
export async function confirmGroupPayment(input: {
  groupId: string;
  provider: string;
  eventId: string;
  payload?: unknown;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into payment_events (provider, event_id, payload)
      values (${input.provider}, ${input.eventId}, ${JSON.stringify(input.payload ?? {})}::jsonb)
      on conflict (provider, event_id) do nothing
    `);

    const rows = (await tx.execute(sql`
      select b.id, b.status, s.id as seat_id, s.status as seat_status, d.price_cents
      from bookings b
      join departure_seats s on s.id = b.seat_id
      join departures d on d.id = s.departure_id
      where b.group_id = ${input.groupId} and b.status in ('pending', 'paid')
      for update of b, s
    `)) as unknown as {
      id: string;
      status: string;
      seat_id: string;
      seat_status: string;
      price_cents: number;
    }[];

    if (rows.length === 0) throw new Error("BOOKING_NOT_FOUND");
    if (rows.every((r) => r.status === "paid")) return { alreadyProcessed: true };
    if (rows.some((r) => r.status !== "pending" || r.seat_status === "sold")) {
      throw new Error("SEAT_TAKEN");
    }

    for (const r of rows) {
      await tx.execute(sql`
        update bookings set status = 'paid', ticket_code = ${generateTicketCode()}
        where id = ${r.id}
      `);
      await tx.execute(sql`
        update departure_seats set status = 'sold', held_until = null where id = ${r.seat_id}
      `);
      await tx.execute(sql`
        insert into payments (booking_id, provider, provider_ref, amount_cents, status)
        values (${r.id}, ${input.provider}, ${input.eventId}, ${r.price_cents}, 'confirmed')
      `);
    }
    return { alreadyProcessed: false };
  });
}