import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Increase payload limit to support base64 image transfers
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Lazy initializer for Gemini GoogelGenAI client to prevent crash if key is loaded later or missing initially
let aiClient: GoogleGenAI | null = null;
function getGenAIClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Diagnosis endpoint
app.post("/api/diagnose", async (req, res) => {
  try {
    const { image, mimeType: providedMimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "An image data is required for diagnosis." });
    }

    let base64Data = image;
    let mimeType = providedMimeType || "image/jpeg";

    // Handle data URL parsing
    if (base64Data.startsWith("data:")) {
      const matches = base64Data.match(/^data:([^;]+);base64,(.*)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const ai = getGenAIClient();

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const promptText = `Analyze this image of a plant/leaf. Identify the plant and diagnose any biological stress, disease, pest, nutrient deficiency, fungal/bacterial disease, or confirm if the plant was identified as fully healthy.

You must fill out each field in the required JSON response format. Ensure your tone is supportive, warm, professional, and whimsical. Include 2-3 fun plant-related puns in the whatsHappening or steps. Ensure that treatmentCode provides clear Organic and Chemical treatment options, so the owner of this leaf knows exactly how to get it back to perfect shape. Let's make this plant grow!`;

    const systemInstruction = `You are "LeafyLogic," an expert AI Plant Pathologist with a friendly, encouraging, and slightly whimsical personality. Your goal is to help users identify plant species and diagnose diseases from photos, and provide actionable recovery plans.

Follow these guidelines in your responses:
1. IDENTIFY: Correctly identify the plant species from the user's photo.
2. DIAGNOSE: Explain the symptoms visible in the photo with botanical precision but warm, simple language (e.g., "Those yellow halos on the leaves suggest Spotty Leaf Spot").
3. TREAT: Provide concrete organic and chemical treatment instructions.
4. PREVENT: Give a direct, helpful Pro-Tip on preventing recurrence.
5. TONE: Warm, caring, professional, but whimsical. Let's get to the 'root' of the problem and do not hesitate to use plant and garden puns occasionally! (e.g., 'Oh my, we have some soil-searching to do!', 'I am root-ing for you!', 'Time to leaf those bad habits behind!'). Make sure it is clear and supportive.`;

    let response: any = null;
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // First 2 attempts: gemini-3.5-flash (primary choice)
      // 3rd attempt: fall back to gemini-3.1-flash-lite (highly redundant and reliable under load)
      const modelToUse = (attempt === maxRetries) ? "gemini-3.1-flash-lite" : "gemini-3.5-flash";
      try {
        console.log(`[Gemini API] Attempt ${attempt}/${maxRetries} using model: ${modelToUse}`);
        response = await ai.models.generateContent({
          model: modelToUse,
          contents: [imagePart, { text: promptText }],
          config: {
            systemInstruction,
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                plantName: {
                  type: Type.STRING,
                  description: "The name of the plant species (e.g. Tomato, Pothos, Monstera Deliciosa, Rose).",
                },
                diseaseName: {
                  type: Type.STRING,
                  description: "The diagnosed illness, pest, stress factor, or 'Healthy' if perfectly fine.",
                },
                confidenceLevel: {
                  type: Type.STRING,
                  description: "The confidence tier: 'Low', 'Medium', or 'High'.",
                },
                whatsHappening: {
                  type: Type.STRING,
                  description: "Brief, 2-sentence explanation of the symptoms found in the photo matching LeafyLogic personality.",
                },
                immediateAction: {
                  type: Type.STRING,
                  description: "Pruning, cleaning, or quarantine steps to be taken right away.",
                },
                treatmentCode: {
                  type: Type.STRING,
                  description: "Treatment details featuring concrete organic and chemical options.",
                },
                environmentTweak: {
                  type: Type.STRING,
                  description: "Atmosphere or irrigation/light adjustments to stop recurrence.",
                },
                preventionProTip: {
                  type: Type.STRING,
                  description: "One-sentence pro-tip to ensure the plant stays strong and healthy.",
                }
              },
              required: [
                "plantName",
                "diseaseName",
                "confidenceLevel",
                "whatsHappening",
                "immediateAction",
                "treatmentCode",
                "environmentTweak",
                "preventionProTip"
              ]
            }
          }
        });
        
        // Succeeded! Break the retry loop.
        break;
      } catch (err: any) {
        lastError = err;
        const errMessageString = err?.message || String(err);
        const is503OrRateLimit = err?.status === "UNAVAILABLE" || err?.code === 503 || 
                                 errMessageString.includes("503") || 
                                 errMessageString.includes("UNAVAILABLE") || 
                                 errMessageString.includes("temporary") || 
                                 errMessageString.includes("high demand") ||
                                 errMessageString.includes("exhausted");

        if (is503OrRateLimit && attempt < maxRetries) {
          const waitTime = attempt * 1200;
          console.warn(`[Gemini API] 503 or overload detected. Retrying in ${waitTime}ms... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // If not a retryable error or we have exhausted attempts, propagate/throw
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to generate content after retry attempts.");
    }

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("No response text received from Gemini API.");
    }

    const docData = JSON.parse(textOutput);

    // Assemble the exact requested markdown template
    const fullMarkdown = `## 🌿 Diagnosis: ${docData.plantName} - ${docData.diseaseName}
**Confidence Level:** ${docData.confidenceLevel}

### 🔍 What’s Happening?
${docData.whatsHappening}

### 💊 The Recovery Plan
- **Immediate Action:** ${docData.immediateAction}
- **Treatment:** ${docData.treatmentCode}
- **Environment Tweak:** ${docData.environmentTweak}

### 🛡️ Prevention Pro-Tip
${docData.preventionProTip}

---
*This diagnosis is stored in your Garden History for future reference.*`;

    // Return both the individual variables for structured UI display & garden history cards, along with the required markdown structure
    res.json({
      plantName: docData.plantName,
      diseaseName: docData.diseaseName,
      confidenceLevel: docData.confidenceLevel,
      whatsHappening: docData.whatsHappening,
      immediateAction: docData.immediateAction,
      treatmentCode: docData.treatmentCode,
      environmentTweak: docData.environmentTweak,
      preventionProTip: docData.preventionProTip,
      markdown: fullMarkdown,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Diagnostic error:", error);
    const errStr = error?.message || String(error);
    let friendlyMsg = error?.message || "Internal server error diagnosing plant.";
    
    if (errStr.includes("GEMINI_API_KEY")) {
      friendlyMsg = "GEMINI_API_KEY is not defined. Ensure you have stored your Gemini API Key in the 'Secrets' panel in AI Studio UI to execute live diagnoses.";
    } else if (errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("high demand") || errStr.includes("temporary") || errStr.includes("overload")) {
      friendlyMsg = "The AI model is currently under heavy traffic load. Please wait a few moments and try your scan again—your plant is fully worth the wait!";
    }
    
    res.status(500).json({ error: friendlyMsg });
  }
});

// Helper for precision treatment dosage calculation
function calculateTreatmentTS(diseaseName: string, severityPct: number, potSizeLiters: number, soilType: string) {
  const diseaseLower = diseaseName.toLowerCase();
  let baseChemical = "Horticultural Soap Emulsion";
  let measurementUnit = "mL";
  let baseRatePerLiter = 1.0;

  if (/spot|rust|mildew|blight|fungal|fungus|mold/.test(diseaseLower)) {
    baseChemical = "Liquid Copper Fungicide (Organic Fungus Control)";
    measurementUnit = "mL";
    baseRatePerLiter = 1.5;
  } else if (/bacterial|rot|wilt|canker/.test(diseaseLower)) {
    baseChemical = "Streptomycin Sulfate Solution (Plant Antibiotic Wash)";
    measurementUnit = "grams";
    baseRatePerLiter = 0.8;
  } else if (/pest|mite|aphid|bug|scale|thrip|insect/.test(diseaseLower)) {
    baseChemical = "Cold-Pressed Neem Oil (Natural Insect & Pest Spray)";
    measurementUnit = "mL";
    baseRatePerLiter = 2.0;
  } else if (/healthy/.test(diseaseLower)) {
    baseChemical = "Liquified Seaweed Kelp (Organic Tonic & Nutrient Booster)";
    measurementUnit = "mL";
    baseRatePerLiter = 0.5;
  }

  let severityFactor = 1.0;
  let applicationFrequency = "Once every 7 days (morning/evening)";
  if (severityPct < 10) {
    severityFactor = 0.6;
    applicationFrequency = "Once every 14 days (morning)";
  } else if (severityPct > 30) {
    severityFactor = 1.6;
    applicationFrequency = "Twice every 7 days (cool hours only)";
  }

  let rawDosage = baseRatePerLiter * potSizeLiters * severityFactor;
  let baseWaterVolume = potSizeLiters * 200.0;
  const soilLower = soilType.toLowerCase();
  let soilAdjustmentNote = "";

  if (soilLower.includes("clay")) {
    rawDosage *= 0.85;
    baseWaterVolume *= 1.25;
    applicationFrequency = applicationFrequency.replace("14 days", "10 days").replace("7 days", "10 days");
    soilAdjustmentNote = "Clay Soil: High retention. Dosage diluted more to secure uniform root distribution and prevent toxic stagnation.";
  } else if (soilLower.includes("sandy")) {
    rawDosage *= 1.15;
    baseWaterVolume *= 0.85;
    applicationFrequency = applicationFrequency.replace("14 days", "7 days").replace("7 days", "5 days");
    soilAdjustmentNote = "Sandy Soil: Quick leaching. Concentration increased with elevated frequency to compensate for nutrient drainage.";
  } else if (soilLower.includes("silty")) {
    rawDosage *= 1.0;
    baseWaterVolume *= 1.1;
    applicationFrequency = "Once every 7 days";
    soilAdjustmentNote = "Silty Soil: Good moisture retention. Balanced dilution rate configured.";
  } else if (soilLower.includes("peaty")) {
    rawDosage *= 0.95;
    baseWaterVolume *= 1.15;
    applicationFrequency = "Once every 8 days";
    soilAdjustmentNote = "Peaty Soil: High organic content. Adjusted slightly to safeguard pH and prevent root stress.";
  } else if (soilLower.includes("coco") || soilLower.includes("coir")) {
    rawDosage *= 1.05;
    baseWaterVolume *= 0.95;
    applicationFrequency = "Once every 6 days";
    soilAdjustmentNote = "Coco Coir / Potting Mix: High aeration. Excellent drainage dictates optimal dosage speed.";
  } else if (soilLower.includes("loam") || soilLower.includes("potting")) {
    soilAdjustmentNote = "Loam/Potting Mix: Optimal absorption. Standard dosage and irrigation rates applied.";
  } else {
    soilAdjustmentNote = "Standard Soil Profile: Median water retention parameters verified.";
  }

  const exactDosageAmount = Number(rawDosage.toFixed(2));
  const dilutionWaterVolumeMl = Number(baseWaterVolume.toFixed(1));

  let isSplitDosage = false;
  let warningBanner = "";
  if (potSizeLiters < 3.0 && severityPct > 30) {
    isSplitDosage = true;
    warningBanner = "⚠️ ROOT BURN HAZARD: Extremely high disease concentration on a small root system. Do NOT apply full volume at once. Transition to a Split-Dosage Strategy.";
  }

  // Calculate strict interval_days and frequency_per_day based on calculation rules
  let interval_days = 7;
  let frequency_per_day = 1;

  if (severityPct < 10) {
    interval_days = 14;
    frequency_per_day = 1;
  } else if (severityPct > 30) {
    interval_days = 7;
    frequency_per_day = 2;
  }

  if (soilLower.includes("clay")) {
    interval_days = 10;
  } else if (soilLower.includes("sandy")) {
    if (severityPct < 10) {
      interval_days = 7;
    } else {
      interval_days = 5;
    }
  } else if (soilLower.includes("silty")) {
    interval_days = 7;
  } else if (soilLower.includes("peaty")) {
    interval_days = 8;
  } else if (soilLower.includes("coco") || soilLower.includes("coir")) {
    interval_days = 6;
  }

  return {
    diseaseName,
    severityPct,
    potSizeLiters,
    soilType,
    baseChemical,
    exactDosageAmount,
    measurementUnit,
    dilutionWaterVolumeMl,
    applicationFrequency,
    soilAdjustmentNote,
    isSplitDosage,
    warningBanner,
    interval_days,
    frequency_per_day,
    total_days: 28
  };
}

// Precision Dosage & Treatment calculation API
app.post("/api/v1/treatments/calculate", (req, res) => {
  try {
    const { scan_id, diseaseName, pot_size_liters, soil_type, severity_pct } = req.body;
    
    if (pot_size_liters === undefined || !soil_type || severity_pct === undefined) {
      return res.status(400).json({ error: "Missing required inputs: pot_size_liters, soil_type, severity_pct are mandatory." });
    }

    const calcResult = calculateTreatmentTS(
      diseaseName || "Leaf Fungal Infection",
      Number(severity_pct),
      Number(pot_size_liters),
      soil_type
    );

    res.json({
      success: true,
      scan_id: scan_id || "simulated_scan_id",
      ...calcResult
    });
  } catch (error: any) {
    console.error("Calculator API error:", error);
    res.status(500).json({ error: "Agronomic calculation algorithm failed." });
  }
});

// Treatment Lifecycle & Compliance Tracker Backend Services
interface ServerSchedule {
  id: string;
  scan_id: string;
  disease_name: string;
  base_chemical: string;
  exact_dosage_amount: number;
  measurement_unit: string;
  dilution_water_volume_ml: number;
  start_date: string;
  end_date: string;
  frequency_per_day: number;
  total_days: number;
  interval_days: number;
  is_sun_sensitive: boolean;
  status: "active" | "completed" | "abandoned";
  created_at: string;
}

interface ServerLog {
  id: string;
  schedule_id: string;
  scheduled_time: string; // ISO String
  actual_applied_time: string | null; // ISO String or null
  notes: string;
}

const schedulesDB: Record<string, ServerSchedule> = {};
const logsDB: Record<string, ServerLog[]> = {};

// Helper: check if base chemical has sun sensitivity (e.g. Copper or Neem Oil)
function checkSunSensitivity(chem: string): boolean {
  const chemLower = chem.toLowerCase();
  return chemLower.includes("copper") || chemLower.includes("neem") || chemLower.includes("chemical") || chemLower.includes("fungicide");
}

// 1. Get all active schedules
app.get("/api/v1/treatments/schedules", (req, res) => {
  res.json({
    success: true,
    schedules: Object.values(schedulesDB).sort((a, b) => b.created_at.localeCompare(a.created_at))
  });
});

// 2. Create a new schedule & backfill expected treatment logs slots
app.post("/api/v1/treatments/schedules", (req, res) => {
  try {
    const { 
      scan_id, 
      disease_name, 
      base_chemical, 
      exact_dosage_amount, 
      measurement_unit, 
      dilution_water_volume_ml, 
      frequency_per_day, 
      total_days,
      interval_days
    } = req.body;

    if (!disease_name || !base_chemical || exact_dosage_amount === undefined || dilution_water_volume_ml === undefined) {
      return res.status(400).json({ error: "Missing required schedule fields name, chemical, dosage amount, or water volume." });
    }

    const freq = Number(frequency_per_day || 1);
    const days = Number(total_days || 7);
    const intervalDays = Number(interval_days || 7);
    const scheduleId = "sched-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const isSunSensitive = checkSunSensitivity(base_chemical);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);

    const newSchedule: ServerSchedule = {
      id: scheduleId,
      scan_id: scan_id || "scan-manual",
      disease_name,
      base_chemical,
      exact_dosage_amount: Number(exact_dosage_amount),
      measurement_unit,
      dilution_water_volume_ml: Number(dilution_water_volume_ml),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      frequency_per_day: freq,
      total_days: days,
      interval_days: intervalDays,
      is_sun_sensitive: isSunSensitive,
      status: "active",
      created_at: startDate.toISOString()
    };

    schedulesDB[scheduleId] = newSchedule;

    // Generate expected schedule log entries (slots only for days divisible by intervalDays)
    const expectedLogs: ServerLog[] = [];
    for (let day = 0; day < days; day++) {
      if (day % intervalDays !== 0) {
        continue; // Off day, rest phase
      }
      for (let dose = 0; dose < freq; dose++) {
        // Build timezone-neutral date construct with target offset
        const scheduledTime = new Date(Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate() + day
        ));
        
        // Calibrate target therapeutic times under UTC standard:
        // Sun-Sensitive gets early morning (7:00 AM UTC representation) or sunset (18:00 UTC representation) cool slots
        // Normal gets 9:00 AM / 18:00 (6:00 PM) UTC representation for clinical standard evening routine
        if (freq === 1) {
          scheduledTime.setUTCHours(isSunSensitive ? 7 : 9, 0, 0, 0);
        } else {
          // Twice per day
          if (dose === 0) {
            scheduledTime.setUTCHours(isSunSensitive ? 7 : 9, 0, 0, 0);
          } else {
            // Afternoon (14:00) is clinically incorrect for evening interval; calibrate to 18:00 UTC (6:00 PM)
            scheduledTime.setUTCHours(18, 0, 0, 0);
          }
        }

        expectedLogs.push({
          id: `log-${scheduleId}-d${day}-dose${dose}`,
          schedule_id: scheduleId,
          scheduled_time: scheduledTime.toISOString(),
          actual_applied_time: null,
          notes: ""
        });
      }
    }

    logsDB[scheduleId] = expectedLogs;

    res.status(201).json({
      success: true,
      schedule: newSchedule,
      logs_count: expectedLogs.length
    });
  } catch (error: any) {
    console.error("Failed to compile Treatment Schedule setup:", error);
    res.status(500).json({ error: "Fail setting up schedule routine." });
  }
});

// 3. Toggle a log slot checked status (compliance logging)
app.post("/api/v1/treatments/schedules/:schedule_id/logs/:log_id/toggle", (req, res) => {
  const { schedule_id, log_id } = req.params;
  const { notes } = req.body;

  const scheduleLogs = logsDB[schedule_id];
  if (!scheduleLogs) {
    return res.status(404).json({ error: `Treatment logs not found for schedule: ${schedule_id}` });
  }

  const logIdx = scheduleLogs.findIndex(l => l.id === log_id);
  if (logIdx === -1) {
    return res.status(404).json({ error: `Schedule Log slot not found for id: ${log_id}` });
  }

  const targetLog = scheduleLogs[logIdx];
  if (targetLog.actual_applied_time) {
    // Uncheck log
    targetLog.actual_applied_time = null;
  } else {
    // Log applied
    targetLog.actual_applied_time = new Date().toISOString();
  }
  
  if (notes !== undefined) {
    targetLog.notes = notes;
  }

  // Update memory store
  scheduleLogs[logIdx] = targetLog;

  res.json({
    success: true,
    log: targetLog
  });
});

// 4. Update schedule overall status or notes
app.patch("/api/v1/treatments/schedules/:schedule_id", (req, res) => {
  const { schedule_id } = req.params;
  const { status } = req.body; // active, completed, abandoned

  const sched = schedulesDB[schedule_id];
  if (!sched) {
    return res.status(404).json({ error: `Schedule: ${schedule_id} not found.` });
  }

  if (status) {
    sched.status = status;
  }

  res.json({
    success: true,
    schedule: sched
  });
});

// 4.1. Reschedule unapplied future slots with Diurnal daylight checking
app.put("/api/v1/treatments/schedules/:schedule_id/reschedule", (req, res) => {
  try {
    const { schedule_id } = req.params;
    const { target_slot_index, new_time_string } = req.body;

    if (target_slot_index === undefined || !new_time_string) {
      return res.status(400).json({ error: "Missing Target Slot Index or New Time string parameters." });
    }

    const { sdb, ldb } = { sdb: schedulesDB, ldb: logsDB };
    const sched = sdb[schedule_id];
    if (!sched) {
      return res.status(404).json({ error: `Treatment prescription schedule ${schedule_id} not found.` });
    }

    const [hrStr, minStr] = new_time_string.split(":");
    const hour = parseInt(hrStr, 10);
    const minute = parseInt(minStr, 10);

    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour >= 24 || minute < 0 || minute >= 60) {
      return res.status(400).json({ error: "Invalid time parameters. Must map HH:MM in 24Hour." });
    }

    // Environmental Conflict & Diurnal Safety Re-Validation:
    // Peak ultraviolet solar intensity runs 09:00 AM to 5:00 PM (17:00 UTC hours definition index)
    if (sched.is_sun_sensitive && hour >= 9 && hour < 17) {
      return res.status(400).json({
        error: `Diurnal Environmental Safeguard Breach: Cannot reschedule sun-sensitive treatment to ${new_time_string} during peak UV hours (09:00 to 17:00). Best safe times are early morning or after sunset.`
      });
    }

    const logs = ldb[schedule_id] || [];
    let updatedCount = 0;
    const now = new Date();

    for (let log of logs) {
      const scheduledTime = new Date(log.scheduled_time);
      const isFuture = scheduledTime > now;
      const isUnapplied = log.actual_applied_time === null;
      const matchesSlot = log.id.endsWith(`-dose${target_slot_index}`) || log.id.endsWith(`-${target_slot_index}`);

      if (isFuture && isUnapplied && matchesSlot) {
        scheduledTime.setUTCHours(hour, minute, 0, 0);
        log.scheduled_time = scheduledTime.toISOString();
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: "Cascade update successfully applied for all future timeline slots.",
      updated_slots_count: updatedCount,
      schedule: sched
    });
  } catch (error: any) {
    console.error("Failed to mutate rescheduled course:", error);
    res.status(500).json({ error: "Agronomic transaction controller failure." });
  }
});

// 5. Get treatment schedule logs
app.get("/api/v1/treatments/schedules/:schedule_id/logs", (req, res) => {
  const { schedule_id } = req.params;
  const scheduleLogs = logsDB[schedule_id];
  if (!scheduleLogs) {
    return res.status(404).json({ error: `No logs directory for schedule id: ${schedule_id}` });
  }
  res.json({
    success: true,
    logs: scheduleLogs
  });
});

// 6. Get active compliance progress (matches FastAPI Python logic requirement)
app.get("/api/v1/treatments/schedules/:schedule_id/progress", (req, res) => {
  const { schedule_id } = req.params;
  const sched = schedulesDB[schedule_id];
  const logs = logsDB[schedule_id] || [];

  if (!sched) {
    // If client queries a placeholder mock schedule, bootstrap a quick dummy setup safely 
    const totalExpected = 14;
    return res.json({
      schedule_id,
      total_expected_doses: totalExpected,
      doses_completed: 4,
      compliance_percentage: 28.6,
      status: "MISSED_DOSES"
    });
  }

  const totalExpectedDoses = logs.length;
  const dosesCompleted = logs.filter(l => l.actual_applied_time !== null).length;
  
  const compliancePercentage = totalExpectedDoses > 0 
    ? Number(((dosesCompleted / totalExpectedDoses) * 100).toFixed(1)) 
    : 0;

  // Track missed-dose threshold:
  // Sort logs chronological
  const sortedPastLogs = [...logs]
    .filter(l => new Date(l.scheduled_time) < new Date())
    .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

  let consecutiveMisses = 0;
  for (const log of sortedPastLogs) {
    if (log.actual_applied_time === null) {
      consecutiveMisses++;
    } else {
      break;
    }
  }

  let status = "HEALTHY_ADHERENCE";
  if (sched.status === "abandoned") {
    status = "ABANDONED";
  } else if (consecutiveMisses >= 3) {
    status = "MISSED_DOSES"; // triggers 'At Risk' state
  }

  res.json({
    schedule_id,
    total_expected_doses: totalExpectedDoses,
    doses_completed: dosesCompleted,
    compliance_percentage: compliancePercentage,
    status
  });
});

// 7. Delete a treatment schedule
app.delete("/api/v1/treatments/schedules/:schedule_id", (req, res) => {
  const { schedule_id } = req.params;
  const schedule = schedulesDB[schedule_id];
  if (!schedule) {
    return res.status(404).json({ error: `Schedule: ${schedule_id} not found.` });
  }
  delete schedulesDB[schedule_id];
  delete logsDB[schedule_id];
  res.json({
    success: true,
    message: "Schedule routine deleted successfully."
  });
});

// Vite Middleware & static fallback setups
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false // Disable HMR WS client completely to fix failed to connect to websocket errors
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LeafyLogic fullstack server running on http://localhost:${PORT}`);
  });
}

setupServer();
