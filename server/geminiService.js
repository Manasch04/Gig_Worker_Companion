const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Load local verified schemes and safety data for grounding
const schemesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/schemesData.json"), "utf8")
);
const safetyData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/safetyData.json"), "utf8")
);

function getGeminiClient(customApiKey) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Please set it in .env or provide it in the API settings."
    );
  }
  return new GoogleGenerativeAI(apiKey);
}


function getLanguageDirective(language) {
  const lang = (language || "hinglish").toLowerCase();
  if (lang === "hinglish") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "hinglish". You MUST respond in conversational HINGLISH using the LATIN/ENGLISH ALPHABET (Roman script, e.g. "Aapki shift me ₹150 penalty late delivery ke liye deduct hui hai..."). NEVER use Devanagari script for Hinglish.`;
  } else if (lang === "hindi") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "hindi". You MUST respond in pure simple Hindi using Devanagari script (हिन्दी).`;
  } else if (lang === "punjabi") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "punjabi". You MUST respond in Punjabi using Gurmukhi script (ਪੰਜਾਬੀ).`;
  } else if (lang === "marathi") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "marathi". You MUST respond in Marathi using Devanagari script (मराठी).`;
  } else if (lang === "tamil") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "tamil". You MUST respond in Tamil (தமிழ்).`;
  } else if (lang === "bengali") {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "bengali". You MUST respond in Bengali (বাংলা).`;
  } else {
    return `CRITICAL LANGUAGE INSTRUCTION: The requested language is "english". You MUST respond in clear simple English.`;
  }
}

