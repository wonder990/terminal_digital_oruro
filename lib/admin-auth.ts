import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_token";

function expectedToken() {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return null;
  return createHmac("sha256", pin).update("admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function adminPinIsValid(input: string) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return false;
  return safeEqual(input, pin);
}

export async function isAdmin() {
  const expected = expectedToken();
  if (!expected) return false;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return !!token && safeEqual(token, expected);
}

export async function setAdminCookie() {
  const expected = expectedToken();
  if (!expected) return;
  const store = await cookies();
  store.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/admin", maxAge: 0 });
}