// Builds an income/expense summary message for a given period.

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inRange(tx, from, to) {
  const t = new Date(tx.timestamp);
  return t >= from && t < to;
}

function summarize(transactions, { from, to, label }) {
  const inPeriod = transactions.filter((tx) => inRange(tx, from, to));

  let income = 0;
  let expense = 0;
  const byCategory = {};

  for (const tx of inPeriod) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;

    const key = `${tx.type}:${tx.category}`;
    byCategory[key] = (byCategory[key] || 0) + tx.amount;
  }

  const topExpenseCategories = Object.entries(byCategory)
    .filter(([key]) => key.startsWith("expense:"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, amount]) => `  - ${key.replace("expense:", "")}: ${amount.toLocaleString()}`);

  const lines = [
    `สรุป${label}`,
    `รายรับ: +${income.toLocaleString()}`,
    `รายจ่าย: -${expense.toLocaleString()}`,
    `คงเหลือ: ${(income - expense).toLocaleString()}`,
  ];

  if (topExpenseCategories.length) {
    lines.push("รายจ่ายสูงสุด:");
    lines.push(...topExpenseCategories);
  }

  return lines.join("\n");
}

function summarizeDay(transactions, now = new Date()) {
  const from = startOfDay(now);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return summarize(transactions, { from, to, label: "วันนี้" });
}

function summarizeMonth(transactions, year, month, now = new Date()) {
  const y = year ?? now.getFullYear();
  const m = month ? month - 1 : now.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 1);
  const label = `เดือน ${y}-${String(m + 1).padStart(2, "0")}`;
  return summarize(transactions, { from, to, label });
}

module.exports = { summarizeDay, summarizeMonth };
