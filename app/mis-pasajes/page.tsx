"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Saved = { code: string; route: string; departsAt: string };

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Saved[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mis_pasajes");
      setTickets(raw ? JSON.parse(raw) : []);
    } catch {
      setTickets([]);
    }
  }, []);

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/" className="text-sm text-blue-700">← Volver al inicio</Link>
      <h1 className="mb-4 mt-3 text-2xl font-bold">Mis pasajes</h1>

      {tickets === null && <p className="text-gray-600">Cargando...</p>}

      {tickets?.length === 0 && (
        <p className="rounded border p-4 text-gray-600">
          No hay pasajes guardados en este celular. Si compraste desde otro
          dispositivo, búscalos allí o usa el enlace que guardaste.
        </p>
      )}

      <ul className="space-y-3">
        {tickets?.map((t) => (
          <li key={t.code}>
            <Link href={`/pasaje/${t.code}`} className="block rounded-lg border p-4 hover:bg-gray-50">
              <div className="font-semibold">{t.route}</div>
              <div className="text-sm text-gray-600">
                {new Date(t.departsAt).toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div className="mt-1 font-mono text-sm">{t.code}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}