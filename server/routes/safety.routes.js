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
    console.warn("Gemini Safety Call encountered an issue, falling back to grounded safetyData:", err.message);
    const key = req.body.situationKey || "accident";
    const fallbackGuidance = safetyData.emergencyChecklists?.[key] || safetyData.emergencyChecklists?.["accident"] || {
      immediateAction: [
        "सुरक्षित किनारे पर बाइक रोकें और अपनी चोट की जांच करें।",
        "यदि गंभीर चोट है तो तुरंत 112 या 108 पर कॉल करें।",
        "घटनास्थल और बाइक की फोटो लें तथा ऐप सपोर्ट को 'Accident on duty' मार्क करें।"
      ],
      primaryEmergencyNumber: "112",
      emergencyServiceName: "National Emergency Helpline",
      platformProtectionTip: "Order/Trip ko app me 'Emergency Breakdown' mark karein taaki company penalty na kaat sake.",
      reassuringAdvice: "Ghabraiye mat, pehle apni jaan aur sehat par dhyan dijiye. Company ki penalty hum dispute karenge."
    };
    res.json({
      ...fallbackGuidance,
      isGroundedFallback: true
    });
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
