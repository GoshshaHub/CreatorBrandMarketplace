import { crmSha256 } from "./canonical";

export const COMMERCIAL_OFFER_CATALOG_VERSION = "goshsha-commercial-offers-v1" as const;

export const COMMERCIAL_OFFER_CATALOG_BODY = {
  version: COMMERCIAL_OFFER_CATALOG_VERSION,
  offers: [
    { id: "free-first-irl-campaign", name: "Free First IRL Campaign", priceUsd: 0, billing: "one_time", revenueEligible: false, terms: { eligibleBrandAccounts: 1, contentRights: "Brand-owned or properly licensed", products: 1, originalUploadedMp4Videos: 1, activationDays: 30, qualifiedViews: 250 } },
    { id: "irl-retail-media-product-2", name: "IRL Retail Media / Product 2", priceUsd: 99, billing: "per_activation", revenueEligible: true, terms: { products: 1, videos: 1, activationDays: 90, qualifiedViews: 1000 } },
    { id: "creator-network", name: "Creator Network", priceUsd: 75, billing: "monthly_after_trial", revenueEligible: true, terms: { trialDays: 14, cardRequired: true } },
  ],
} as const;

export const COMMERCIAL_OFFER_CATALOG_SHA256 = crmSha256(COMMERCIAL_OFFER_CATALOG_BODY);

export function getCommercialOfferCatalog() {
  return { ...COMMERCIAL_OFFER_CATALOG_BODY, sha256: COMMERCIAL_OFFER_CATALOG_SHA256 };
}

export function commercialOfferIdForSalesSelection(value: string): string | null {
  if (value === "Free First") return "free-first-irl-campaign";
  if (value === "IRL Retail Media") return "irl-retail-media-product-2";
  if (value === "Creator Network") return "creator-network";
  return null;
}
