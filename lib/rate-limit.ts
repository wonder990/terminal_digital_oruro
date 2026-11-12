import { sql } from "drizzle-orm";
import { db } from "./db";

// Devuelve true si el intento se permite, false si se superó el límite
export async function allowAttempt(key: string, max: number, windowSeconds: number) {
  const rows = (await db.execute(sql`
    select count(*)::int as n from rate_events
    where key = ${key}
      and created_at > now() - ${windowSeconds}::int * interval '1 second'
  `)) as unknown as { n: number }[];

  if (rows[0].n >= max) return false;

  await db.execute(sql`insert into rate_events (key) values (${key})`);

  // Limpieza ocasional de registros viejos
  if (Math.random() < 0.02) {
    await db.execute(sql`delete from rate_events where created_at < now() - interval '1 day'`);
  }
  return true;
}