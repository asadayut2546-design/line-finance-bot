require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

const { parseMessage } = require("./parser");
const { appendTransaction, listTransactions } = require("./sheets");
const { summarizeDay, summarizeMonth } = require("./summary");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

const HELP_TEXT = [
  "วิธีใช้งาน:",
  "จ่าย <จำนวน> <หมวด> [โน้ต]  เช่น จ่าย 150 อาหาร ก๋วยเตี๋ยว",
  "รับ <จำนวน> <หมวด> [โน้ต]   เช่น รับ 5000 เงินเดือน",
  "หรือใช้ +/-  เช่น -150 อาหาร  /  +5000 เงินเดือน",
  "สรุป         ดูยอดวันนี้",
  "สรุปเดือน     ดูยอดเดือนนี้",
  "สรุป 2026-06  ดูยอดเดือนที่ระบุ",
].join("\n");

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const userId = event.source.userId;
  const command = parseMessage(event.message.text);
  if (!command) return; // ignore unrelated chat messages

  let replyText;

  try {
    if (command.kind === "help") {
      replyText = HELP_TEXT;
    } else if (command.kind === "record") {
      await appendTransaction({
        userId,
        type: command.type,
        amount: command.amount,
        category: command.category,
        note: command.note,
      });
      const sign = command.type === "income" ? "+" : "-";
      replyText = `บันทึกแล้ว: ${sign}${command.amount.toLocaleString()} (${command.category})`;
    } else if (command.kind === "summary") {
      const transactions = await listTransactions(userId);
      replyText =
        command.period === "month"
          ? summarizeMonth(transactions, command.year, command.month)
          : summarizeDay(transactions);
    }
  } catch (err) {
    console.error("Error handling event:", err);
    replyText = "เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ";
  }

  if (replyText) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: replyText }],
    });
  }
}

app.post("/webhook", line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.json({ ok: true }))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

app.get("/", (req, res) => res.send("LINE finance bot is running."));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
