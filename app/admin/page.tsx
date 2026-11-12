import Link from "next/link";
import { isAdmin } from "@/lib/admin-auth";
import { listAdminDepartures } from "@/lib/services/admin";
import LoginForm from "./login-form";
import DepartureForm from "./departure-form";
import { logoutAction, releaseHoldsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <main className="mx-auto max-w-sm p-4">
        <h1 className="mb-4 text-2xl font-bold">Administración</h1>
        <LoginForm />
      </main>
    );
  }

  const departures = await listAdminDepartures();

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administración</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-blue-700">Salir</button>
        </form>
      </div>

      <DepartureForm />

      <h2 className="mb-2 mt-8 text-lg font-semibold">Salidas</h2>
      {departures.length === 0 && <p className="text-gray-600">Todavía no hay salidas.</p>}

      <ul className="space-y-3">
        {departures.map((d) => (
          <li key={d.id} className="rounded-lg border p-4">
            <div className="font-semibold">
              {d.origin} → {d.destination} · Bs {(d.price_cents / 100).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              {d.company} ·{" "}
              {new Date(d.departs_at).toLocaleString("es-BO", {
                timeZone: "America/La_Paz",
                dateStyle: "medium",
                timeStyle: "short",
              })}
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