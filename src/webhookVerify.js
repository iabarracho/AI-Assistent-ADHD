import crypto from "node:crypto";

/**
 * Verifica X-Hub-Signature-256 do webhook da Meta (App Secret).
 * @param {Buffer} rawBody corpo bruto do POST
 * @param {string | string[] | undefined} signatureHeader cabeçalho x-hub-signature-256
 * @param {string | undefined} appSecret WHATSAPP_APP_SECRET
 * @returns {boolean}
 */
export function verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return true;
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!header || typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const receivedHex = header.slice("sha256=".length);
  const expectedHex = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHex, "hex"), Buffer.from(expectedHex, "hex"));
  } catch {
    return false;
  }
}
