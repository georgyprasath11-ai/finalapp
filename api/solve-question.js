import crypto from "node:crypto";
import { getQuestionByHash, saveQuestion, ensureKv } from "./_question-storage.js";
import { addSecurityHeaders, checkBodySize, requireAuth } from "./_auth-guard.js";

const readJsonBody = async (req) => {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error("invalid-json");
    }
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("invalid-json");
  }
};

const getDeepSeekBaseUrl = () => process.env.DEEPSEEK_API_BASE_URL || "https://api.deepseek.com/v1";
const getDeepSeekModel = () => process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";

const buildPrompt = (extracted) => {
  return [
    "You are a physics and chemistry problem solver.",
    "",
    "Solve the following question extracted from an image.",
    "",
    "Question:",
    extracted.extracted_text,
    "",
    "Diagram description:",
    extracted.diagram_description,
    "",
    "Numbers:",
    JSON.stringify(extracted.numbers ?? []),
    "",
    "Labels:",
    JSON.stringify(extracted.labels ?? []),
    "",
    "Provide:",
    "1. Step-by-step reasoning",
    "2. Final answer",
  ].join("\n");
};

export default async function handler(req, res) {
  addSecurityHeaders(res);
  const { error } = await requireAuth(req);
  if (error) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  if (!checkBodySize(req, res)) {
    return;
  }

  try {
    ensureKv();
  } catch {
    res.status(503).json({ ok: false, error: "Service unavailable." });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "DeepSeek API key is not configured." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const profileId = body.profileId ?? "default";
    const extracted = body.extracted;
    const imageUrl = body.imageUrl;
    const imageHash = body.imageHash;

    if (!extracted || !imageUrl || !imageHash) {
      res.status(400).json({ ok: false, error: "Missing extracted data or image reference." });
      return;
    }

    const cached = await getQuestionByHash(profileId, imageHash);
    if (cached) {
      res.status(200).json({ ok: true, cached: true, record: cached, answer: cached.deepseek_answer });
      return;
    }

    const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getDeepSeekModel(),
        messages: [
          { role: "system", content: "You are a rigorous problem solver." },
          { role: "user", content: buildPrompt(extracted) },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      res.status(500).json({ ok: false, error: "DeepSeek request failed." });
      return;
    }

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!answer) {
      res.status(500).json({ ok: false, error: "DeepSeek returned an empty answer." });
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      image_url: imageUrl,
      extracted_question: extracted,
      deepseek_answer: answer,
      created_at: new Date().toISOString(),
      image_hash: imageHash,
    };

    await saveQuestion(profileId, record);

    res.status(200).json({ ok: true, answer, record, cached: false });
  } catch (error) {
    if (error && error.message === "invalid-json") {
      res.status(400).json({ ok: false, error: "Invalid request body" });
      return;
    }
    res.status(500).json({ ok: false, error: "Unable to solve question." });
  }
}
