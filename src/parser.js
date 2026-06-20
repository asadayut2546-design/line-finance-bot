/**
 * Parses an incoming LINE text message into a structured command.
 *
 * Supported message formats (Thai-first, English fallback):
 *   จ่าย 150 อาหาร ก๋วยเตี๋ยว        -> record expense 150, category "อาหาร", note "ก๋วยเตี๋ยว"
 *   รับ 5000 เงินเดือน               -> record income 5000, category "เงินเดือน"
 *   -150 อาหาร                       -> shorthand expense
 *   +5000 เงินเดือน                  -> shorthand income
 *   สรุป / สรุปวัน                    -> today's summary
 *   สรุปเดือน                        -> this month's summary
 *   สรุป 2026-06                     -> summary for a specific month (YYYY-MM)
 *   help / ช่วยเหลือ / เมนู            -> show usage help
 *
 * Returns null if the message doesn't match any known command (the bot
 * stays silent so it doesn't spam unrelated chat messages).
 */

const RECORD_PATTERNS = [
  // จ่าย <amount> <category> [note...]
  { type: "expense", re: /^(?:จ่าย|expense|exp)\s+([\d,]+(?:\.\d+)?)\s+(\S+)\s*(.*)$/i },
  // รับ <amount> <category> [note...]
  { type: "income", re: /^(?:รับ|income|inc)\s+([\d,]+(?:\.\d+)?)\s+(\S+)\s*(.*)$/i },
  // -<amount> <category> [note...]  (expense shorthand)
  { type: "expense", re: /^-\s*([\d,]+(?:\.\d+)?)\s+(\S+)\s*(.*)$/ },
  // +<amount> <category> [note...]  (income shorthand)
  { type: "income", re: /^\+\s*([\d,]+(?:\.\d+)?)\s+(\S+)\s*(.*)$/ },
];

const HELP_RE = /^(help|ช่วยเหลือ|เมนู|คำสั่ง)$/i;
const SUMMARY_MONTH_RE = /^สรุป\s+(\d{4})-(\d{2})$/;
const SUMMARY_THIS_MONTH_RE = /^สรุปเดือน$/;
const SUMMARY_TODAY_RE = /^สรุป(วัน)?$/;

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

  return null;
}

module.exports = { parseMessage };
