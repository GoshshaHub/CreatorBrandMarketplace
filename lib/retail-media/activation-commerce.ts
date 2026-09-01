export type RetailMediaProduct =
  | "product_1"
  | "product_2"
  | "enterprise";

export type RetailMediaPurchaseType =
  | "included_monthly_credit"
  | "product_1_additional"
  | "product_2_single"
  | "product_2_pack"
  | "enterprise_custom";

export type RetailMediaPaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type RetailMediaCreditStatus =
  | "available"
  | "reserved"
  | "consumed"
  | "expired"
  | "cancelled";

export type RetailMediaUsageStatus =
  | "not_started"
  | "included_usage"
  | "overage"
  | "completed";

export type RetailMediaPackSize =
  | 1
  | 5
  | 10
  | 25
  | 50;

export type RetailMediaPricingTier = {
  minQualifiedViews: number;
  maxQualifiedViews?: number | null;
  pricePerAdditionalView?: number | null;
  customPricing?: boolean;
};

export type RetailMediaActivationEntitlement = {
  videosIncluded: number;
  productsIncluded: number;
  activationDays: number;
  includedQualifiedViews: number;

  analyticsLevel:
    | "basic"
    | "advanced"
    | "enterprise";
};

export type RetailMediaPurchaseDefinition = {
  product: RetailMediaProduct;

  purchaseType:
    RetailMediaPurchaseType;

  label: string;

  amountUsd?: number | null;

  activationCredits: number;

  entitlement:
    RetailMediaActivationEntitlement;

  requiresPayment:
    boolean;

  customPricing:
    boolean;
};

