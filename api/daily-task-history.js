const SCHEMA_VERSION = 1;

const isRecord = (value) => typeof value === "object" && value !== null;

const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

const hasKvConfig = () => typeof kvUrl === "string" && kvUrl.length > 0 && typeof kvToken === "string" && kvToken.length > 0;

const historyKey = (profileId) => `study-dashboard:daily-history:${profileId}`;

const runKvPipeline = async (commands) => {
  const response = await fetch(`${kvUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`KV request failed with status ${response.status}`);
  }

  return response.json();
};

const readJsonBody = async (req) => {
  if (isRecord(req.body)) {
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

const getProfileId = (queryValue) => {
  if (Array.isArray(queryValue)) {
    return typeof queryValue[0] === "string" ? queryValue[0] : null;
  }

  return typeof queryValue === "string" ? queryValue : null;
};

const isPayloadShape = (payload) =>
  isRecord(payload) &&
  payload.schemaVersion === SCHEMA_VERSION &&
  typeof payload.profileId === "string" &&
  isRecord(payload.dailyTasksState) &&
  isRecord(payload.history) &&
  typeof payload.updatedAt === "string";

export default async function handler(req, res) {
  if (!hasKvConfig()) {
    res.status(503).json({ error: "KV is not configured." });
    return;
  }

  if (req.method === "GET") {
    const profileId = getProfileId(req.query?.profileId);
    if (!profileId) {
      res.status(400).json({ error: "profileId is required." });
      return;
    }

    try {
      const key = historyKey(profileId);
      const pipelineResult = await runKvPipeline([["GET", key]]);
      const raw = Array.isArray(pipelineResult) ? pipelineResult[0]?.result ?? null : null;

      if (typeof raw !== "string" || raw.length === 0) {
        res.status(404).json({ error: "No history found." });
        return;
      }

      const parsed = JSON.parse(raw);
      if (!isPayloadShape(parsed)) {
        res.status(404).json({ error: "History payload invalid." });
        return;
      }

      res.status(200).json(parsed);
      return;
    } catch {
      res.status(500).json({ error: "Unable to fetch daily history." });
      return;
    }
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!isPayloadShape(body)) {
        res.status(400).json({ error: "Invalid payload." });
        return;
      }

      const key = historyKey(body.profileId);
      await runKvPipeline([["SET", key, JSON.stringify(body)]]);

      res.status(200).json({ ok: true });
      return;
    } catch {
      res.status(500).json({ error: "Unable to save daily history." });
      return;
    }
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
