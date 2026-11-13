"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleBlockAction } from "../../actions";
import { parseLayout } from "@/lib/bus-layout";
import BusView from "@/components/bus-view";

type Seat = { id: string; label: string; status: string };

const styles: Record<string, string> = {
  available: "border-green-600 bg-green-100 text-green-900 cursor-pointer hover:bg-green-200",
  blocked: "border-gray-700 bg-gray-700 text-white cursor-pointer",
  held: "border-yellow-500 bg-yellow-100 text-yellow-900 cursor-not-allowed",
  sold: "border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed",
};

export default function BlockMap({ seats, layout }: { seats: Seat[]; layout: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Record<string, string>>(
    Object.fromEntries(seats.map((s) => [s.id, s.status]))
  );
  const [error, setError] = useState<string | null>(null);

  const parsed = layout ? parseLayout(layout) : null;
  const decks = parsed && parsed.ok ? parsed.decks : null;
  const byLabel = new Map(seats.map((s) => [s.label, s]));
  const blockedCount = Object.values(status).filter((v) => v === "blocked").length;

  function toggle(seat: Seat) {
    const current = status[seat.id];
    if (pending || (current !== "available" && current !== "blocked")) return;
    setError(null);
    startTransition(async () => {
      const res = await toggleBlockAction(seat.id);
      if (res.ok) {
        setStatus((s) => ({ ...s, [seat.id]: res.status }));
        router.refresh();
      } else {
        setError("No se pudo cambiar ese asiento. Recarga la página e inténtalo de nuevo.");
      }
    });
  }

  function seatButton(seat: Seat) {
    const current = status[seat.id] ?? seat.status;
    return (
      <button
        type="button"
        onClick={() => toggle(seat)}
        disabled={pending}
        aria-label={`Asiento ${seat.label}, ${current}`}
        className={`flex h-11 w-full items-center justify-center rounded border-2 font-semibold ${styles[current] ?? styles.sold}`}
      >
        {current === "blocked" ? "✕" : seat.label}
      </button>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm">
        Bloqueados: <strong>{blockedCount}</strong>
      </p>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        <span>🟩 Libre</span>
        <span>⬛ Bloqueado (✕)</span>
        <span>🟨 Apartado</span>
        <span>⬜ Vendido</span>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      {decks ? (
        <BusView
          decks={decks}
          renderSeat={(label) => {
            const seat = byLabel.get(label);
            return seat ? seatButton(seat) : null;
          }}
        />
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {seats.map((s) => (
            <div key={s.id}>{seatButton(s)}</div>
          ))}
        </div>
      )}
    </div>
  );
}