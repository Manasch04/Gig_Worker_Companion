const express = require("express");
const router = express.Router();
const { checkSchemes, schemesData } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");

/**
 * POST /api/schemes/check
 * Grounded welfare eligibility analysis against e-Shram, PM-JAY, PM-SYM, and State Acts.
 */
router.post("/check", async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const result = await checkSchemes(req.body, apiKey);
    res.json(result);
  } catch (err) {
    console.error("Schemes Check Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to check schemes." });
  }
});

/**
 * GET /api/schemes/list
 * Returns grounded list of verified welfare schemes with portal URLs and official helplines.
 */
router.get("/list", (req, res) => {
  res.json({
    schemes: schemesData,
    verifiedCount: schemesData.length,
    source: "Ministry of Labour & Employment, e-Shram, PM-JAY official guidelines"
  });
});

module.exports = router;
