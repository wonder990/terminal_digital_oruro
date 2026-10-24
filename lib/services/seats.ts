import { sql } from "drizzle-orm";
import { db } from "../db";

export async function holdSeat(seatId: string, userId: string) {
  const result = await db.execute(sql`
    update departure_seats
    set status = 'held',
        held_by = ${userId},
        held_until = now() + interval '8 minutes'
    where id = ${seatId}
      and (status = 'available'
           or (status = 'held' and held_until < now()))
    returning id, held_until
  `);

  if (result.length === 0) {
    throw new Error("SEAT_UNAVAILABLE");
  }
  return result[0] as unknown as { id: string; held_until: Date };
}

// Si el usuario cambia de asiento, libera los que había apartado antes
export async function releaseOtherSeats(userId: string, keepSeatId: string) {
  await db.execute(sql`
    update departure_seats
    set status = 'available', held_by = null, held_until = null
    where held_by = ${userId}
      and status = 'held'
      and id <> ${keepSeatId}
  `);
}