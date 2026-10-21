import { z } from "zod";
import { isValidTimeStr } from "./lib/time.js";

export const ROLES = ["PATIENT", "CHEMIST", "CAREGIVER"] as const;
export const DOSE_STATUSES = ["PENDING", "TAKEN", "SKIPPED"] as const;
export const REFILL_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "READY",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export const MEDICATION_STATUSES = ["ACTIVE", "PAUSED", "ENDED"] as const;
export const FREQUENCIES = [
  "ONCE_DAILY",
  "TWICE_DAILY",
  "THREE_TIMES_DAILY",
  "FOUR_TIMES_DAILY",
  "CUSTOM",
] as const;

const frequencyTimes: Record<string, number> = {
  ONCE_DAILY: 1,
  TWICE_DAILY: 2,
  THREE_TIMES_DAILY: 3,
  FOUR_TIMES_DAILY: 4,
};

const timeStr = z
  .string()
  .refine(isValidTimeStr, { message: "Time must be in 24h HH:mm format." });

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be YYYY-MM-DD." });

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().toLowerCase().email("Valid email required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128),
  phone: z.string().trim().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required."),
});

const medicationObject = z
  .object({
    name: z.string().trim().min(2, "Medication name is required.").max(120),
    doseAmount: z
      .number({ invalid_type_error: "Dose must be a number." })
      .positive("Dose must be greater than zero.")
      .max(100000),
    doseUnit: z.string().trim().min(1, "Dose unit is required.").max(24),
    quantityPerDose: z
      .number()
      .positive("Units consumed per dose must be greater than zero.")
      .max(10000)
      .default(1),
    quantityUnit: z.string().trim().min(1, "Quantity unit is required.").max(24),
    frequency: z.enum(FREQUENCIES, {
      errorMap: () => ({ message: "Choose a valid frequency." }),
    }),
    times: z
      .array(timeStr)
      .min(1, "At least one scheduled time is required.")
      .max(8, "Maximum 8 scheduled times per day."),
    currentQuantity: z
      .number({ invalid_type_error: "Quantity must be a number." })
      .nonnegative("Quantity cannot be negative.")
      .max(10000000),
    refillThreshold: z
      .number()
      .nonnegative("Threshold cannot be negative.")
      .max(10000000),
    startDate: dateStr,
    endDate: dateStr.nullable().optional(),
    chemistShopId: z.string().trim().optional().nullable(),
    status: z.enum(MEDICATION_STATUSES).optional(),
  });

/** Full validation for medication creation (cross-field rules included). */
export const medicationSchema = medicationObject.superRefine((val, ctx) => {
  const expected = frequencyTimes[val.frequency];
  if (expected && val.times.length !== expected) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["times"],
      message: `${val.frequency
        .toLowerCase()
        .replace(/_/g, " ")} requires exactly ${expected} scheduled time(s).`,
    });
  }
  if (new Set(val.times).size !== val.times.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["times"],
      message: "Scheduled times must be unique.",
    });
  }
  if (val.endDate && val.endDate < val.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after the start date.",
    });
  }
  if (val.refillThreshold > val.currentQuantity * 1000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["refillThreshold"],
      message: "Refill threshold looks unrealistic relative to stock.",
    });
  }
});

/**
 * Updates accept partial input; the service merges with existing values and
 * re-validates the merged result with `medicationSchema`.
 */
export const medicationUpdateSchema = medicationObject.partial();

export const doseActionSchema = z.object({
  action: z.enum(["TAKEN", "SKIPPED", "SNOOZE"], {
    errorMap: () => ({ message: "Action must be TAKEN, SKIPPED or SNOOZE." }),
  }),
  snoozeMinutes: z.number().int().min(1).max(240).optional(),
});

export const refillRequestSchema = z.object({
  medicationId: z.string().min(1),
  quantityRequested: z.number().positive().max(10000000).optional(),
  patientNote: z.string().trim().max(500).optional(),
});

export const refillStatusSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT", "READY", "COMPLETE", "CANCEL"], {
    errorMap: () => ({ message: "Invalid refill action." }),
  }),
  quantitySupplied: z.number().positive().max(10000000).optional(),
  rejectReason: z.string().trim().max(300).optional(),
});

export const caregiverInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid caregiver email required."),
  shareAdherence: z.boolean().default(true),
  shareMissed: z.boolean().default(true),
  shareUpcoming: z.boolean().default(true),
  shareRefills: z.boolean().default(true),
  shareInventory: z.boolean().default(false),
});

export const caregiverScopeSchema = z.object({
  shareAdherence: z.boolean(),
  shareMissed: z.boolean(),
  shareUpcoming: z.boolean(),
  shareRefills: z.boolean(),
  shareInventory: z.boolean(),
});

export const linkChemistSchema = z.object({
  chemistShopId: z.string().min(1, "Choose a chemist shop."),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
