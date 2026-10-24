"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { simulatePaymentAction } from "./actions";

export default function PayButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    startTransition(async () => {
      const res = await simulatePaymentAction(bookingId);
      if (res.ok) router.push(`/pasaje/${res.ticketCode}`);
      else setError(res.error);
    });
  }

  return (
    <div className="mt-4 rounded border border-dashed border-orange-500 bg-orange-50 p-4 text-center">
      <p className="mb-3 text-sm text-orange-900">
        Modo de pruebas: aquí irá el QR real de pago.
      </p>
      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="w-full rounded bg-orange-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Confirmando..." : "Simular pago"}
      </button>
      {error && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    </div>
  );
}