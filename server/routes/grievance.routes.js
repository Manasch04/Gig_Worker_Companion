const express = require("express");
const router = express.Router();
const { draftGrievance } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");
const { verifyPartnerIdentity } = require("../services/verificationService");

/**
 * POST /api/grievance/draft
 * Drafts formal grievance letters and in-app support chat tickets with legal basis.
 * Integrates Tier-1 Partner Identity verification.
 */
router.post("/draft", async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const { platform, issueType, details, partnerId, disputedAmount, orderId, language } = req.body;

    // Tier 1: Partner ID verification
    const identityAudit = verifyPartnerIdentity(platform, partnerId);

    const aiDraft = await draftGrievance(
      {
        platform,
        issueType,
        details,
        partnerId: identityAudit.normalizedId || partnerId,
        disputedAmount,
        orderId,
        language
      },
      apiKey
    );

    res.json({
      ...aiDraft,
      partnerIdentityAudit: identityAudit,
      draftedTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Grievance Draft Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to draft grievance." });
  }
});

module.exports = router;
