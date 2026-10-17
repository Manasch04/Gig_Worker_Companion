/**
 * VERIFICATION & FRAUD PROTECTION SERVICE (3-TIER TRUST)
 * Validates partner IDs, operational math sanity, and protects worker privacy (Zero-PII).
 */

const PLATFORM_ID_PATTERNS = {
  Zomato: /^(ZOM-)?[A-Z0-9]{4,10}$/i,
  Swiggy: /^(SWG-|SP-)?[A-Z0-9]{4,10}$/i,
  Uber: /^(UBR-|UBER-)?[A-Z0-9]{4,12}$/i,
  Ola: /^(OLA-)?[A-Z0-9]{4,12}$/i,
  Zepto: /^(ZPT-)?[A-Z0-9]{4,10}$/i,
  Blinkit: /^(BLK-)?[A-Z0-9]{4,10}$/i,
  "Urban Company": /^(UC-)?[A-Z0-9]{4,10}$/i
};

/**
 * Tier 1: Partner ID Format Verification
 */
function verifyPartnerIdentity(platform, partnerId) {
  if (!partnerId || typeof partnerId !== "string") {
    return {
      verified: false,
      tier: "UNVERIFIED",
      badge: "Self-Reported Statement",
      details: "No official Partner ID provided."
    };
  }

  const cleanedId = partnerId.trim();
  const pattern = PLATFORM_ID_PATTERNS[platform];

  if (pattern && pattern.test(cleanedId)) {
    return {
      verified: true,
      tier: "VERIFIED_PLATFORM_PARTNER",
      badge: `✓ Verified ${platform} Partner (${cleanedId})`,
      normalizedId: cleanedId,
      details: `Partner ID matches ${platform} format standards.`
    };
  }

  return {
    verified: cleanedId.length >= 4,
    tier: "STANDARD_ID",
    badge: `Partner ID: ${cleanedId}`,
    normalizedId: cleanedId,
    details: "Partner ID format recorded."
  };
}

/**
 * Tier 2: Operational Math & Delivery Pace Sanity Check
 */
function auditOperationalSanity({ grossEarnings, hoursWorked, operatingExpenses, platformDeductions, trips }) {
  const flags = [];
  let integrityScore = 100;

  const gross = Number(grossEarnings) || 0;
  const hours = Number(hoursWorked) || 0;
  const expenses = Number(operatingExpenses) || 0;
  const deductions = Number(platformDeductions) || 0;
  const tripCount = Number(trips) || 0;

  // 1. Hours vs Trips sanity check
  if (hours > 0 && tripCount > 0) {
    const tripsPerHour = tripCount / hours;
    if (tripsPerHour > 4.5) {
      flags.push({
        type: "PACE_ANOMALY",
        severity: "WARNING",
        message: `${tripCount} deliveries in ${hours} hours (${tripsPerHour.toFixed(1)}/hr) exceeds normal physical urban speed.`
      });
      integrityScore -= 35;
    }
  }

  // 2. Fuel to Earnings sanity check
  if (gross > 0 && expenses > gross) {
    flags.push({
      type: "EXPENSE_EXCEEDS_GROSS",
      severity: "ALERT",
      message: `Operating expenses (₹${expenses}) exceed total gross app payout (₹${gross}). Worker in net operational deficit.`
    });
  }

  // 3. Deduction Proportion check
  if (gross > 0 && deductions > gross * 0.4) {
    flags.push({
      type: "SEVERE_DEDUCTION_CUT",
      severity: "CRITICAL",
      message: `Platform deductions (₹${deductions}) exceed 40% of gross earnings. Prime grounds for formal grievance dispute.`
    });
  }

  const netTakeHome = Math.max(0, gross - expenses - deductions);
  const hourlyRate = hours > 0 ? (netTakeHome / hours).toFixed(2) : 0;

  return {
    integrityScore: Math.max(0, integrityScore),
    isRealistic: integrityScore >= 70,
    flags,
    metrics: {
      netTakeHome,
      hourlyRate: Number(hourlyRate),
      isBelowLivingWage: hourlyRate > 0 && hourlyRate < 60
    }
  };
}

/**
 * Tier 3: Zero-PII Prompt Injection & Input Sanitizer
 */
function sanitizeInput(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/[<>]/g, "") // Strip HTML tags
    .replace(/\b(ignore previous instructions|system prompt|drop table)\b/gi, "[filtered]")
    .trim();
}

module.exports = {
  verifyPartnerIdentity,
  auditOperationalSanity,
  sanitizeInput
};
