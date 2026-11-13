import Link from "next/link";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/admin-auth";
import { listAdminDepartures, listBusModels, searchBookings } from "@/lib/services/admin";
import LoginForm from "./login-form";
import DepartureForm from "./departure-form";
import { logoutAction, releaseHoldsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const TZ = "America/La_Paz";
const fmt = (d: Date | string) =>
  new Date(d).toLocaleString("es-BO", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto max-w-sm p-4">
        <h1 className="mb-4 text-2xl font-bold">Administración</h1>
        <LoginForm />
      </main>
    );
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [departures, results, models] = await Promise.all([
    listAdminDepartures(),
    q ? searchBookings(q) : Promise.resolve([]),
    listBusModels(),
  ]);

  // Dirección del sitio, para armar el enlace del boleto
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administración</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-blue-700">Salir</button>
        </form>
      </div>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-2 text-lg font-semibold">Buscar boleto</h2>
        <form method="get" action="/admin" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="CI, celular, nombre o código"
            className="w-full rounded border p-2"
          />
          <button type="submit" className="rounded bg-blue-600 px-4 font-semibold text-white">
            Buscar
          </button>
        </form>

        {q && q.length < 3 && (
          <p className="mt-3 text-sm text-gray-600">Escribe al menos 3 caracteres.</p>
        )}
        {q.length >= 3 && results.length === 0 && (
          <p className="mt-3 text-sm text-gray-600">No se encontraron boletos pagados.</p>
        )}

        <ul className="mt-3 space-y-3">
          {results.map((r) => {
            const link = `${baseUrl}/pasaje/${r.ticket_code}`;
            const text = `Hola ${r.passenger_name.split(" ")[0]}, aquí está tu boleto ${r.origin} → ${r.destination}, ${fmt(r.departs_at)}: ${link}`;
            const wa = `https://wa.me/591${r.phone}?text=${encodeURIComponent(text)}`;
            return (
              <li key={r.id} className="rounded border p-3 text-sm">
                <p className="font-semibold">
                  {r.passenger_name} · Asiento {r.seat_label}
                  {r.boarded_at && <span className="ml-2 text-green-700">Abordó</span>}
                </p>
                <p className="text-gray-600">
                  CI {r.passenger_ci} · Cel. {r.phone}
                </p>
                <p className="text-gray-600">
                  {r.company} · {r.origin} → {r.destination} · {fmt(r.departs_at)}
                </p>
                <p className="font-mono">{r.ticket_code}</p>
                <div className="mt-2 flex gap-4">
                  <a href={`/pasaje/${r.ticket_code}`} target="_blank" rel="noreferrer" className="text-blue-700">
                    Ver boleto
                  </a>
                  <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-green-700">
                    Enviar por WhatsApp
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <DepartureForm models={models.map((m) => ({ id: m.id, name: m.name, layout: m.layout }))} />

      <h2 className="mb-2 mt-8 text-lg font-semibold">Salidas</h2>
      {departures.length === 0 && <p className="text-gray-600">Todavía no hay salidas.</p>}

      <ul className="space-y-3">
        {departures.map((d) => (
          <li key={d.id} className="rounded-lg border p-4">
            <div className="font-semibold">
              {d.origin} → {d.destination} · Bs {(d.price_cents / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              {d.company} · {fmt(d.departs_at)}
            </div>
            <div className="mt-1 text-sm">
              Vendidos <strong>{d.sold}</strong> de <strong>{d.total}</strong> · Apartados ahora{" "}
              <strong>{d.held}</strong>
            </div>
            <div className="mt-2 flex gap-4 text-sm">
              <Link href={`/salidas/${d.id}`} className="text-blue-700">Ver asientos</Link>
              <Link href={`/abordaje/${d.id}`} className="text-blue-700">Abordaje</Link>
            </div>
            {d.held > 0 && (
              <form action={releaseHoldsAction} className="mt-2">
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" className="text-sm font-semibold text-red-700">
                  Liberar reservas sin pagar ({d.held})
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}