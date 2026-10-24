"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBookingAction, holdSeatAction } from "./actions";

type Seat = { id: string; label: string; status: string };

const seatStyles: Record<string, string> = {
  available: "border-green-600 bg-green-100 text-green-900 cursor-pointer hover:bg-green-200",
  held: "border-yellow-500 bg-yellow-100 text-yellow-900 cursor-not-allowed",
  sold: "border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed",
  mine: "border-blue-600 bg-blue-600 text-white",
};

export default function SeatMap({ seats }: { seats: Seat[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<{ id: string; label: string; heldUntil: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({ name: "", ci: "", phone: "" });
  const [formError, setFormError] = useState<string | null>(null);

  // Reloj que se actualiza cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = selected ? Math.max(0, Math.floor((selected.heldUntil - now) / 1000)) : 0;

  // Cuando el tiempo se acaba, se suelta el asiento
  useEffect(() => {
    if (selected && remaining === 0) {
      setSelected(null);
      setMessage("Se acabó el tiempo. Elige un asiento de nuevo.");
      router.refresh();
    }
  }, [selected, remaining, router]);

  function pick(seat: Seat) {
    if (seat.status !== "available" || pending) return;
    setMessage(null);
    setFormError(null);

    startTransition(async () => {
      const res = await holdSeatAction(seat.id);

      if (res.ok) {
        setSelected({ id: seat.id, label: seat.label, heldUntil: new Date(res.heldUntil).getTime() });
      } else if (res.error === "SEAT_UNAVAILABLE") {
        setMessage("Ese asiento ya fue tomado. Elige otro.");
      } else {
        setMessage("Ocurrió un error. Intenta de nuevo.");
      }
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || pending) return;
    setFormError(null);

    startTransition(async () => {
      const res = await createBookingAction(selected.id, form);
      if (res.ok) {
        router.push(`/pago/${res.bookingId}`);
      } else {
        setFormError(res.error);
      }
    });
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        {seats.map((s) => {
          const style = seatStyles[s.id === selected?.id ? "mine" : s.status];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(s)}
              disabled={pending}
              className={`flex h-12 items-center justify-center rounded border-2 font-semibold ${style}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {message && <p className="mt-4 rounded bg-red-50 p-3 text-red-800">{message}</p>}

      {selected && (
        <div className="mt-4 rounded border border-blue-600 bg-blue-50 p-4">
          <p className="font-semibold">Asiento {selected.label} apartado para ti</p>
          <p className="mb-4 text-sm text-gray-700">
            Tienes <span className="font-mono font-bold">{minutes}:{seconds}</span> para completar tu compra.
          </p>

          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              Nombre completo
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>

            <label className="block text-sm">
              Carnet de identidad (CI)
              <input
                type="text"
                value={form.ci}
                onChange={(e) => setForm({ ...form, ci: e.target.value })}
                inputMode="numeric"
                placeholder="Ej: 1234567"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>

            <label className="block text-sm">
              Celular (WhatsApp)
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ej: 71234567"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>

            {formError && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{formError}</p>}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Procesando..." : "Continuar al pago"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}