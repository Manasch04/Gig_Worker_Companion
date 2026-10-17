const multer = require("multer");

/**
 * Memory storage multer upload middleware.
 * Zero-PII: Files are kept strictly in memory for Gemini multimodal OCR analysis
 * and never written to permanent disk storage.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload JPG, PNG, WEBP, or PDF."));
    }
  }
});

module.exports = upload;
