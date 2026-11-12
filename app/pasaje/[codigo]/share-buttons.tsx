"use client";

export default function ShareButtons({ summary }: { summary: string }) {
  function sendToWhatsApp() {
    // La dirección de esta misma página es el enlace del pasaje
    const text = `${summary}\n${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <button
      type="button"
      onClick={sendToWhatsApp}
      className="w-full rounded bg-green-600 p-3 font-semibold text-white"
    >
      Enviar a mi WhatsApp
    </button>
  );
}