const { google } = require("googleapis");

const SHEET_NAME = "Transactions";
const HEADER = ["Timestamp", "UserId", "Type", "Amount", "Category", "Note"];

let sheetsClientPromise = null;

function getSheetsClient() {
  if (!sheetsClientPromise) {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: "v4", auth }));
  }
  return sheetsClientPromise;
}

// Makes sure the Transactions sheet + header row exist. Safe to call repeatedly.
async function ensureSheet() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets.some((s) => s.properties.title === SHEET_NAME);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

async function appendTransaction({ userId, type, amount, category, note }) {
  await ensureSheet();
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[timestamp, userId, type, amount, category, note]] },
  });

  return { timestamp };
}

// Returns all transaction rows for a user (as parsed objects).
async function listTransactions(userId) {
  await ensureSheet();
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A2:F`,
  });

  const rows = res.data.values || [];
  return rows
    .filter((r) => r[1] === userId)
    .map(([timestamp, uid, type, amount, category, note]) => ({
      timestamp,
      userId: uid,
      type,
      amount: Number(amount),
      category,
      note,
    }));
}

module.exports = { appendTransaction, listTransactions };
