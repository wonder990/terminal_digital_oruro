import { randomUUID } from "crypto";
import { db } from "../lib/db";
import { departureSeats } from "../lib/db/schema";
import { holdSeat } from "../lib/services/seats";

async function main() {
  const [seat] = await db.select().from(departureSeats).limit(1);

  const attempts = Array.from({ length: 50 }, () =>
    holdSeat(seat.id, randomUUID()).then(() => "ok").catch(() => "fail")
  );
  const results = await Promise.all(attempts);

  console.log("Reservas exitosas:", results.filter((r) => r === "ok").length);
  console.log("Rechazadas:", results.filter((r) => r === "fail").length);
  process.exit(0);
}

main();