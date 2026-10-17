const { sanitizeInput } = require("../services/verificationService");

let runtimeApiKey = process.env.GEMINI_API_KEY || "";

/**
 * Resolves Gemini API key with runtime override support.
 */
function resolveApiKey(req) {
  let key =
    req?.headers?.["x-gemini-api-key"] ||
    req?.body?.apiKey ||
    runtimeApiKey ||
    process.env.GEMINI_API_KEY;

  if (!key) {
    try {
      require("dotenv").config({ override: true });
      key = process.env.GEMINI_API_KEY;
    } catch (e) {}
  }
  return key;
}

function setRuntimeApiKey(key) {
  runtimeApiKey = key;
}

function getRuntimeApiKey() {
  return runtimeApiKey || process.env.GEMINI_API_KEY || "";
}

/**
 * Sanitizes all string fields in req.body to prevent prompt injection and XSS
 */
function sanitizeRequestBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  next();
}

module.exports = {
  resolveApiKey,
  setRuntimeApiKey,
  getRuntimeApiKey,
  sanitizeRequestBody
};
