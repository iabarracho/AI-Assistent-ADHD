import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { verifyMetaWebhookSignature } from "../src/webhookVerify.js";

test("webhook signature skipped when no app secret", () => {
  assert.equal(verifyMetaWebhookSignature(Buffer.from("{}"), "sha256=ab", undefined), true);
  assert.equal(verifyMetaWebhookSignature(Buffer.from("{}"), undefined, ""), true);
});

test("webhook valid Meta signature passes", () => {
  const secret = "test_app_secret";
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const sig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyMetaWebhookSignature(body, sig, secret), true);
});

test("webhook wrong signature fails", () => {
  const secret = "test_app_secret";
  const body = Buffer.from("payload");
  assert.equal(
    verifyMetaWebhookSignature(body, "sha256=0000000000000000000000000000000000000000000000000000000000000000", secret),
    false
  );
});
