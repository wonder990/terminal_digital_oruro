import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { getTicketByCode } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

const CODE = /^[A-HJ-NP-Z2-9]{10}$/;
const TZ = "America/La_Paz";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const code = codigo.toUpperCase();
  if (!CODE.test(code)) return new Response("No encontrado", { status: 404 });

  const ticket = await getTicketByCode(code);
  if (!ticket) return new Response("No encontrado", { status: 404 });

  const qr = await QRCode.toDataURL(ticket.ticket_code, { width: 420, margin: 2 });

  const dep = new Date(ticket.departs_at);
  const boardBy = new Date(dep.getTime() - 30 * 60 * 1000);
  const dateText = dep.toLocaleDateString("es-BO", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long",
  });
  const hour = (d: Date) =>
    d.toLocaleTimeString("es-BO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

  const ci = ticket.passenger_ci;
  const maskedCi = "*".repeat(Math.max(0, ci.length - 3)) + ci.slice(-3);

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid #e5e7eb" }}>
      <div style={{ display: "flex", fontSize: 26, color: "#6b7280" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#ffffff" }}>
        <div style={{ display: "flex", flexDirection: "column", background: "#15803d", color: "#ffffff", padding: "28px 40px" }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 3 }}>PASAJE CONFIRMADO</div>
          <div style={{ display: "flex", fontSize: 30, marginTop: 6 }}>{ticket.company}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "30px 40px 0 40px" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "#111827" }}>
            {ticket.origin} a {ticket.destination}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#374151", marginTop: 8 }}>
            {dateText} - {hour(dep)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 20 }}>
            {row("Llegar a las", hour(boardBy))}
            {row("Asiento", ticket.seat_label)}
            {row("Pasajero", ticket.passenger_name)}
            {row("CI", maskedCi)}
            {row("Precio", `Bs ${(ticket.price_cents / 100).toFixed(2)}`)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={380} height={380} alt="QR" />
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: 8, marginTop: 8 }}>
            {ticket.ticket_code}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#6b7280", marginTop: 14 }}>
            Muestra este QR al abordar y lleva tu carnet
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 1400,
      headers: {
        "Content-Disposition": `attachment; filename="pasaje-${ticket.ticket_code}.png"`,
        "Cache-Control": "private, no-store",
      },
    }
  );
}