export type RetailMediaActivationCommerceRecord = {
  commerceId: string;

  brandId: string;

  product:
    RetailMediaProduct;

  purchaseType:
    RetailMediaPurchaseType;

  purchaseDefinitionKey:
    RetailMediaPurchaseDefinitionKey;

  retailAssetId?: string | null;

  campaignId?: string | null;

  activationCreditId?: string | null;

  packPurchaseId?: string | null;

  paymentStatus:
    RetailMediaPaymentStatus;

  creditStatus:
    RetailMediaCreditStatus;

  usageStatus:
    RetailMediaUsageStatus;

  amountUsd?: number | null;

  currency:
    "USD";

  includedQualifiedViews:
    number;

  qualifiedViewsUsed:
    number;

  overageQualifiedViews:
    number;

  activationDays:
    number;

  startsAt?: unknown;
  endsAt?: unknown;

  stripeCheckoutSessionId?:
    string | null;

  stripePaymentIntentId?:
    string | null;

  stripeInvoiceId?:
    string | null;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailMediaActivationCredit = {
  creditId: string;

  brandId: string;

  product:
    RetailMediaProduct;

  source:
    RetailMediaPurchaseType;

  sourcePurchaseId?: string | null;

  status:
    RetailMediaCreditStatus;

  entitlement:
    RetailMediaActivationEntitlement;

  retailAssetId?: string | null;

  reservedAt?: unknown;
  consumedAt?: unknown;
  expiresAt?: unknown;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailMediaVolumePack = {
  packId: string;

  brandId: string;

  packSize:
    RetailMediaPackSize;

  purchaseDefinitionKey:
    RetailMediaPurchaseDefinitionKey;

  totalCredits:
    number;

  remainingCredits:
    number;

  amountUsd?: number | null;

  paymentStatus:
    RetailMediaPaymentStatus;

  stripeCheckoutSessionId?:
    string | null;

  stripePaymentIntentId?:
    string | null;

  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RetailMediaPurchaseDefinitionKey =
  | "product_1_monthly_credit"
  | "product_1_additional_activation"
  | "product_2_single_activation"
  | "product_2_pack_5"
  | "product_2_pack_10"
  | "product_2_pack_25"
  | "product_2_pack_50_plus"
  | "enterprise_custom";

const STANDARD_ENTITLEMENT:
  RetailMediaActivationEntitlement = {
  videosIncluded: 1,

  productsIncluded: 1,

  activationDays: 90,

  includedQualifiedViews:
    1000,

  analyticsLevel:
    "basic",
};

export const RETAIL_MEDIA_PURCHASE_DEFINITIONS:
  Record<
    RetailMediaPurchaseDefinitionKey,
    RetailMediaPurchaseDefinition
  > = {
  product_1_monthly_credit: {
    product:
      "product_1",

    purchaseType:
      "included_monthly_credit",

    label:
      "Product 1 Included Monthly Retail Media Activation",

    amountUsd:
      0,

    activationCredits:
      1,

    entitlement:
      STANDARD_ENTITLEMENT,

    requiresPayment:
      false,

    customPricing:
      false,
  },

  product_1_additional_activation: {
    product:
      "product_1",

    purchaseType:
      "product_1_additional",

    label:
      "Product 1 Additional Retail Media Activation",

    amountUsd:
      49,

    activationCredits:
      1,

    entitlement:
      STANDARD_ENTITLEMENT,

    requiresPayment:
      true,

    customPricing:
      false,
  },

  product_2_single_activation: {
  product:
    "product_2",

  purchaseType:
    "product_2_single",

  label:
    "IRL Retail Media Activation",

  amountUsd:
    1,

  activationCredits:
    1,

  entitlement:
    STANDARD_ENTITLEMENT,

  requiresPayment:
    true,

  customPricing:
    false,
},

product_2_pack_5: {
  product:
    "product_2",

  purchaseType:
    "product_2_pack",

  label:
    "5 IRL Retail Media Activations",

  amountUsd:
    449,

  activationCredits:
    5,

  entitlement:
    STANDARD_ENTITLEMENT,

  requiresPayment:
    true,

  customPricing:
    false,
},

product_2_pack_10: {
  product:
    "product_2",

  purchaseType:
    "product_2_pack",

  label:
    "10 IRL Retail Media Activations",

  amountUsd:
    799,

  activationCredits:
    10,

  entitlement:
    STANDARD_ENTITLEMENT,

  requiresPayment:
    true,

  customPricing:
    false,
},

product_2_pack_25: {
  product:
    "product_2",

  purchaseType:
    "product_2_pack",

  label:
    "25 IRL Retail Media Activations",

  amountUsd:
    1699,

  activationCredits:
    25,

  entitlement:
    STANDARD_ENTITLEMENT,

  requiresPayment:
    true,

  customPricing:
    false,
},

product_2_pack_50_plus: {
  product:
    "product_2",

  purchaseType:
    "product_2_pack",

  label:
    "IRL Retail Media — Enterprise Volume",

  amountUsd:
    null,

  activationCredits:
    50,

  entitlement:
    STANDARD_ENTITLEMENT,

  requiresPayment:
    true,

  customPricing:
    true,
},

  enterprise_custom: {
    product:
      "enterprise",

    purchaseType:
      "enterprise_custom",

    label:
      "Enterprise Retail Media Program",

    amountUsd:
      null,

    activationCredits:
      0,

    entitlement: {
      videosIncluded:
        0,

      productsIncluded:
        0,

      activationDays:
        90,

      includedQualifiedViews:
        0,

      analyticsLevel:
        "enterprise",
    },

    requiresPayment:
      true,

    customPricing:
      true,
  },
};

export const RETAIL_MEDIA_OVERAGE_TIERS:
  RetailMediaPricingTier[] = [
  {
    minQualifiedViews:
      1001,

    maxQualifiedViews:
      10000,

    pricePerAdditionalView:
      0.04,
  },

  {
    minQualifiedViews:
      10001,

    maxQualifiedViews:
      50000,

    pricePerAdditionalView:
      0.025,
  },

  {
    minQualifiedViews:
      50001,

    maxQualifiedViews:
      250000,

    pricePerAdditionalView:
      0.015,
  },

  {
    minQualifiedViews:
      250001,

    maxQualifiedViews:
      null,

    pricePerAdditionalView:
      null,

    customPricing:
      true,
  },
];

export function getRetailMediaPurchaseDefinition(
  key:
    RetailMediaPurchaseDefinitionKey
): RetailMediaPurchaseDefinition {
  const definition =
    RETAIL_MEDIA_PURCHASE_DEFINITIONS[
      key
    ];

  if (!definition) {
    throw new Error(
      "Retail Media purchase definition not found."
    );
  }

  return definition;
}

export function getProduct2PackDefinitionKey(
  packSize: RetailMediaPackSize
): RetailMediaPurchaseDefinitionKey {
  switch (packSize) {
    case 1:
      return "product_2_single_activation";

    case 5:
      return "product_2_pack_5";

    case 10:
      return "product_2_pack_10";

    case 25:
      return "product_2_pack_25";

    case 50:
      return "product_2_pack_50_plus";

    default:
      throw new Error(
        "Unsupported Product 2 activation pack size."
      );
  }
}

export function calculateProduct2Overage(
  totalQualifiedViews: number
): {
  includedQualifiedViews: number;

  overageQualifiedViews: number;

  estimatedOverageUsd:
    number | null;

  requiresCustomPricing:
    boolean;

  breakdown: {
    fromQualifiedView: number;

    toQualifiedView: number;

    billableViews: number;

    pricePerView:
      number | null;

    amountUsd:
      number | null;

    customPricing:
      boolean;
  }[];
} {
  const normalizedViews =
    Math.max(
      0,
      Math.floor(
        Number(
          totalQualifiedViews ||
            0
        )
      )
    );

  const includedQualifiedViews =
    STANDARD_ENTITLEMENT
      .includedQualifiedViews;

  const overageQualifiedViews =
    Math.max(
      0,
      normalizedViews -
        includedQualifiedViews
    );

  if (
    overageQualifiedViews ===
    0
  ) {
    return {
      includedQualifiedViews,

      overageQualifiedViews:
        0,

      estimatedOverageUsd:
        0,

      requiresCustomPricing:
        false,

      breakdown:
        [],
    };
  }

  let totalAmount =
    0;

  let requiresCustomPricing =
    false;

  const breakdown:
    {
      fromQualifiedView:
        number;

      toQualifiedView:
        number;

      billableViews:
        number;

      pricePerView:
        number | null;

      amountUsd:
        number | null;

      customPricing:
        boolean;
    }[] = [];

  for (
    const tier of
    RETAIL_MEDIA_OVERAGE_TIERS
  ) {
    const tierStart =
      tier.minQualifiedViews;

    const tierEnd =
      tier.maxQualifiedViews ??
      normalizedViews;

    if (
      normalizedViews <
      tierStart
    ) {
      continue;
    }

    const effectiveEnd =
      Math.min(
        normalizedViews,
        tierEnd
      );

    const billableViews =
      Math.max(
        0,
        effectiveEnd -
          tierStart +
          1
      );

    if (
      billableViews <=
      0
    ) {
      continue;
    }

    const customPricing =
      tier.customPricing ===
      true ||
      tier.pricePerAdditionalView ==
        null;

    const amountUsd =
      customPricing
        ? null
        : billableViews *
          Number(
            tier.pricePerAdditionalView
          );

    if (
      customPricing
    ) {
      requiresCustomPricing =
        true;
    } else {
      totalAmount +=
        amountUsd || 0;
    }

    breakdown.push({
      fromQualifiedView:
        tierStart,

      toQualifiedView:
        effectiveEnd,

      billableViews,

      pricePerView:
        tier.pricePerAdditionalView ??
        null,

      amountUsd,

      customPricing,
    });
  }

  return {
    includedQualifiedViews,

    overageQualifiedViews,

    estimatedOverageUsd:
      requiresCustomPricing
        ? null
        : Number(
            totalAmount.toFixed(
              2
            )
          ),

    requiresCustomPricing,

    breakdown,
  };
}

export function canConsumeActivationCredit(
  credit:
    RetailMediaActivationCredit
): boolean {
  return (
    credit.status ===
      "available" &&
    credit.entitlement
      .videosIncluded >
      0 &&
    credit.entitlement
      .productsIncluded >
      0
  );
}

export function createRetailMediaCommerceRecordDefaults(
  params: {
    commerceId: string;

    brandId: string;

    purchaseDefinitionKey:
      RetailMediaPurchaseDefinitionKey;

    retailAssetId?: string | null;

    campaignId?: string | null;

    activationCreditId?: string | null;

    packPurchaseId?: string | null;

    createdAt?: unknown;

    updatedAt?: unknown;
  }
): RetailMediaActivationCommerceRecord {
  const definition =
    getRetailMediaPurchaseDefinition(
      params.purchaseDefinitionKey
    );

  const paymentStatus:
    RetailMediaPaymentStatus =
    definition.requiresPayment
      ? "pending"
      : "not_required";

  return {
    commerceId:
      params.commerceId,

    brandId:
      params.brandId,

    product:
      definition.product,

    purchaseType:
      definition.purchaseType,

    purchaseDefinitionKey:
      params.purchaseDefinitionKey,

    retailAssetId:
      params.retailAssetId ??
      null,

    campaignId:
      params.campaignId ??
      null,

    activationCreditId:
      params.activationCreditId ??
      null,

    packPurchaseId:
      params.packPurchaseId ??
      null,

    paymentStatus,

    creditStatus:
      "available",

    usageStatus:
      "not_started",

    amountUsd:
      definition.amountUsd ??
      null,

    currency:
      "USD",

    includedQualifiedViews:
      definition.entitlement
        .includedQualifiedViews,

    qualifiedViewsUsed:
      0,

    overageQualifiedViews:
      0,

    activationDays:
      definition.entitlement
        .activationDays,

    createdAt:
      params.createdAt ??
        null,

    updatedAt:
      params.updatedAt ??
        null,
  };
}

export function createActivationCreditDefaults(
  params: {
    creditId: string;

    brandId: string;

    purchaseDefinitionKey:
      RetailMediaPurchaseDefinitionKey;

    sourcePurchaseId?: string | null;

    expiresAt?: unknown;

    createdAt?: unknown;

    updatedAt?: unknown;
  }
): RetailMediaActivationCredit {
  const definition =
    getRetailMediaPurchaseDefinition(
      params.purchaseDefinitionKey
    );

  if (
    definition.activationCredits <
    1
  ) {
    throw new Error(
      "This purchase definition does not create activation credits."
    );
  }

  return {
    creditId:
      params.creditId,

    brandId:
      params.brandId,

    product:
      definition.product,

    source:
      definition.purchaseType,

    sourcePurchaseId:
      params.sourcePurchaseId ??
      null,

    status:
      "available",

    entitlement: {
      ...definition.entitlement,
    },

    retailAssetId:
      null,

    expiresAt:
      params.expiresAt ??
        null,

    createdAt:
      params.createdAt ??
        null,

    updatedAt:
      params.updatedAt ??
        null,
  };
}