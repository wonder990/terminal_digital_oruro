"use client";

import { useEffect, useRef, useState } from "react";
import { boardAction, unboardAction } from "../actions";

type Passenger = { code: string; name: string; ci: string; seat: string; boarded: boolean };

type Result =
  | { status: "ok"; name: string; ci: string; seat: string }
  | { status: "already"; name: string; seat: string; at: string }
  | { status: "wrong_departure"; origin: string; destination: string; at: string }
  | { status: "invalid" }
  | { status: "unauthorized" };

export default function BoardingPanel({
  departureId,
  initialPassengers,
}: {
  departureId: string;
  initialPassengers: Passenger[];
}) {
  const [passengers, setPassengers] = useState(initialPassengers);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const handlerRef = useRef<(text: string) => void>(() => {});

  async function board(raw: string) {
    const code = raw.trim().toUpperCase();
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = (await boardAction(code, departureId)) as Result;
      setResult(res);
      if (res.status === "ok" || res.status === "already") {
        setPassengers((list) => list.map((p) => (p.code === code ? { ...p, boarded: true } : p)));
      }
      navigator.vibrate?.(res.status === "ok" ? 100 : [200, 100, 200]);
    } finally {
      busyRef.current = false;
    }
  }


  async function undo(code: string) {
    if (busyRef.current) return;
    if (!window.confirm("¿Quitar la marca de abordaje de este pasajero?")) return;
    busyRef.current = true;
    try {
      const res = await unboardAction(code, departureId);
      if (res.ok) {
        setPassengers((list) => list.map((p) => (p.code === code ? { ...p, boarded: false } : p)));
        setResult(null);
        // Permite volver a escanear ese mismo QR enseguida
        lastRef.current = { code: "", time: 0 };
      }
    } finally {
      busyRef.current = false;
    }
  }


  function handleScan(text: string) {
    const code = text.trim().toUpperCase();
    const now = Date.now();
    // Ignora el mismo QR si se lee otra vez dentro de 3 segundos
    if (lastRef.current.code === code && now - lastRef.current.time < 3000) return;
    lastRef.current = { code, time: now };
    board(code);
  }

  useEffect(() => {
    handlerRef.current = handleScan;
  });

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let started = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode("qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => handlerRef.current(text),
          () => {}
        );
        started = true;
        // Si se pidió apagar la cámara mientras arrancaba, se apaga ahora
        if (cancelled) {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            // ya estaba detenida
          }
        }
      } catch {
        if (!cancelled) {
          setCamError("No se pudo abrir la cámara. Revisa el permiso o usa la lista de pasajeros.");
          setScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scanner && started) {
        try {
          scanner.stop().then(() => scanner?.clear()).catch(() => {});
        } catch {
          // la librería puede lanzar el error de forma directa
        }
      }
    };
  }, [scanning]);

  const boardedCount = passengers.filter((p) => p.boarded).length;
  const q = filter.trim().toLowerCase();
  const visible = q
    ? passengers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.ci.toLowerCase().includes(q) ||
          p.seat.toLowerCase() === q
      )
    : passengers;

  return (
    <div>
      <p className="mb-3 text-lg">
        Abordaron <strong>{boardedCount}</strong> de <strong>{passengers.length}</strong>
      </p>

      <button
        type="button"
        onClick={() => {
          setCamError(null);
          setScanning((s) => !s);
        }}
        className={`w-full rounded p-3 font-semibold text-white ${scanning ? "bg-gray-700" : "bg-blue-600"}`}
      >
        {scanning ? "Detener cámara" : "Escanear QR"}
      </button>

      {camError && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">{camError}</p>}
      {scanning && <div id="qr-reader" className="mt-3 overflow-hidden rounded" />}

      {result && (
        <div
          className={`mt-4 rounded-lg border-2 p-4 ${
            result.status === "ok"
              ? "border-green-600 bg-green-50"
              : result.status === "already"
              ? "border-yellow-500 bg-yellow-50"
              : "border-red-600 bg-red-50"
          }`}
        >
          {result.status === "ok" && (
            <>
              <p className="text-xl font-bold text-green-800">✅ Pasaje válido</p>
              <p className="text-lg">{result.name}</p>
              <p>Asiento <strong>{result.seat}</strong> · CI <strong>{result.ci}</strong></p>
              <p className="text-sm text-gray-700">Verifica que el carnet coincida.</p>
            </>
          )}
          {result.status === "already" && (
            <>
              <p className="text-xl font-bold text-yellow-800">⚠️ Ya abordó</p>
              <p className="text-lg">{result.name} · Asiento {result.seat}</p>
              <p className="text-sm">
                Registrado a las{" "}
                {new Date(result.at).toLocaleTimeString("es-BO", {
                  timeZone: "America/La_Paz",
                  timeStyle: "short",
                })}
              </p>
            </>
          )}
          {result.status === "wrong_departure" && (
            <>
              <p className="text-xl font-bold text-red-800">❌ Pasaje de otra salida</p>
              <p>
                Este pasaje es para {result.origin} → {result.destination},{" "}
                {new Date(result.at).toLocaleString("es-BO", {
                  timeZone: "America/La_Paz",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </>
          )}
          {result.status === "invalid" && (
            <p className="text-xl font-bold text-red-800">❌ Pasaje no válido</p>
          )}
          {result.status === "unauthorized" && (
            <p className="text-xl font-bold text-red-800">
              Tu sesión venció. Vuelve a entrar con la clave.
            </p>
          )}
        </div>
      )}

      <h2 className="mb-2 mt-6 text-lg font-semibold">Lista de pasajeros</h2>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar por nombre, CI o asiento"
        className="mb-3 w-full rounded border p-2"
      />

      {visible.length === 0 && <p className="text-gray-600">Sin resultados.</p>}

      <ul className="space-y-2">
        {visible.map((p) => (
          <li key={p.code} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-semibold">Asiento {p.seat} · {p.name}</p>
              <p className="text-sm text-gray-600">CI {p.ci}</p>
            </div>
            {p.boarded ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-green-700">Abordó</span>
                <button
                  type="button"
                  onClick={() => undo(p.code)}
                  className="text-sm text-red-700 underline"
                >
                  Deshacer
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => board(p.code)}
                className="rounded bg-green-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Marcar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}