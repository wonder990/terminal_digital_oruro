"use server";

import { cookies, headers } from "next/headers";
import { randomUUID } from "crypto";
import { allowAttempt } from "@/lib/rate-limit";
import { validatePassenger } from "@/lib/services/bookings";
import { createPurchase, MAX_SEATS_PER_PURCHASE } from "@/lib/services/purchases";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Límites: por sesión, estrictos; por IP, holgados (muchas personas comparten IP en redes de celular)
const SESSION_MAX = 6;
const IP_MAX = 30;
const WINDOW_SECONDS = 600;

// Identifica al visitante con un código guardado en una cookie
async function getSessionId() {
  const store = await cookies();
  let id = store.get("session_id")?.value;

  if (!id || !UUID.test(id)) {
    id = randomUUID();
    store.set("session_id", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return id;
}

async function getClientIp() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? h.get("x-real-ip") ?? "desconocida").trim();
}

type Input = {
  seats: { seatId: string; name: string; ci: string }[];
  phone: string;
};

export async function startPurchaseAction(input: Input) {
  const seats = input.seats ?? [];
  if (seats.length < 1 || seats.length > MAX_SEATS_PER_PURCHASE) {
    return { ok: false as const, error: `Elige entre 1 y ${MAX_SEATS_PER_PURCHASE} asientos.` };
  }

  const ids = seats.map((s) => s.seatId);
  if (ids.some((id) => !UUID.test(id)) || new Set(ids).size !== ids.length) {
    return { ok: false as const, error: "Asientos inválidos." };
  }

  const items = [];
  const cis = new Set<string>();
  for (const s of seats) {
    const checked = validatePassenger({ name: s.name, ci: s.ci, phone: input.phone });
    if (!checked.ok) return { ok: false as const, error: checked.error };
    if (cis.has(checked.value.ci)) {
      return { ok: false as const, error: "Dos pasajeros no pueden tener el mismo CI." };
    }
    cis.add(checked.value.ci);
    items.push({ seatId: s.seatId, ...checked.value });
  }

  const userId = await getSessionId();
  const ip = await getClientIp();

  const okSession = await allowAttempt(`compra:sesion:${userId}`, SESSION_MAX, WINDOW_SECONDS);
  const okIp = await allowAttempt(`compra:ip:${ip}`, IP_MAX, WINDOW_SECONDS);
  if (!okSession || !okIp) {
    return {
      ok: false as const,
      error: "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.",
    };
  }

  try {
    const groupId = await createPurchase(userId, items);
    return { ok: true as const, groupId };
  } catch (e) {
    if (e instanceof Error && e.message === "SEAT_UNAVAILABLE") {
      return {
        ok: false as const,
        refresh: true,
        error: "Alguno de los asientos ya no está disponible. Elige de nuevo.",
      };
    }
    if (e instanceof Error && e.message === "HOLD_CAP") {
      return {
        ok: false as const,
        error: "Hay muchas personas comprando en esta salida. Intenta de nuevo en unos minutos.",
      };
    }
    console.error(e);
    return { ok: false as const, error: "Ocurrió un error. Intenta de nuevo." };
  }
}