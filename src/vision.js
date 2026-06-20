const { google } = require("googleapis");

// Vision API needs the broader cloud-platform scope (separate JWT instance
// from the one used in sheets.js, which only needs the spreadsheets scope).
let visionAuthPromise = null;

function getVisionAuth() {
  if (!visionAuthPromise) {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/cloud-platform"]
    );
    visionAuthPromise = auth.authorize().then(() => auth);
  }
  return visionAuthPromise;
}

// Runs Google Cloud Vision OCR on an image buffer and returns the full
// detected text (or an empty string if nothing was found).
async function detectTextFromImage(buffer) {
  const auth = await getVisionAuth();
  const vision = google.vision({ version: "v1", auth });

  const res = await vision.images.annotate({
    requestBody: {
      requests: [
        {
          image: { content: buffer.toString("base64") },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    },
  });

  const annotation = res.data.responses && res.data.responses[0] && res.data.responses[0].fullTextAnnotation;
  return annotation ? annotation.text : "";
}

module.exports = { detectTextFromImage };
