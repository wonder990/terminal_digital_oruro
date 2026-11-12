import {
  pgTable, uuid, text, integer, timestamp, jsonb, unique, index, bigserial,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
});

export const departures = pgTable("departures", {
  id: uuid("id").primaryKey().defaultRandom(),
  routeId: uuid("route_id").notNull().references(() => routes.id),
  departsAt: timestamp("departs_at", { withTimezone: true }).notNull(),
  priceCents: integer("price_cents").notNull(),
  appSeatQuota: integer("app_seat_quota").notNull(),
  releaseHoursBefore: integer("release_hours_before").notNull().default(2),
  status: text("status").notNull().default("open"), // open | closed | cancelled
});

export const departureSeats = pgTable(
  "departure_seats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    departureId: uuid("departure_id").notNull().references(() => departures.id),
    seatLabel: text("seat_label").notNull(),
    status: text("status").notNull().default("available"), // available | held | sold
    heldBy: uuid("held_by"),
    heldUntil: timestamp("held_until", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.departureId, t.seatLabel),
    index().on(t.departureId, t.status),
  ]
);

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  seatId: uuid("seat_id").notNull().references(() => departureSeats.id),
  groupId: uuid("group_id"),
  passengerName: text("passenger_name").notNull(),
  passengerCi: text("passenger_ci").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull().default("pending"), // pending | paid | cancelled | refunded
  ticketCode: text("ticket_code").unique(),
  boardedAt: timestamp("boarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed | refunded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.provider, t.eventId)]
);

export const rateEvents = pgTable(
  "rate_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.key, t.createdAt)]
);