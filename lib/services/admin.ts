import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { busModels, companies, departures, departureSeats, routes } from "../db/schema";
import { parseLayout } from "../bus-layout";

export type NewDeparture = {
  company: string;
  origin: string;
  destination: string;
  departsAt: Date;
  priceCents: number;
  layout: string; // el plano en texto; se copia dentro de la salida
};

// Crea (o reutiliza) la empresa y la ruta, la salida y todos sus asientos, en una sola transacción
export async function createDeparture(input: NewDeparture) {
  const parsed = parseLayout(input.layout);
  if (!parsed.ok) throw new Error("INVALID_LAYOUT");
  const labels = parsed.labels;

  return db.transaction(async (tx) => {
    const existingCompany = (
      await tx.select().from(companies).where(eq(companies.name, input.company))
    )[0];
    const company =
      existingCompany ??
      (await tx.insert(companies).values({ name: input.company }).returning())[0];

    const existingRoute = (
      await tx
        .select()
        .from(routes)
        .where(
          and(
            eq(routes.companyId, company.id),
            eq(routes.origin, input.origin),
            eq(routes.destination, input.destination)
          )
        )
    )[0];
    const route =
      existingRoute ??
      (
        await tx
          .insert(routes)
          .values({
            companyId: company.id,
            origin: input.origin,
            destination: input.destination,
          })
          .returning()
      )[0];

    const [dep] = await tx
      .insert(departures)
      .values({
        routeId: route.id,
        departsAt: input.departsAt,
        priceCents: input.priceCents,
        appSeatQuota: labels.length,
        layout: input.layout.trim(),
      })
      .returning();

    await tx.insert(departureSeats).values(
      labels.map((label) => ({ departureId: dep.id, seatLabel: label }))
    );

    return dep.id;
  });
}

export async function listBusModels() {
  return db.select().from(busModels).orderBy(busModels.name);
}

// Guarda (o actualiza) un modelo de bus. Las salidas ya creadas no cambian.
export async function saveBusModel(name: string, layout: string) {
  await db
    .insert(busModels)
    .values({ name, layout: layout.trim() })
    .onConflictDoUpdate({ target: busModels.name, set: { layout: layout.trim() } });
}

export async function listAdminDepartures() {
  const rows = await db.execute(sql`
    select d.id, d.departs_at, d.price_cents, d.status,
           r.origin, r.destination, c.name as company,
           (select count(*)::int from departure_seats s where s.departure_id = d.id) as total,
           (select count(*)::int from departure_seats s
              where s.departure_id = d.id and s.status = 'sold') as sold,
           (select count(*)::int from departure_seats s
              where s.departure_id = d.id and s.status = 'held' and s.held_until > now()) as held
    from departures d
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where d.departs_at > now() - interval '12 hours'
    order by d.departs_at
    limit 50
  `);
  return rows as unknown as {
    id: string;
    departs_at: Date;
    price_cents: number;
    status: string;
    origin: string;
    destination: string;
    company: string;
    total: number;
    sold: number;
    held: number;
  }[];
}

// Libera todas las reservas sin pagar de una salida
export async function releaseHolds(departureId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      update bookings set status = 'cancelled'
      where status = 'pending'
        and seat_id in (
          select id from departure_seats where departure_id = ${departureId} and status = 'held'
        )
    `);
    const released = await tx.execute(sql`
      update departure_seats set status = 'available', held_by = null, held_until = null
      where departure_id = ${departureId} and status = 'held'
      returning id
    `);
    return released.length;
  });
}
export type SearchRow = {
  id: string;
  ticket_code: string;
  passenger_name: string;
  passenger_ci: string;
  phone: string;
  boarded_at: Date | null;
  seat_label: string;
  departs_at: Date;
  origin: string;
  destination: string;
  company: string;
};

// Busca boletos pagados por CI, celular, código o parte del nombre
export async function searchBookings(raw: string) {
  const q = raw.trim().slice(0, 60);
  if (q.length < 3) return [];

  const ci = q.toUpperCase().replace(/\s+/g, "");
  const phone = q.replace(/[\s-]/g, "").replace(/^\+?591/, "");
  const code = q.toUpperCase().replace(/\s+/g, "");
  // Se escapan los comodines para que se busque el texto tal cual
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const rows = await db.execute(sql`
    select b.id, b.ticket_code, b.passenger_name, b.passenger_ci, b.phone, b.boarded_at,
           s.seat_label, d.departs_at, r.origin, r.destination, c.name as company
    from bookings b
    join departure_seats s on s.id = b.seat_id
    join departures d on d.id = s.departure_id
    join routes r on r.id = d.route_id
    join companies c on c.id = r.company_id
    where b.status = 'paid'
      and (b.passenger_ci = ${ci}
           or b.phone = ${phone}
           or b.ticket_code = ${code}
           or b.passenger_name ilike ${like})
    order by b.created_at desc
    limit 30
  `);
  return rows as unknown as SearchRow[];
}

// Bloquea un asiento libre, o lo desbloquea si estaba bloqueado
export async function toggleSeatBlock(seatId: string) {
  const rows = (await db.execute(sql`
    update departure_seats
    set status = case when status = 'blocked' then 'available' else 'blocked' end,
        held_by = null, held_until = null
    where id = ${seatId}
      and (status in ('available', 'blocked') or (status = 'held' and held_until < now()))
    returning status
  `)) as unknown as { status: string }[];
  return rows.length > 0 ? rows[0].status : null;
}

// Cierra o reabre las ventas de una salida
export async function setDepartureStatus(id: string, status: "open" | "closed") {
  await db.execute(sql`
    update departures set status = ${status}
    where id = ${id} and status in ('open', 'closed')
  `);
}