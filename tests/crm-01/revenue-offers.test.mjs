import assert from "node:assert/strict";
import test from "node:test";
import { COMMERCIAL_OFFER_CATALOG_BODY, COMMERCIAL_OFFER_CATALOG_SHA256, COMMERCIAL_OFFER_CATALOG_VERSION, getCommercialOfferCatalog } from "../../lib/agents/crm-01/commercial-offers.ts";
import { crmSha256 } from "../../lib/agents/crm-01/canonical.ts";

test("commercial offer catalog has deterministic identity and exact approved terms", () => {
  assert.equal(COMMERCIAL_OFFER_CATALOG_VERSION, "goshsha-commercial-offers-v1");
  assert.equal(COMMERCIAL_OFFER_CATALOG_SHA256, crmSha256(COMMERCIAL_OFFER_CATALOG_BODY));
  assert.equal(getCommercialOfferCatalog().sha256, COMMERCIAL_OFFER_CATALOG_SHA256);
  const [free, product2, network] = COMMERCIAL_OFFER_CATALOG_BODY.offers;
  assert.deepEqual(free, { id:"free-first-irl-campaign", name:"Free First IRL Campaign", priceUsd:0, billing:"one_time", revenueEligible:false, terms:{ eligibleBrandAccounts:1, contentRights:"Brand-owned or properly licensed", products:1, originalUploadedMp4Videos:1, activationDays:30, qualifiedViews:250 } });
  assert.equal(product2.id, "irl-retail-media-product-2"); assert.equal(product2.priceUsd, 99); assert.equal(product2.terms.activationDays, 90); assert.equal(product2.terms.qualifiedViews, 1000);
  assert.equal(network.id, "creator-network"); assert.equal(network.priceUsd, 75); assert.equal(network.terms.trialDays, 14); assert.equal(network.terms.cardRequired, true);
});

test("one-byte-equivalent material catalog change changes the catalog identity", () => {
  const changed=structuredClone(COMMERCIAL_OFFER_CATALOG_BODY);changed.offers[1].priceUsd=98;
  assert.notEqual(crmSha256(changed), COMMERCIAL_OFFER_CATALOG_SHA256);
});
