"use client";

import type { ReactNode } from "react";
import type { Deck, Kind } from "@/lib/bus-layout";

export default function BusView({
  decks,
  renderSeat,
}: {
  decks: Deck[];
  renderSeat: (label: string, kind: Kind) => ReactNode;
}) {
  return (
    <div>
      {decks.map((deck, di) => (
        <div key={di} className="mb-5">
          {deck.name && <p className="mb-2 font-semibold">{deck.name}</p>}
          <div className="rounded-t-3xl rounded-b-lg border-2 border-gray-400 bg-gray-50 p-2">
            <div className="mb-2 flex justify-between px-2 text-xs text-gray-500">
              <span>Chofer</span>
              <span>Frente ↑</span>
            </div>
            {/* Las franjas celestes de los costados son las ventanas */}
            <div className="space-y-2 border-x-[10px] border-sky-200 bg-white px-2 py-3">
              {deck.rows.map((row, ri) => (
                <div key={ri} className="grid gap-2" style={{ gridTemplateColumns: deck.columns }}>
                  {row.map((cell, ci) =>
                    cell.type === "seat" ? (
                      <div key={ci}>{renderSeat(cell.label, cell.kind)}</div>
                    ) : (
                      <div key={ci} />
                    )
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">Atrás</p>
          </div>
        </div>
      ))}
    </div>
  );
}