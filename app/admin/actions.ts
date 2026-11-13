"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  adminPinIsValid,
  clearAdminCookie,
  isAdmin,
  setAdminCookie,
} from "@/lib/admin-auth";
import { createDeparture, releaseHolds, saveBusModel } from "@/lib/services/admin";
import { parseLayout } from "@/lib/bus-layout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loginAction(pin: string) {
  if (adminPinIsValid(pin)) {
    await setAdminCookie();
    return { ok: true as const };
  }
  // Pequeña demora para frenar el ensayo de claves
  await new Promise((r) => setTimeout(r, 800));
  return { ok: false as const, error: "Clave incorrecta." };
}

export async function logoutAction() {
  await clearAdminCookie();
  redirect("/admin");
}

type Form = {
  company: string;
  origin: string;
  destination: string;
  departsAt: string; // formato "2026-11-15T20:30"
  price: string; // en bolivianos
  layout: string; // plano del bus en texto
  saveAs: string; // nombre para guardar el plano como modelo (opcional)
};

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

export async function createDepartureAction(form: Form) {
  if (!(await isAdmin())) {
    return { ok: false as const, error: "Tu sesión venció. Vuelve a entrar." };
  }

  const company = clean(form.company);
  const origin = clean(form.origin);
  const destination = clean(form.destination);

  for (const [label, value] of [
    ["empresa", company],
    ["origen", origin],
    ["destino", destination],
  ]) {
    if (value.length < 2 || value.length > 60) {
      return { ok: false as const, error: `Revisa el campo ${label}.` };
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.departsAt)) {
    return { ok: false as const, error: "Fecha y hora inválidas." };
  }
  // Bolivia está en UTC-4 todo el año, sin horario de verano
  const departsAt = new Date(`${form.departsAt}:00-04:00`);
  if (Number.isNaN(departsAt.getTime()) || departsAt.getTime() < Date.now()) {
    return { ok: false as const, error: "La salida debe ser en el futuro." };
  }

  const price = Number(form.price.replace(",", "."));
  if (!Number.isFinite(price) || price <= 0 || price > 10000) {
    return { ok: false as const, error: "Precio inválido." };
  }

  const parsed = parseLayout(form.layout);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  try {
    const id = await createDeparture({
      company,
      origin,
      destination,
      departsAt,
      priceCents: Math.round(price * 100),
      layout: form.layout,
    });

    const modelName = clean(form.saveAs ?? "");
    if (modelName.length >= 2 && modelName.length <= 40) {
      try {
        await saveBusModel(modelName, form.layout);
      } catch (e) {
        console.error(e); // la salida ya se creó; solo falló guardar el modelo
      }
    }

    revalidatePath("/admin");
    return { ok: true as const, id };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "No se pudo crear la salida." };
  }
}

export async function releaseHoldsAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;
  await releaseHolds(id);
  revalidatePath("/admin");
}