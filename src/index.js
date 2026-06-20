require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

const { parseMessage } = require("./parser");
const { appendTransaction, listTransactions } = require("./sheets");
const { summarizeDay, summarizeMonth } = require("./summary");
const { detectTextFromImage } = require("./vision");
const { parseSlipText } = require("./slipParser");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

const HELP_TEXT = [
  "วิธีใช้งาน:",
  "พิมพ์ปกติแบบคุยกันก็ได้ เช่น \"จ่ายไป 100 บาทค่าอาหาร\" หรือ \"ซื้อข้าว 100\"",
  "จ่าย <จำนวน> <หมวด> [โน้ต]  เช่น จ่าย 150 อาหาร ก๋วยเตี๋ยว",
  "รับ <จำนวน> <หมวด> [โน้ต]   เช่น รับ 5000 เงินเดือน",
  "หรือใช้ +/-  เช่น -150 อาหาร  /  +5000 เงินเดือน",
  "ส่งรูปสลิปโอนเงินมาได้เลย บอทจะอ่านยอดเงินและบันทึกให้",
  "สรุป         ดูยอดวันนี้",
  "สรุปเดือน     ดูยอดเดือนนี้",
  "สรุป 2026-06  ดูยอดเดือนที่ระบุ",
].join("\n");

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function replyTo(event, text) {
  if (!text) return;
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text }],
  });
}

async function handleTextMessage(event) {
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
    console.error("Error handling text message:", err);
    replyText = "เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะ";
  }

  await replyTo(event, replyText);
}

async function handleImageMessage(event) {
  const userId = event.source.userId;
  let replyText;

  try {
    const stream = await blobClient.getMessageContent(event.message.id);
    const buffer = await streamToBuffer(stream);
    const text = await detectTextFromImage(buffer);
    const parsed = parseSlipText(text);

    if (!parsed) {
      replyText = "อ่านสลิปไม่สำเร็จ ลองถ่ายให้ชัดขึ้น หรือพิมพ์ยอดเงินเองก็ได้ครับ เช่น จ่าย 100 อาหาร";
    } else {
      await appendTransaction({
        userId,
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        note: "จากสลิป",
      });
      replyText = `อ่านสลิปแล้ว บันทึก: -${parsed.amount.toLocaleString()} (${parsed.category})`;
    }
  } catch (err) {
    console.error("Error handling image message:", err);
    replyText = "อ่านสลิปไม่สำเร็จ ลองใหม่อีกครั้งนะ";
  }

  await replyTo(event, replyText);
}

async function handleEvent(event) {
  if (event.type !== "message") return;
  if (event.message.type === "text") return handleTextMessage(event);
  if (event.message.type === "image") return handleImageMessage(event);
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
