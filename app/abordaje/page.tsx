import Link from "next/link";
import { isStaff } from "@/lib/staff-auth";
import { listBoardingDepartures } from "@/lib/services/boarding";
import LoginForm from "./login-form";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function BoardingHome() {
  if (!(await isStaff())) {
    return (
      <main className="mx-auto max-w-sm p-4">
        <h1 className="mb-4 text-2xl font-bold">Acceso del personal</h1>
        <LoginForm />
      </main>
    );
  }

  const departures = await listBoardingDepartures();

  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Abordaje</h1>
        <form action={logoutAction}>
          <button type="submit" className="text-sm text-blue-700">Salir</button>
        </form>
      </div>
      <p className="mb-4 text-gray-600">Elige la salida que estás abordando.</p>

      {departures.length === 0 && <p>No hay salidas en este momento.</p>}

      <ul className="space-y-3">
        {departures.map((d) => (
          <li key={d.id}>
            <Link href={`/abordaje/${d.id}`} className="block rounded-lg border p-4 hover:bg-gray-50">
              <div className="text-lg font-semibold">
                {d.origin} → {d.destination}
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
                Abordaron <strong>{d.boarded_count}</strong> de <strong>{d.paid_count}</strong>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}