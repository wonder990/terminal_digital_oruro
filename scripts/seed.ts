import { db } from "../lib/db";
import { companies, routes, departures, departureSeats } from "../lib/db/schema";

async function main() {
  const [company] = await db.insert(companies).values({ name: "Empresa de prueba" }).returning();

  const [route] = await db.insert(routes).values({
    companyId: company.id,
    origin: "Oruro",
    destination: "La Paz",
  }).returning();

  const [dep] = await db.insert(departures).values({
    routeId: route.id,
    departsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    priceCents: 3000,
    appSeatQuota: 10,
  }).returning();

  const seats = Array.from({ length: 10 }, (_, i) => ({
    departureId: dep.id,
    seatLabel: String(i + 1),
  }));
  await db.insert(departureSeats).values(seats);

  console.log("Listo. Salida creada:", dep.id);
  process.exit(0);
}

main();