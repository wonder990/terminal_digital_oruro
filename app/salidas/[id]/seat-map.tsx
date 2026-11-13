"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPurchaseAction } from "./actions";
import { parseLayout } from "@/lib/bus-layout";
import BusView from "@/components/bus-view";

type Seat = { id: string; label: string; status: string };

const MAX = 4;

const seatStyles: Record<string, string> = {
  available: "border-green-600 bg-green-100 text-green-900 cursor-pointer hover:bg-green-200",
  held: "border-yellow-500 bg-yellow-100 text-yellow-900 cursor-not-allowed",
  sold: "border-gray-400 bg-gray-300 text-gray-600 cursor-not-allowed",
  mine: "border-blue-600 bg-blue-600 text-white cursor-pointer",
};

export default function SeatMap({ seats, layout }: { seats: Seat[]; layout: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [people, setPeople] = useState<Record<string, { name: string; ci: string }>>({});
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Las salidas sin plano se muestran con la grilla simple de siempre
  const parsed = layout ? parseLayout(layout) : null;
  const decks = parsed && parsed.ok ? parsed.decks : null;

  const byLabel = new Map(seats.map((s) => [s.label, s]));
  const kinds = new Map<string, string>();
  decks?.forEach((d) =>
    d.rows.forEach((row) =>
      row.forEach((c) => {
        if (c.type === "seat") kinds.set(c.label, c.kind);
      })
    )
  );

  const chosen = seats.filter((s) => selected.includes(s.id));

  function toggle(seat: Seat) {
    if (seat.status !== "available" || pending) return;
    setError(null);
    if (selected.includes(seat.id)) {
      setSelected(selected.filter((id) => id !== seat.id));
    } else if (selected.length >= MAX) {
      setError(`Máximo ${MAX} asientos por compra.`);
    } else {
      setSelected([...selected, seat.id]);
    }
  }

  function setPerson(id: string, key: "name" | "ci", value: string) {
    const current = people[id] ?? { name: "", ci: "" };
    setPeople({ ...people, [id]: { ...current, [key]: value } });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || chosen.length === 0) return;
    setError(null);

    startTransition(async () => {
      const res = await startPurchaseAction({
        seats: chosen.map((s) => ({
          seatId: s.id,
          name: people[s.id]?.name ?? "",
          ci: people[s.id]?.ci ?? "",
        })),
        phone,
      });

      if (res.ok) {
        router.push(`/pago/${res.groupId}`);
      } else {
        setError(res.error);
        if ("refresh" in res && res.refresh) {
          setSelected([]);
          router.refresh();
        }
      }
    });
  }

  function seatButton(s: Seat) {
    const style = seatStyles[selected.includes(s.id) ? "mine" : s.status];
    const kind = kinds.get(s.label);
    return (
      <button
        type="button"
        onClick={() => toggle(s)}
        disabled={pending}
        aria-label={`Asiento ${s.label}${kind ? `, ${kind}` : ""}`}
        className={`flex h-11 w-full items-center justify-center rounded border-2 font-semibold ${style}`}
      >
        {s.label}
      </button>
    );
  }

  const input = "mt-1 w-full rounded border p-2";

  return (
    <div>
      {decks ? (
        <>
          <BusView
            decks={decks}
            renderSeat={(label) => {
              const seat = byLabel.get(label);
              return seat ? seatButton(seat) : null;
            }}
          />
          <p className="text-xs text-gray-600">
            Las franjas celestes a los costados son las ventanas: los asientos pegados a ellas son de ventana.
          </p>
        </>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {seats.map((s) => (
            <div key={s.id}>{seatButton(s)}</div>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-gray-600">
        Puedes elegir hasta {MAX} asientos. Cada pasajero lleva su propio boleto.
      </p>

      {error && <p className="mt-3 rounded bg-red-50 p-3 text-red-800">{error}</p>}

      {chosen.length > 0 && (
        <form onSubmit={submit} className="mt-4 space-y-4 rounded border border-blue-600 bg-blue-50 p-4">
          {chosen.map((s) => (
            <fieldset key={s.id} className="space-y-2 rounded border bg-white p-3">
              <legend className="px-1 font-semibold">
                Asiento {s.label}
                {kinds.get(s.label) ? ` · ${kinds.get(s.label)}` : ""}
              </legend>
              <label className="block text-sm">
                Nombre completo
                <input
                  value={people[s.id]?.name ?? ""}
                  onChange={(e) => setPerson(s.id, "name", e.target.value)}
                  required
                  className={input}
                />
              </label>
              <label className="block text-sm">
                Carnet de identidad (CI)
                <input
                  value={people[s.id]?.ci ?? ""}
                  onChange={(e) => setPerson(s.id, "ci", e.target.value)}
                  inputMode="numeric"
                  required
                  className={input}
                />
              </label>
            </fieldset>
          ))}

          <label className="block text-sm">
            Celular del comprador (WhatsApp)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Ej: 71234567"
              required
              className={input}
            />
          </label>

          <p className="text-xs text-gray-600">
            Al continuar, tus asientos se apartan por 10 minutos para que pagues.
          </p>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Procesando..." : `Continuar al pago (${chosen.length})`}
          </button>
        </form>
      )}
    </div>
  );
}