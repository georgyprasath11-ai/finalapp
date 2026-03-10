const kvUrl = process.env.KV_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN;

const hasKvConfig = () => typeof kvUrl === "string" && kvUrl.length > 0 && typeof kvToken === "string" && kvToken.length > 0;

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

const parseJson = (raw) => {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const indexKey = (profileId) => `question-solver:index:${profileId}`;
const hashKey = (profileId, hash) => `question-solver:hash:${profileId}:${hash}`;
const itemKey = (profileId, id) => `question-solver:item:${profileId}:${id}`;

export const ensureKv = () => {
  if (!hasKvConfig()) {
    throw new Error("KV is not configured.");
  }
};

export const getQuestionByHash = async (profileId, hash) => {
  ensureKv();
  const pipeline = await runKvPipeline([["GET", hashKey(profileId, hash)]]);
  const questionId = Array.isArray(pipeline) ? pipeline[0]?.result ?? null : null;
  if (!questionId) {
    return null;
  }
  const recordResult = await runKvPipeline([["GET", itemKey(profileId, questionId)]]);
  return parseJson(recordResult?.[0]?.result ?? null);
};

export const listQuestions = async (profileId) => {
  ensureKv();
  const pipeline = await runKvPipeline([["GET", indexKey(profileId)]]);
  const indexRaw = Array.isArray(pipeline) ? pipeline[0]?.result ?? null : null;
  const parsedIndex = parseJson(indexRaw);
  const ids = Array.isArray(parsedIndex) ? parsedIndex : [];
  if (ids.length === 0) {
    return [];
  }
  const commands = ids.map((id) => ["GET", itemKey(profileId, id)]);
  const records = await runKvPipeline(commands);
  return records
    .map((entry) => parseJson(entry?.result ?? null))
    .filter((item) => item !== null);
};

export const saveQuestion = async (profileId, record) => {
  ensureKv();
  const existingIndexPipeline = await runKvPipeline([["GET", indexKey(profileId)]]);
  const existingIndexRaw = Array.isArray(existingIndexPipeline) ? existingIndexPipeline[0]?.result ?? null : null;
  const parsedIndex = parseJson(existingIndexRaw);
  const existingIndex = Array.isArray(parsedIndex) ? parsedIndex : [];

  const nextIndex = existingIndex.filter((id) => id !== record.id);
  nextIndex.unshift(record.id);

  await runKvPipeline([
    ["SET", itemKey(profileId, record.id), JSON.stringify(record)],
    ["SET", hashKey(profileId, record.image_hash), record.id],
    ["SET", indexKey(profileId), JSON.stringify(nextIndex)],
  ]);

  return record;
};
