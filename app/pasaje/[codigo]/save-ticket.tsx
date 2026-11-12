"use client";

import { useEffect } from "react";

type Saved = { code: string; route: string; departsAt: string };

export default function SaveTicket({ code, route, departsAt }: Saved) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mis_pasajes");
      const list: Saved[] = raw ? JSON.parse(raw) : [];
      if (!list.some((t) => t.code === code)) {
        list.unshift({ code, route, departsAt });
        localStorage.setItem("mis_pasajes", JSON.stringify(list.slice(0, 20)));
      }
    } catch {
      // Si el navegador bloquea el almacenamiento, no pasa nada
    }
  }, [code, route, departsAt]);

  return null;
}