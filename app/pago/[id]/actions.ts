"use server";

import { cookies } from "next/headers";
import { confirmGroupPayment, getPurchaseForUser } from "@/lib/services/purchases";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "id" aquí es el código de la compra completa
export async function simulatePaymentAction(groupId: string) {
  // El pago simulado solo funciona si lo activas con esta variable
  if (process.env.ENABLE_FAKE_PAYMENTS !== "true") {
    return { ok: false as const, error: "No disponible." };
  }
  if (!UUID.test(groupId)) return { ok: false as const, error: "Compra inválida." };

  const store = await cookies();
  const userId = store.get("session_id")?.value;
  if (!userId || !UUID.test(userId)) return { ok: false as const, error: "Sesión inválida." };

  // Solo quien apartó los asientos puede pagar
  const rows = await getPurchaseForUser(groupId, userId);
  if (rows.length === 0) return { ok: false as const, error: "Compra no encontrada." };

  try {
    await confirmGroupPayment({
      groupId,
      provider: "simulado",
      eventId: `sim-${groupId}`,
      payload: { simulated: true },
    });
    return { ok: true as const };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "No se pudo confirmar el pago." };
  }
}