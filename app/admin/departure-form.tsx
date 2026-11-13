"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDepartureAction } from "./actions";
import { TEMPLATES, parseLayout } from "@/lib/bus-layout";
import BusView from "@/components/bus-view";

type Model = { id: string; name: string; layout: string };

const empty = {
  company: "",
  origin: "Oruro",
  destination: "",
  departsAt: "",
  price: "",
  layout: TEMPLATES[0].layout,
  saveAs: "",
};

export default function DepartureForm({ models }: { models: Model[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = parseLayout(form.layout);

  const set =
    (key: keyof typeof empty) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  function pickModel(value: string) {
    if (value.startsWith("m:")) {
      const m = models.find((x) => x.id === value.slice(2));
      if (m) setForm({ ...form, layout: m.layout });
    } else if (value.startsWith("t:")) {
      const t = TEMPLATES[Number(value.slice(2))];
      if (t) setForm({ ...form, layout: t.layout });
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createDepartureAction(form);
      if (res.ok) {
        setMessage({ ok: true, text: "Salida creada." });
        // Se conservan empresa, origen y plano para crear varias seguidas
        setForm({ ...empty, company: form.company, origin: form.origin, layout: form.layout });
        router.refresh();
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  const input = "mt-1 w-full rounded border p-2";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Nueva salida</h2>

      <label className="block text-sm">
        Empresa
        <input value={form.company} onChange={set("company")} required className={input} placeholder="Ej: Flota Ejemplo" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Origen
          <input value={form.origin} onChange={set("origin")} required className={input} />
        </label>
        <label className="block text-sm">
          Destino
          <input value={form.destination} onChange={set("destination")} required className={input} placeholder="Ej: La Paz" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Fecha y hora de salida
          <input type="datetime-local" value={form.departsAt} onChange={set("departsAt")} required className={input} />
        </label>
        <label className="block text-sm">
          Precio (Bs)
          <input value={form.price} onChange={set("price")} inputMode="decimal" required className={input} placeholder="Ej: 30" />
        </label>
      </div>

      <div className="space-y-2 rounded border bg-gray-50 p-3">
        <p className="text-sm font-semibold">Plano del bus</p>

        <label className="block text-sm">
          Cargar un modelo
          <select
            defaultValue=""
            onChange={(e) => pickModel(e.target.value)}
            className="mt-1 w-full rounded border p-2"
          >
            <option value="" disabled>
              Elige un modelo...
            </option>
            {models.length > 0 && (
              <optgroup label="Mis modelos">
                {models.map((m) => (
                  <option key={m.id} value={`m:${m.id}`}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Ejemplos">
              {TEMPLATES.map((t, i) => (
                <option key={t.name} value={`t:${i}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="block text-sm">
          Plano (edítalo para que coincida con el bus real)
          <textarea
            value={form.layout}
            onChange={set("layout")}
            rows={8}
            spellCheck={false}
            className="mt-1 w-full rounded border p-2 font-mono text-sm"
          />
        </label>
        <p className="text-xs text-gray-600">
          Cada línea es una fila. Número o letra = asiento, <code>.</code> = pasillo, <code>_</code> =
          espacio vacío, <code>---</code> = separa el piso de abajo del de arriba.
        </p>

        {parsed.ok ? (
          <div>
            <p className="mb-2 text-sm text-green-800">{parsed.labels.length} asientos</p>
            <BusView
              decks={parsed.decks}
              renderSeat={(label) => (
                <div className="flex h-9 items-center justify-center rounded border-2 border-green-600 bg-green-100 text-sm font-semibold">
                  {label}
                </div>
              )}
            />
          </div>
        ) : (
          <p className="rounded bg-red-50 p-2 text-sm text-red-800">{parsed.error}</p>
        )}

        <label className="block text-sm">
          Guardar este plano como modelo (opcional)
          <input
            value={form.saveAs}
            onChange={set("saveAs")}
            maxLength={40}
            className={input}
            placeholder="Ej: Flota Ejemplo · Semicama 36"
          />
        </label>
      </div>

      {message && (
        <p className={`rounded p-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !parsed.ok}
        className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear salida"}
      </button>
    </form>
  );
}