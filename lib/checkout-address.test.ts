import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NATIVE_SELECT_CLASS,
  addressAfterCountryChange,
  deliveryLabels,
  normalizeCountryCode,
  regionError,
  stateIsRequired,
  wooAddressFields,
} from "./checkout-address.ts";

const usStates = [
  { code: "CA", name: "California" },
  { code: "NY", name: "New York" },
];
const gbCounties = [
  { code: "LND", name: "London" },
  { code: "BKM", name: "Buckinghamshire" },
];
const ieCounties = [{ code: "D", name: "Dublin" }];
const caProvinces = [{ code: "ON", name: "Ontario" }];
const auStates = [{ code: "NSW", name: "New South Wales" }];

describe("checkout country selection", () => {
  it("normalizes shopper-facing country names to ISO codes", () => {
    assert.equal(normalizeCountryCode("uk"), "GB");
    assert.equal(normalizeCountryCode("United Kingdom"), "GB");
    assert.equal(normalizeCountryCode("GB"), "GB");
    assert.equal(normalizeCountryCode("usa"), "US");
    assert.equal(normalizeCountryCode("United States"), "US");
    assert.equal(normalizeCountryCode("de"), "DE");
  });

  it("does not require a region when the country has no state list", () => {
    for (const country of ["DE", "FR", "NL", "SE", "JP"]) {
      assert.equal(stateIsRequired(country, 0), false);
      assert.equal(regionError(country, "", []), "");
    }
  });

  it("lets a UK address through without a county", () => {
    for (const country of ["GB", "UK", "United Kingdom"]) {
      assert.equal(stateIsRequired(country, gbCounties.length), false);
      assert.equal(regionError(country, "", gbCounties), "");
    }
    assert.equal(deliveryLabels("UK").region, "County (optional)");
    assert.equal(deliveryLabels("GB").postcode, "Postcode");
  });

  it("lets an Irish address through without a county", () => {
    assert.equal(stateIsRequired("IE", ieCounties.length), false);
    assert.equal(regionError("IE", "", ieCounties), "");
  });

  it("requires a listed state for countries whose locale requires one", () => {
    const cases = [
      ["US", usStates],
      ["USA", usStates],
      ["CA", caProvinces],
      ["AU", auStates],
    ] as const;
    for (const [country, states] of cases) {
      assert.equal(stateIsRequired(country, states.length), true);
      assert.equal(regionError(country, "", [...states]), "State is required.");
      assert.equal(regionError(country, "NOT-A-STATE", [...states]), "State is required.");
      assert.equal(regionError(country, states[0].code, [...states]), "");
    }
    assert.equal(deliveryLabels("US").postcode, "ZIP code");
    assert.equal(deliveryLabels("CA").region, "State / Province");
  });

  it("clears the previous region when the country changes", () => {
    const toUk = addressAfterCountryChange(
      { country: "US", state: "CA", city: "London" },
      "UK",
    );
    assert.deepEqual(toUk, { country: "GB", state: "", city: "London" });

    const toUs = addressAfterCountryChange(
      { country: "GB", state: "LND", city: "London" },
      "United States",
    );
    assert.deepEqual(toUs, { country: "US", state: "", city: "London" });

    const toGermany = addressAfterCountryChange(
      { country: "US", state: "CA", city: "Berlin" },
      "de",
    );
    assert.deepEqual(toGermany, { country: "DE", state: "", city: "Berlin" });
  });

  it("sends Woo an ISO country and an uppercase UK postcode", () => {
    assert.deepEqual(
      wooAddressFields({ country: "UK", state: "", postcode: " sw1a 1aa " }),
      { country: "GB", state: "", postcode: "SW1A 1AA" },
    );
    assert.deepEqual(
      wooAddressFields({ country: "US", state: "CA", postcode: " 94110 " }),
      { country: "US", state: "CA", postcode: "94110" },
    );
  });

  it("keeps native country menus on a light color scheme", () => {
    assert.equal(NATIVE_SELECT_CLASS, "[color-scheme:light]");
  });
});
