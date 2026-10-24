import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getTicketByCode } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

// Esta página no debe aparecer en Google
export const metadata = { robots: { index: false, follow: false } };

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;

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

  // Se muestra solo el final del CI por privacidad
  const ci = ticket.passenger_ci;
  const maskedCi = "•".repeat(Math.max(0, ci.length - 3)) + ci.slice(-3);

  return (
    <main className="mx-auto max-w-md p-4">
      <div className="rounded-lg border-2 border-green-600 p-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Pasaje confirmado
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {ticket.origin} → {ticket.destination}
        </h1>
        <p className="text-gray-600">{ticket.company}</p>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Código QR de tu pasaje" className="mx-auto my-4 h-60 w-60" />

        <p className="font-mono text-2xl font-bold tracking-widest">{ticket.ticket_code}</p>

        <div className="mt-4 space-y-1 text-left">
          <p>
            Salida:{" "}
            <strong>
              {new Date(ticket.departs_at).toLocaleString("es-BO", {
                timeZone: "America/La_Paz",
                dateStyle: "full",
                timeStyle: "short",
              })}
            </strong>
          </p>
          <p>Asiento: <strong>{ticket.seat_label}</strong></p>
          <p>Pasajero: <strong>{ticket.passenger_name}</strong></p>
          <p>CI: {maskedCi}</p>
          <p>Precio: Bs {(ticket.price_cents / 100).toFixed(2)}</p>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-gray-600">
        Muestra este QR al abordar. Lleva también tu carnet de identidad.
      </p>
    </main>
  );
}