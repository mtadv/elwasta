// src/lib/pricing/jobPricing.ts

export type PricingTier = "junior" | "mid" | "senior";

export type PricingResult = {
  tier: PricingTier;
  price: number;
  yearsRange: string;
};

export function resolveJobPricing(
  yearsExperienceRaw: string
): PricingResult {
  const cleaned = yearsExperienceRaw.replace(/\s/g, "");

  let maxYears: number;

  if (cleaned.includes("+")) {
    maxYears = parseInt(cleaned.replace("+", ""), 10);
  } else if (cleaned.includes("-")) {
    const [, max] = cleaned.split("-");
    maxYears = parseInt(max, 10);
  } else {
    maxYears = parseInt(cleaned, 10);
  }

  if (maxYears <= 5) {
    return {
      tier: "junior",
      price: 100,
      yearsRange: yearsExperienceRaw,
    };
  }

  if (maxYears <= 9) {
    return {
      tier: "mid",
      price: 150,
      yearsRange: yearsExperienceRaw,
    };
  }

  return {
    tier: "senior",
    price: 250,
    yearsRange: yearsExperienceRaw,
  };
}
