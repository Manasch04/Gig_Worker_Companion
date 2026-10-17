const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { verifyDocument } = require("../geminiService");
const { resolveApiKey } = require("../middleware/security");

/**
 * POST /api/document/verify
 * Multimodal OCR verification of payslips, delivery deduction notices, contracts, and SMS alerts.
 */
router.post("/verify", upload.single("documentImage"), async (req, res) => {
  try {
    const apiKey = resolveApiKey(req);
    const fileBuffer = req.file ? req.file.buffer : null;
    const mimeType = req.file ? req.file.mimetype : null;
    const textContent = req.body.textContent || "";
    const language = req.body.language || "hinglish";

    if (!fileBuffer && !textContent) {
      return res.status(400).json({
        error: "Please upload an image file of your payslip/notice or enter the text content."
      });
    }

    const result = await verifyDocument(
      { fileBuffer, mimeType, textContent, language },
      apiKey
    );

    res.json({
      ...result,
      ocrTimestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Document Verify Route Error:", err.message);
    res.status(500).json({ error: err.message || "Failed to verify document." });
  }
});

module.exports = router;
