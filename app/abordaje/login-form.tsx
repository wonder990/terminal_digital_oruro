"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "./actions";

export default function LoginForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginAction(pin);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        Clave del personal
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="off"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Verificando..." : "Entrar"}
      </button>
    </form>
  );
}