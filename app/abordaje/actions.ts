"use server";

import { redirect } from "next/navigation";
import { boardTicket, unboardTicket, type BoardResult } from "@/lib/services/boarding";
import { clearStaffCookie, isStaff, pinIsValid, setStaffCookie } from "@/lib/staff-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loginAction(pin: string) {
  if (pinIsValid(pin)) {
    await setStaffCookie();
    return { ok: true as const };
  }
  // Pequeña demora para frenar el ensayo de claves
  await new Promise((r) => setTimeout(r, 800));
  return { ok: false as const, error: "Clave incorrecta." };
}

export async function logoutAction() {
  await clearStaffCookie();
  redirect("/abordaje");
}

export async function boardAction(code: string, departureId: string): Promise<BoardResult> {
  if (!(await isStaff())) return { status: "unauthorized" };
  if (!UUID.test(departureId)) return { status: "invalid" };
  return boardTicket(code, departureId);
}

export async function unboardAction(code: string, departureId: string) {
  if (!(await isStaff())) return { ok: false as const };
  if (!UUID.test(departureId)) return { ok: false as const };
  const ok = await unboardTicket(code, departureId);
  return { ok };
}