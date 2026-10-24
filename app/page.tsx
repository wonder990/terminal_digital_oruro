import Link from "next/link";
import { listDepartures } from "@/lib/services/departures";

// Siempre consultar datos frescos, nunca una copia guardada
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const departures = await listDepartures();

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-2xl font-bold">Pasajes desde Oruro</h1>
      <p className="mb-6 text-gray-600">Elige tu salida y tu asiento.</p>

      {departures.length === 0 && <p>No hay salidas disponibles por ahora.</p>}

      <ul className="space-y-3">
        {departures.map((d) => (
          <li key={d.id}>
            <Link
              href={`/salidas/${d.id}`}
              className="block rounded-lg border p-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">
                  {d.origin} → {d.destination}
                </span>
                <span className="font-bold">Bs {(d.priceCents / 100).toFixed(2)}</span>
              </div>
              <div className="text-sm text-gray-600">
                {d.company} ·{" "}
                {d.departsAt.toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}