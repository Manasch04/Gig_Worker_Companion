require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// Middleware
const { sanitizeRequestBody, getRuntimeApiKey, setRuntimeApiKey } = require("./middleware/security");

// Route Handlers
const earningsRouter = require("./routes/earnings.routes");
const documentRouter = require("./routes/document.routes");
const grievanceRouter = require("./routes/grievance.routes");
const schemesRouter = require("./routes/schemes.routes");
const safetyRouter = require("./routes/safety.routes");
const chatRouter = require("./routes/chat.routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(sanitizeRequestBody);

// Serve frontend static assets with high-efficiency caching
app.use(express.static(path.join(__dirname, "../public"), {
  maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  etag: true
}));

// System & Health Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Gig Worker Companion (साथी) API",
    geminiConfigured: !!getRuntimeApiKey(),
    timestamp: new Date().toISOString()
  });
});

app.get("/api/config/status", (req, res) => {
  res.json({
    geminiConfigured: !!getRuntimeApiKey()
  });
});

app.post("/api/config/key", (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return res.status(400).json({ error: "Invalid API key format." });
  }
  setRuntimeApiKey(apiKey.trim());
  res.json({
    success: true,
    message: "Gemini API key updated successfully for this session.",
    geminiConfigured: true
  });
});

// Mount Modular API Routes
app.use("/api/earnings", earningsRouter);
app.use("/api/document", documentRouter);
app.use("/api/grievance", grievanceRouter);
app.use("/api/schemes", schemesRouter);
app.use("/api/safety", safetyRouter);
app.use("/api/chat", chatRouter);

// Fallback to index.html for SPA routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || "An unexpected internal server error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Gig Worker Companion (साथी) running on port ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  Architecture: Modular Routes + 3-Tier Security Audit`);
  console.log(`=======================================================`);
});

module.exports = app;