async function executeGeminiWithFallback(client, promptOrContents, primaryModel = "gemini-2.5-flash") {
  try {
    const model = client.getGenerativeModel({ model: primaryModel });
    return await model.generateContent(promptOrContents);
  } catch (err) {
    if (err.status === 429 || err.message?.includes("429") || err.message?.includes("quota")) {
      console.warn("Quota limit reached on primary model, falling back to gemini-1.5-flash...");
      try {
        const fallbackModel = client.getGenerativeModel({ model: "gemini-1.5-flash" });
        return await fallbackModel.generateContent(promptOrContents);
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

function getModel(client, modelName = "gemini-2.5-flash") {
  return client.getGenerativeModel({ model: modelName });
}

/**
 * 1. EARNINGS & DEDUCTIONS ANALYSIS
 * Transparent arithmetic, itemized breakdown, and verification proof
 */
async function analyzeEarnings(payload, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const prompt = `
You are the AI Gig Worker Companion. Your highest priority is building the WORKER'S TRUST through transparent, verifiable math and clear explanations. No black-box answers.

Analyze the following worker earnings data:
Input: ${JSON.stringify(payload)}
Target Language: ${payload.language || "hinglish"}
${getLanguageDirective(payload.language)}

Calculate:
1. Gross Earnings (base pay, tips, surge, incentives)
2. Operating Costs (fuel, vehicle EMI, maintenance, internet)
3. Platform Deductions (penalties, commission, uniform/bag deductions, loan cuts)
4. Net Take-Home Pay (Gross - Operating Costs - Deductions)
5. Effective Hourly Profit (Net Take-Home divided by active hours worked)

Check for anomalies:
- Are any deductions abnormally high or unexplained?
- Did the worker earn less than minimum reasonable rate after fuel?
- Highlight exact math formula used.

Return STRICT JSON with this schema:
{
  "summary": {
    "grossEarnings": number,
    "operatingExpenses": number,
    "platformDeductions": number,
    "netTakeHome": number,
    "hoursWorked": number,
    "netHourlyRate": number
  },
  "verifiedFormula": "Exact mathematical breakdown (e.g., Gross ₹1,200 - Fuel ₹350 - Penalty ₹150 = Net ₹700)",
  "deductionAudit": [
    {
      "item": "Deduction name",
      "amount": number,
      "flagged": true/false,
      "reason": "Clear explanation of why this was deducted or why it appears disputed"
    }
  ],
  "workerExplanation": "Simple, respectful explanation in requested language (${payload.language || "hinglish"}). Explain clearly whether their take-home is healthy or if an unfair deduction took place.",
  "actionableNextStep": "One concrete step the worker should take right now (e.g., dispute a penalty, claim fuel deduction, or rest)."
}
Respond ONLY with the raw JSON object. Do not include markdown codeblocks or backticks.
`;

  try {
    const result = await executeGeminiWithFallback(client, prompt, "gemini-2.5-flash");
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error in analyzeEarnings:", error);
    throw error;
  }
}

/**
 * 2. DOCUMENT & PAYSLIP VERIFICATION (MULTIMODAL VISION)
 * Reads payslips, penalty SMS, contracts, extracts exact evidence
 */
async function verifyDocument({ fileBuffer, mimeType, textContent, language }, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const prompt = `
You are an expert Document Verifier for Indian gig and informal workers.
Target Language: ${language || "hinglish"}
${getLanguageDirective(language)}

Your goal:
1. Extract all legible text from this payslip, penalty message, deactivation notice, or agreement.
2. Identify:
   - Platform (Zomato, Swiggy, Uber, Ola, Urban Company, Zepto, Blinkit, Porter, etc.)
   - Worker / Partner ID
   - Order / Trip IDs mentioned
   - Date / Pay Period
   - Itemized deductions, penalties, or warnings
3. Grounding & Verification:
   - Quote the EXACT text or lines from the document as verifiable proof ("Extracted Evidence").
   - Explain what the notice or clause means in 5th-grade simple language.
   - Flag whether the penalty/deduction violates standard platform dispute timelines or fair gig norms.
   - Provide concrete next steps (e.g. dispute via in-app ticket, ask for trip GPS audit).

Return STRICT JSON with this schema:
{
  "platform": "Platform Name",
  "documentType": "Payslip / Penalty Notice / Deactivation Alert / Contract",
  "partnerId": "Extracted ID or 'Not specified'",
  "orderId": "Extracted Order ID or 'N/A'",
  "date": "Extracted Date or 'N/A'",
  "extractedEvidence": [
    {
      "quote": "Exact verbatim excerpt from document",
      "meaning": "What it actually means for the worker"
    }
  ],
  "disputedItems": [
    {
      "description": "Item name",
      "amount": "₹ amount or N/A",
      "isDisputable": true/false,
      "disputeReason": "Why the worker has legitimate grounds to question or challenge this"
    }
  ],
  "simpleExplanation": "Simple, empathetic explanation in requested language (${language || "hinglish"}).",
  "nextStepAction": "One clear action to take."
}
Respond ONLY with the raw JSON object. Do not include markdown codeblocks or backticks.
`;

  try {
    let contents;
    if (fileBuffer && mimeType) {
      contents = [
        prompt,
        {
          inlineData: {
            data: fileBuffer.toString("base64"),
            mimeType: mimeType
          }
        }
      ];
    } else {
      contents = [prompt, `Document Text Content:\n${textContent}`];
    }

    const result = await executeGeminiWithFallback(client, contents, "gemini-2.5-flash");
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error in verifyDocument:", error);
    throw error;
  }
}

/**
 * 3. GRIEVANCE & DISPUTE DRAFTING
 * Builds formal, fact-grounded complaints quoting verified data
 */
async function draftGrievance(details, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const prompt = `
You are a formal dispute advocate for Indian gig and informal workers.
Your task is to draft a polite, highly professional, fact-backed dispute letter/ticket based ONLY on the verified facts provided. Do NOT invent false claims or exaggerate.

Dispute Input Details:
${JSON.stringify(details)}
Target Language for Explanation: ${details.language || "hinglish"}
${getLanguageDirective(details.language)}

Generate:
1. A formal English complaint letter suitable for platform Grievance Officer, App Support, or State Labour Commissioner.
2. A short WhatsApp/In-App ticket summary that fits in 200 words.
3. An Evidence Checklist: exactly what screenshots or documents the worker must attach to win the dispute.
4. A simple worker summary explaining what the letter says in their chosen language (${details.language || "hinglish"}).

Return STRICT JSON:
{
  "subjectLine": "Formal subject line for ticket/email",
  "recipient": "Platform Support Team / Grievance Officer / Labour Commissioner",
  "formalLetter": "Complete formal letter with placeholders filled with provided details (date, partner ID, order ID, amount)",
  "shortAppTicket": "Concise text to paste directly into in-app chat support",
  "evidenceChecklist": [
    "Item 1 (e.g. Screenshot of GPS location at delivery point)",
    "Item 2 (e.g. Order delivery completion timestamp)"
  ],
  "workerSummaryInNativeLang": "Simple explanation in ${details.language || "hinglish"} explaining what we wrote on their behalf."
}
Respond ONLY with raw JSON. No markdown codeblocks or backticks.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error in draftGrievance:", error);
    throw error;
  }
}

/**
 * 4. WELFARE & RIGHTS SCHEME VERIFIER
 * Grounded in verified schemesData.json
 */
async function checkSchemes(profile, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const prompt = `
You are the Welfare & Social Security Verification Officer for gig and informal workers.
Ground your response strictly in the following verified official schemes:
${JSON.stringify(schemesData)}

Worker Profile:
${JSON.stringify(profile)}
Target Language: ${profile.language || "hinglish"}

Analyze the worker's eligibility for each scheme:
- Check age, state, platform, occupation, and criteria.
- Only mark "Eligible" if they legitimately meet the conditions.
- Provide the verified official portal link, official helpline, and exact documents they must carry to a CSC (Common Service Centre) or apply online.
- Explain in simple words why this scheme benefits them.

Return STRICT JSON:
{
  "matchedSchemes": [
    {
      "schemeId": "e-shram / pmjay / etc.",
      "schemeName": "Full official name",
      "status": "Eligible / Likely Eligible / Ineligible",
      "benefitSummary": "e.g. ₹2 Lakh accident cover or ₹5 Lakh health insurance",
      "officialUrl": "Official website URL",
      "helpline": "Official helpline number",
      "verificationCheck": "How to verify (e.g., UAN card check)",
      "requiredDocuments": ["Doc 1", "Doc 2"],
      "stepByStepProcess": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "simpleGuidance": "Encouraging, clear explanation in ${profile.language || "hinglish"} of which scheme to apply for first and why it protects them."
}
Respond ONLY with raw JSON. No markdown codeblocks or backticks.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error in checkSchemes:", error);
    throw error;
  }
}

/**
 * 5. SITUATIONAL SAFETY & EMERGENCY ASSISTANT
 * Grounded in verified safetyData.json
 */
async function getSafetyGuidance(situation, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const prompt = `
You are the Gig Worker Emergency & Safety Companion.
Ground your emergency contacts in verified numbers:
${JSON.stringify(safetyData)}

Worker Emergency / Safety Situation:
${JSON.stringify(situation)}
Target Language: ${situation.language || "hinglish"}
${getLanguageDirective(situation.language)}

Provide:
1. Urgent 3-step immediate safety checklist (what to do in next 60 seconds).
2. Relevant verified helpline to call immediately (e.g. 112, 108, 1091, platform SOS).
3. Rights protection (e.g., how to protect themselves from platform penalties due to this emergency).
4. Plain, reassuring voice-friendly instructions in ${situation.language || "hinglish"}.

Return STRICT JSON:
{
  "immediateAction": ["Step 1", "Step 2", "Step 3"],
  "primaryEmergencyNumber": "112 / 108 / 1091",
  "emergencyServiceName": "Service name",
  "platformProtectionTip": "How to mark order/trip so platform does not penalize",
  "reassuringAdvice": "Compassionate, clear instructions in ${situation.language || "hinglish"}"
}
Respond ONLY with raw JSON. No markdown codeblocks or backticks.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleanJson = text.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error in getSafetyGuidance:", error);
    throw error;
  }
}

/**
 * 6. CONVERSATIONAL ASSISTANT (MULTILINGUAL CHAT)
 */
async function chatWithCompanion({ message, history, language }, customApiKey) {
  const client = getGeminiClient(customApiKey);
  const model = getModel(client, "gemini-2.5-flash");

  const systemInstruction = `
You are the "Gig Worker Companion" (साथी / தோழன்) — an AI assistant dedicated to delivery partners, cab/auto drivers, and daily-wage workers in India.
Target Language: ${language || "hinglish"}.
${getLanguageDirective(language)}

Key Rules:
1. Speak in friendly, respectful, simple language (Hindi, Hinglish, or English as requested).
2. Build TRUST by giving verified facts, not vague guesses. If discussing money, schemes, or rights, cite official facts (e-Shram 14434, National Emergency 112, Ayushman Bharat 14555).
3. Keep sentences short and clear (5th grade level). Workers often listen via text-to-speech while working.
4. Always end your answer with ONE clear, actionable next step.
5. If the worker reports a deduction or document, encourage them to use the Document Scanner or Grievance Drafter tab.
`;

  try {
    const chat = model.startChat({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      history: (history || []).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(message);
    return { reply: result.response.text() };
  } catch (error) {
    console.error("Error in chatWithCompanion:", error);
    throw error;
  }
}

module.exports = {
  analyzeEarnings,
  verifyDocument,
  draftGrievance,
  checkSchemes,
  getSafetyGuidance,
  chatWithCompanion,
  schemesData,
  safetyData
};
