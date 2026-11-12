import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { companies, departures, departureSeats, routes } from "../db/schema";

export type NewDeparture = {
  company: string;
  origin: string;
  destination: string;
  departsAt: Date;
  priceCents: number;
  seats: number;
};

// Crea (o reutiliza) la empresa y la ruta, la salida y todos sus asientos, en una sola transacción
export async function createDeparture(input: NewDeparture) {
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
        appSeatQuota: input.seats,
      })
      .returning();

    await tx.insert(departureSeats).values(
      Array.from({ length: input.seats }, (_, i) => ({
        departureId: dep.id,
        seatLabel: String(i + 1),
      }))
    );

    return dep.id;
  });
}

export async function listAdminDepartures() {
  const rows = await db.execute(sql`
    select d.id, d.departs_at, d.price_cents, d.status,
           r.origin, r.destination, c.name as company,
           (select count(*)::int from departure_seats s where s.departure_id = d.id) as total,
           (select count(*)::int from departure_seats s
              where s.departure_id = d.id and s.status = 'sold') as sold
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
  }[];
}