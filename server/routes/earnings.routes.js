const express = require("express");
const router = express.Router();
const { analyzeEarnings } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");
const { auditOperationalSanity } = require("../services/verificationService");

/**
 * POST /api/earnings/analyze
 * Conducts math audit, delivery pace sanity check, and Gemini-powered net margin explanation.
 */
router.post("/analyze", async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const { platform, grossEarnings, hoursWorked, operatingExpenses, platformDeductions, trips, notes, language } = req.body;

    // 1. Run Tier-2 Operational Math & Pace Sanity Check
    const sanityAudit = auditOperationalSanity({
      grossEarnings,
      hoursWorked,
      operatingExpenses,
      platformDeductions,
      trips
    });

    // 2. Call Gemini 2.5 Flash for in-depth reasoning and multilingual guidance
    const aiAnalysis = await analyzeEarnings(
      {
        platform,
        grossEarnings,
        hoursWorked,
        operatingExpenses,
        platformDeductions,
        trips,
        notes,
        language
      },
      apiKey
    );

    // 3. Return consolidated verified result with audit flags
    res.json({
      ...aiAnalysis,
      sanityAudit,
      verifiedTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Earnings Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to analyze earnings." });
  }
});

module.exports = router;
