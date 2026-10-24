import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { companies, departures, departureSeats, routes } from "../db/schema";

const departureFields = {
  id: departures.id,
  departsAt: departures.departsAt,
  priceCents: departures.priceCents,
  origin: routes.origin,
  destination: routes.destination,
  company: companies.name,
};

// Lista de salidas abiertas que aún no han partido
export async function listDepartures() {
  return db
    .select(departureFields)
    .from(departures)
    .innerJoin(routes, eq(departures.routeId, routes.id))
    .innerJoin(companies, eq(routes.companyId, companies.id))
    .where(and(eq(departures.status, "open"), gt(departures.departsAt, new Date())))
    .orderBy(asc(departures.departsAt));
}

// Una salida con sus asientos
export async function getDepartureWithSeats(id: string) {
  const [departure] = await db
    .select(departureFields)
    .from(departures)
    .innerJoin(routes, eq(departures.routeId, routes.id))
    .innerJoin(companies, eq(routes.companyId, companies.id))
    .where(eq(departures.id, id));

  if (!departure) return null;

  const rows = await db
    .select()
    .from(departureSeats)
    .where(eq(departureSeats.departureId, id));

  const now = new Date();
  const seats = rows
    .map((s) => ({
      id: s.id,
      label: s.seatLabel,
      // Una reserva temporal vencida cuenta como asiento libre
      status:
        s.status === "held" && s.heldUntil && s.heldUntil < now
          ? "available"
          : s.status,
    }))
    .sort((a, b) => Number(a.label) - Number(b.label));

  return { departure, seats };
}