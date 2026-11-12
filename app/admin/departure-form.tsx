"use client";
// formulario para crear una nueva salida de bus, solo accesible para administradores
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDepartureAction } from "./actions";

const empty = {
  company: "",
  origin: "Oruro",
  destination: "",
  departsAt: "",
  price: "",
  seats: "40",
};

export default function DepartureForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await createDepartureAction(form);
      if (res.ok) {
        setMessage({ ok: true, text: "Salida creada." });
        // Se conservan empresa y origen para crear varias seguidas
        setForm({ ...empty, company: form.company, origin: form.origin });
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

      <label className="block text-sm">
        Fecha y hora de salida
        <input type="datetime-local" value={form.departsAt} onChange={set("departsAt")} required className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Precio (Bs)
          <input value={form.price} onChange={set("price")} inputMode="decimal" required className={input} placeholder="Ej: 30" />
        </label>
        <label className="block text-sm">
          Asientos para la app
          <input value={form.seats} onChange={set("seats")} inputMode="numeric" required className={input} />
        </label>
      </div>

      {message && (
        <p className={`rounded p-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Creando..." : "Crear salida"}
      </button>
    </form>
  );
}