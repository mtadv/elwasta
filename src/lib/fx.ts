/**
 * Internal FX configuration
 * -------------------------
 * We keep business pricing in USD
 * and convert to EGP only at payment time.
 *
 * This is a FIXED internal rate for MVP.
 * Change this value only when you decide to update pricing.
 */

export const INTERNAL_USD_EGP_RATE = 50;

/**
 * Convert USD to EGP using internal fixed rate
 *
 * @param usdAmount - amount in USD
 * @returns amount in EGP (rounded to integer)
 */
export function usdToEgp(usdAmount: number): number {
  if (usdAmount <= 0 || Number.isNaN(usdAmount)) {
    throw new Error("Invalid USD amount");
  }

  return Math.round(usdAmount * INTERNAL_USD_EGP_RATE);
}

/**
 * Convert USD to EGP cents (Paymob format)
 *
 * @param usdAmount - amount in USD
 * @returns amount in EGP cents (integer)
 */
export function usdToEgpCents(usdAmount: number): number {
  const egpAmount = usdToEgp(usdAmount);
  return egpAmount * 100;
}
