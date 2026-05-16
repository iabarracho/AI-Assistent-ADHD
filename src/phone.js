/**
 * Identificadores só para exemplos, testes e `/dev`.
 * Prefixo NANP **555-01xx** é reservado a números fictícios (documentação / cinema) — não atribuir a clientes.
 * @see https://www.nationalnanpa.com/enas/nationalPoolingVsNonPoolingNumbers.aspx (bloco 555-01XX)
 */
export const PLACEHOLDER_WA_ID = "15550100001";
export const PLACEHOLDER_WA_ID_2 = "15550100002";

/**
 * WhatsApp Cloud API expects "to" as digits only, country code included, no + prefix.
 */
export function normalizeWaPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const trimmed = digits.startsWith("00") ? digits.slice(2) : digits;
  if (trimmed.length < 8 || trimmed.length > 15) return null;
  return trimmed;
}
