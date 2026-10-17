const express = require("express");
const router = express.Router();
const { chatWithCompanion } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");

/**
 * POST /api/chat
 * Conversational companion for voice or text interaction in regional languages.
 */
router.post("/", async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const result = await chatWithCompanion(req.body, apiKey);
    res.json(result);
  } catch (err) {
    console.error("Chat Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to process chat message." });
  }
});

module.exports = router;
