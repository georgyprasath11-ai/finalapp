import { ensureKv, listQuestions } from "./_question-storage.js";
import { addSecurityHeaders, requireAuth } from "./_auth-guard.js";

const getProfileId = (queryValue) => {
  if (Array.isArray(queryValue)) {
    return typeof queryValue[0] === "string" ? queryValue[0] : null;
  }
  return typeof queryValue === "string" ? queryValue : null;
};

export default async function handler(req, res) {
  addSecurityHeaders(res);
  const { error } = await requireAuth(req);
  if (error) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  try {
    ensureKv();
  } catch {
    res.status(503).json({ ok: false, error: "Service unavailable." });
    return;
  }

  const profileId = getProfileId(req.query?.profileId) ?? "default";
  try {
    const questions = await listQuestions(profileId);
    res.status(200).json({ questions });
  } catch {
    res.status(500).json({ ok: false, error: "Unable to load questions." });
  }
}
