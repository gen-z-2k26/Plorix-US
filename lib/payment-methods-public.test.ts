import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicPaymentMethods } from "./payment-methods-public.ts";

describe("public payment methods", () => {
  it("lists every option, marking the ones the checkout has on", () => {
    const list = publicPaymentMethods([{ kind: "stripe" }, { kind: "afterpay" }]);
    assert.deepEqual(list, [
      { kind: "paypal", title: "PayPal", enabled: false },
      { kind: "stripe", title: "Card", enabled: true },
      { kind: "reign", title: "Card", enabled: false },
      { kind: "affirm", title: "Affirm", enabled: false },
      { kind: "afterpay", title: "Afterpay", enabled: true },
    ]);
  });

  it("marks everything off when nothing is enabled", () => {
    assert.ok(publicPaymentMethods([]).every((method) => !method.enabled));
  });

  it("carries nothing but a kind, a name and a flag", () => {
    const [first] = publicPaymentMethods([
      { kind: "paypal", secret: "x", wooId: "paypal" } as never,
    ]);
    assert.deepEqual(Object.keys(first ?? {}).sort(), ["enabled", "kind", "title"]);
  });
});
