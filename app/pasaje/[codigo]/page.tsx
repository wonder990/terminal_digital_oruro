import Link from "next/link";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getTicketByCode } from "@/lib/services/tickets";
import ShareButtons from "./share-buttons";
import SaveTicket from "./save-ticket";

export const dynamic = "force-dynamic";

// Esta página no debe aparecer en Google
export const metadata = { robots: { index: false, follow: false } };

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const TZ = "America/La_Paz";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const code = codigo.toUpperCase();
  if (!CODE.test(code)) notFound();

  const ticket = await getTicketByCode(code);
  if (!ticket) notFound();

  const qr = await QRCode.toDataURL(ticket.ticket_code, { width: 300, margin: 2 });

  const dep = new Date(ticket.departs_at);
  const boardBy = new Date(dep.getTime() - 30 * 60 * 1000);
  const dateText = dep.toLocaleDateString("es-BO", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  });
  const hour = (d: Date) =>
    d.toLocaleTimeString("es-BO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  // Se muestra solo el final del CI por privacidad
  const ci = ticket.passenger_ci;
  const maskedCi = "•".repeat(Math.max(0, ci.length - 3)) + ci.slice(-3);

  const summary = `Mi pasaje ${ticket.origin} → ${ticket.destination}, ${dateText} ${hour(dep)}, asiento ${ticket.seat_label}.`;

  return (
    <main className="mx-auto max-w-md p-4">
      <SaveTicket
        code={ticket.ticket_code}
        route={`${ticket.origin} → ${ticket.destination}`}
        departsAt={dep.toISOString()}
      />

      <div className="overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-green-700 px-4 py-3 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest">Pasaje confirmado</p>
          <p className="text-lg">{ticket.company}</p>
        </div>

        <div className="p-4">
          <h1 className="text-2xl font-bold">
            {ticket.origin} → {ticket.destination}
          </h1>
          <p className="text-gray-700 first-letter:uppercase">
            {dateText} · <span className="font-semibold">{hour(dep)}</span>
          </p>

          <dl className="mt-4 divide-y text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Llegar a las</dt>
              <dd className="font-semibold">{hour(boardBy)}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Asiento</dt>
              <dd className="font-semibold">{ticket.seat_label}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Pasajero</dt>
              <dd className="font-semibold">{ticket.passenger_name}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">CI</dt>
              <dd className="font-semibold">{maskedCi}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Precio</dt>
              <dd className="font-semibold">Bs {(ticket.price_cents / 100).toFixed(2)}</dd>
            </div>
          </dl>

          <div className="mt-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Código QR de tu pasaje" className="mx-auto h-56 w-56" />
            <p className="font-mono text-2xl font-bold tracking-widest">{ticket.ticket_code}</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-gray-600">
        Muestra este QR al abordar y lleva tu carnet de identidad.
      </p>
      <p className="mt-2 text-center text-sm text-gray-600">
        Guarda esta página en tus marcadores o descarga el boleto: no necesitas
        cuenta para volver a verla, solo este enlace.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <ShareButtons summary={summary} />
        <a
          href={`/pasaje/${ticket.ticket_code}/imagen`}
          download={`pasaje-${ticket.ticket_code}.png`}
          className="rounded border border-blue-600 p-3 text-center font-semibold text-blue-700"
        >
          Descargar boleto
        </a>
        <Link href="/" className="rounded bg-blue-600 p-3 text-center font-semibold text-white">
          Comprar otro pasaje
        </Link>
        <Link href="/mis-pasajes" className="text-center text-sm text-blue-700">
          Ver mis pasajes
        </Link>
      </div>
    </main>
  );
}