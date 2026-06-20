/**
 * Reads OCR text from a Thai bank transfer slip and pulls out an amount and
 * a category guess (from the slip's "memo" / "บันทึกช่วยจำ" field, if present).
 *
 * This is heuristic, not exact — slip layouts vary a lot between banks and
 * OCR quality varies with photo quality. If nothing usable is found, returns
 * null so the caller can ask the user to type the amount manually instead.
 */

const NOTE_KEYWORDS = ["บันทึกช่วยจำ", "หมายเหตุ", "ข้อความ", "memo", "note"];

function parseSlipText(text) {
  if (!text) return null;

  // Slip amounts are almost always written with 2 decimal places, e.g. "100.00 บาท".
  const amountMatch =
    text.match(/([\d,]+\.\d{2})\s*(?:บาท|THB|baht)/i) || text.match(/([\d,]+\.\d{2})/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let category = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matchedKeyword = NOTE_KEYWORDS.find((k) => line.toLowerCase().includes(k.toLowerCase()));
    if (matchedKeyword) {
      const sameLineRemainder = line.replace(new RegExp(matchedKeyword, "i"), "").trim();
      category = sameLineRemainder || (lines[i + 1] ? lines[i + 1].trim() : null);
      break;
    }
  }

  return {
    kind: "record",
    type: "expense",
    amount,
    category: category || "สลิปโอนเงิน",
    note: "",
  };
}

module.exports = { parseSlipText };
