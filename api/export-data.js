import { ensureKv, listQuestions } from "./_question-storage.js";

const getProfileId = (queryValue) => {
  if (Array.isArray(queryValue)) {
    return typeof queryValue[0] === "string" ? queryValue[0] : null;
  }
  return typeof queryValue === "string" ? queryValue : null;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  try {
    ensureKv();
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
    return;
  }

  const profileId = getProfileId(req.query?.profileId) ?? "default";
  try {
    const questions = await listQuestions(profileId);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ questions });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to export data." });
  }
}
