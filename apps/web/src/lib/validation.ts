// Input validation (zod). Rejects malformed protocol strings before any API call.

import { z } from "zod";

export const DISCOUNT_MIN = 0;
export const DISCOUNT_MAX = 40;
export const DISCOUNT_STEP = 0.1;

const moneyNet = z
  .string()
  .regex(/^\d{1,12}\.\d{2}$/, "Usa el formato 1234.56 (punto decimal, dos decimales)");

export const rivalPriceSchema = moneyNet;

export const discountPercentSchema = z
  .number({ error: "La baja debe ser un número" })
  .min(DISCOUNT_MIN, "La baja mínima es 0 %")
  .max(DISCOUNT_MAX, "La baja máxima es 40 %");

export const scenarioNameSchema = z
  .string()
  .trim()
  .min(1, "El escenario necesita un nombre")
  .max(200, "Máximo 200 caracteres");

export const reportNoteSchema = z.string().max(4000, "Máximo 4000 caracteres");
