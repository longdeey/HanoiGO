import { z } from "zod";

export const MAX_BUDGET = 1_000_000_000;

export const tripSchema = z.object({
  language: z.enum(["en", "vi"]),
  // Optional (README): with a date, the trip lists holidays and dated events.
  startDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid travel date")
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
    }, "Choose a valid travel date")]),
  days: z.number().int().min(1, "Days must be at least 1").max(14, "Days cannot exceed 14"),
  travelerCount: z.number().int().min(1, "People must be at least 1").max(20, "People cannot exceed 20"),
  // The API stores the budget as a 32-bit integer; keep well inside it.
  budgetTotal: z.number().int().positive("Budget must be greater than 0").max(MAX_BUDGET, "Budget cannot exceed 1,000,000,000 VND"),
  startLocationName: z.string().trim().min(3, "Enter a Hanoi address or place name"),
  startLocationCoordinates: z.object({
    latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  }).optional(),
  interests: z.array(z.string()).min(1, "Choose at least one interest"),
  travelMode: z.enum(["walking", "motorbike", "car"]),
  travelRadiusMode: z.enum(["near", "balanced", "wide", "outskirts"]),
  pace: z.enum(["relaxed", "balanced", "active"]),
  experiencePreferences: z.array(z.string()),
  dailyStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time such as 08:00"),
  dailyEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time such as 08:00"),
}).refine((value) => value.dailyEndTime > value.dailyStartTime, {
  message: "End time must be after start time", path: ["dailyEndTime"],
});

export type TripFormValues = z.infer<typeof tripSchema>;
