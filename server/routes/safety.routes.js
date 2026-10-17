const express = require("express");
const router = express.Router();
const { getSafetyGuidance, safetyData } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");

/**
 * POST /api/safety/emergency
 * High-speed urgent situational guidance for road accidents, physical assault, extortion, fraud.
 */
router.post("/emergency", async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const result = await getSafetyGuidance(req.body, apiKey);
    res.json(result);
  } catch (err) {
    console.error("Safety Guidance Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to fetch safety guidance." });
  }
});

/**
 * GET /api/safety/data
 * Returns verified national emergency numbers (112, 108, 1091, 1930) and protocol checklists.
 */
router.get("/data", (req, res) => {
  res.json(safetyData);
});

module.exports = router;
