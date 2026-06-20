/**
 * Parses an incoming LINE text message into a structured command.
 *
 * Two layers of parsing:
 *   1. Strict patterns — exact syntax, supports a trailing note.
 *        จ่าย 150 อาหาร ก๋วยเตี๋ยว        -> record expense 150, category "อาหาร", note "ก๋วยเตี๋ยว"
 *        รับ 5000 เงินเดือน               -> record income 5000, category "เงินเดือน"
 *        -150 อาหาร                       -> shorthand expense
 *        +5000 เงินเดือน                  -> shorthand income
 *   2. Loose/natural fallback — if the strict patterns don't match but the
 *      message still contains a number, try to read it the way a person
 *      would type casually, regardless of word order or spacing:
 *        จ่ายไป 100 บาทค่าอาหาร
 *        ซื้อข้าว 100
 *        100อาหาร
 *        ได้เงินค่าขายของ 5000
 *
 * Plus:
 *   สรุป / สรุปวัน                    -> today's summary
 *   สรุปเดือน                        -> this month's summary
 *   สรุป 2026-06                     -> summary for a specific month (YYYY-MM)
 *   help / ช่วยเหลือ / เมนู            -> show usage help
 *
 * Returns null if the message doesn't match anything recognizable (the bot
 * stays silent so it doesn't spam unrelated chat messages).
 */

const RECORD_PATTERNS = [
  // จ่าย <amount> <category> [note...]  (spaces between parts are optional)
  { type: "expense", re: /^(?:จ่าย|expense|exp)\s*([\d,]+(?:\.\d+)?)\s*(\S+)\s*(.*)$/i },
  // รับ <amount> <category> [note...]
  { type: "income", re: /^(?:รับ|income|inc)\s*([\d,]+(?:\.\d+)?)\s*(\S+)\s*(.*)$/i },
  // -<amount> <category> [note...]  (expense shorthand)
  { type: "expense", re: /^-\s*([\d,]+(?:\.\d+)?)\s*(\S+)\s*(.*)$/ },
  // +<amount> <category> [note...]  (income shorthand)
  { type: "income", re: /^\+\s*([\d,]+(?:\.\d+)?)\s*(\S+)\s*(.*)$/ },
];

// Words that strongly imply income/expense AND double as a natural category
// name in Thai (e.g. "ค่าอาหาร", "เงินเดือน") -- detected but never stripped.
const INCOME_NOUNS = ["เงินเดือน", "โบนัส", "ขายของ", "รายรับ", "เงินปันผล"];
const EXPENSE_NOUNS = ["ค่า"];

// Pure action verbs -- detected AND stripped out of the category text.
// Longer/more specific phrases are listed first so they match before their
// shorter substrings (e.g. "ได้เงิน" before "รับ").
const INCOME_VERBS = ["ได้รับ", "ได้เงิน", "รับเงิน", "รับ"];
const EXPENSE_VERBS = [
  "จ่ายไป", "จ่าย", "ซื้อของ", "ซื้อ", "เสียไป", "เสีย",
  "ใช้ไป", "ใช้", "เติม", "กิน",
];

const CURRENCY_FILLERS = ["บาท", "฿", "baht"];

const HELP_RE = /^(help|ช่วยเหลือ|เมนู|คำสั่ง)$/i;
const SUMMARY_MONTH_RE = /^สรุป\s+(\d{4})-(\d{2})$/;
const SUMMARY_THIS_MONTH_RE = /^สรุปเดือน$/;
const SUMMARY_TODAY_RE = /^สรุป(วัน)?$/;

function detectType(text) {
  for (const w of INCOME_NOUNS) if (text.includes(w)) return "income";
  for (const w of EXPENSE_NOUNS) if (text.includes(w)) return "expense";
  for (const w of INCOME_VERBS) if (text.includes(w)) return "income";
  for (const w of EXPENSE_VERBS) if (text.includes(w)) return "expense";
  return "expense"; // default: most casual entries are spending
}

function stripFirstVerb(text) {
  for (const w of [...INCOME_VERBS, ...EXPENSE_VERBS]) {
    if (text.includes(w)) return text.replace(w, " ");
  }
  return text;
}

// Reads a free-form, conversational message like a person would: find the
// number anywhere in the text, figure out income vs expense from context
// words, and treat whatever's left as the category.
function looseParseRecord(text) {
  const numberMatch = text.match(/([\d,]+(?:\.\d+)?)/);
  if (!numberMatch) return null;

  const amount = Number(numberMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const type = detectType(text);

  let remaining = text.slice(0, numberMatch.index) + " " + text.slice(numberMatch.index + numberMatch[0].length);
  remaining = stripFirstVerb(remaining);
  for (const f of CURRENCY_FILLERS) remaining = remaining.split(f).join(" ");

  const category = remaining.replace(/\s+/g, " ").trim() || "อื่นๆ";

  return { kind: "record", type, amount, category, note: "" };
}

function parseMessage(rawText) {
  const text = (rawText || "").trim();
  if (!text) return null;

  if (HELP_RE.test(text)) {
    return { kind: "help" };
  }

  let m = text.match(SUMMARY_MONTH_RE);
  if (m) {
    return { kind: "summary", period: "month", year: Number(m[1]), month: Number(m[2]) };
  }

  if (SUMMARY_THIS_MONTH_RE.test(text)) {
    return { kind: "summary", period: "month" };
  }

  if (SUMMARY_TODAY_RE.test(text)) {
    return { kind: "summary", period: "day" };
  }

  for (const { type, re } of RECORD_PATTERNS) {
    const match = text.match(re);
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const category = match[2].trim();
      const note = (match[3] || "").trim();
      return { kind: "record", type, amount, category, note };
    }
  }

  return looseParseRecord(text);
}

module.exports = { parseMessage };
