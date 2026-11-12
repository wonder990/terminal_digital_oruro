import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "staff_token";

function expectedToken() {
  const pin = process.env.STAFF_PIN;
  if (!pin) return null;
  return createHmac("sha256", pin).update("abordaje-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function pinIsValid(input: string) {
  const pin = process.env.STAFF_PIN;
  if (!pin) return false;
  return safeEqual(input, pin);
}

export async function isStaff() {
  const expected = expectedToken();
  if (!expected) return false;
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return !!token && safeEqual(token, expected);
}

export async function setStaffCookie() {
  const expected = expectedToken();
  if (!expected) return;
  const store = await cookies();
  store.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/abordaje",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/abordaje", maxAge: 0 });
}