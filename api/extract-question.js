import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { extractQuestionFromImage } from "./_image-parser.js";
import { getQuestionByHash, ensureKv } from "./_question-storage.js";

const readJsonBody = async (req) => {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const parseDataUrl = (dataUrl) => {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mime: match[1], data: match[2] };
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  try {
    ensureKv();
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const profileId = body.profileId ?? "default";
    const imageDataUrl = body.imageDataUrl;
    const fileName = body.fileName ?? "question.png";
    const contentType = body.contentType ?? "image/png";

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      res.status(400).json({ ok: false, error: "Image data is required." });
      return;
    }

    const parsed = parseDataUrl(imageDataUrl);
    if (!parsed) {
      res.status(400).json({ ok: false, error: "Image data is invalid." });
      return;
    }

    const buffer = Buffer.from(parsed.data, "base64");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const cachedQuestion = await getQuestionByHash(profileId, hash);
    if (cachedQuestion) {
      res.status(200).json({
        ok: true,
        imageUrl: cachedQuestion.image_url,
        imageHash: hash,
        extracted: cachedQuestion.extracted_question,
        cachedQuestion,
      });
      return;
    }

    const extracted = await extractQuestionFromImage(buffer);
    if (!extracted || !extracted.extracted_text) {
      res.status(400).json({
        ok: false,
        error: "Unable to extract text from image. Please upload a clearer screenshot.",
      });
      return;
    }

    const blob = await put(`question-solver/${hash}-${fileName}`, buffer, {
      access: "public",
      contentType: parsed.mime || contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    res.status(200).json({
      ok: true,
      imageUrl: blob.url,
      imageHash: hash,
      extracted,
      cachedQuestion: null,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to extract text from image.",
    });
  }
}
