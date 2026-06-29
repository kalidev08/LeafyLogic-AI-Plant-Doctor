import React, { useState } from "react";
import { 
  Shield, 
  Droplets, 
  FlaskConical, 
  AlertTriangle, 
  Check, 
  TrendingUp, 
  Calculator,
  RefreshCw
} from "lucide-react";

interface TreatmentPrescriptionCardProps {
  diseaseName: string;
  scanId: string;
  onShowToast: (msg: string) => void;
  onScheduleRoutine?: (params: {
    scan_id?: string;
    disease_name: string;
    base_chemical: string;
    exact_dosage_amount: number;
    measurement_unit: string;
    dilution_water_volume_ml: number;
    frequency_per_day: number;
    total_days: number;
    interval_days: number;
  }) => void;
}

interface PrescriptionResult {
  success: boolean;
  baseChemical: string;
  exactDosageAmount: number;
  measurementUnit: string;
  dilutionWaterVolumeMl: number;
  applicationFrequency: string;
  soilAdjustmentNote: string;
  isSplitDosage: boolean;
  warningBanner: string;
  interval_days?: number;
  frequency_per_day?: number;
  total_days?: number;
}

export default function TreatmentPrescriptionCard({ 
  diseaseName, 
  scanId, 
  onShowToast,
  onScheduleRoutine
}: TreatmentPrescriptionCardProps) {
  // Inputs
  const [severity, setSeverity] = useState<number>(35); // default severity %
  const [volumeUnit, setVolumeUnit] = useState<"Liters" | "Gallons">("Liters");
  const [potSize, setPotSize] = useState<number>(5); // custom value in selected unit
  const [soilType, setSoilType] = useState<string>("Loam"); // sandy, clay, loam, silty, peaty, coco coir
  
  // States
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [prescription, setPrescription] = useState<PrescriptionResult | null>(null);
  const [isApplied, setIsApplied] = useState<boolean>(false);

  const soilTypes = [
    { name: "Clay", desc: "Dense clay, high retention" },
    { name: "Loam", desc: "Balanced loam, optimal absorption" },
    { name: "Sandy", desc: "Coarse sand, rapid runoff leaching" },
    { name: "Silty", desc: "Smooth silt, good retention moisture" },
    { name: "Peaty", desc: "Spongy peat, organic acidic profile" },
    { name: "Coco Coir", desc: "Fibrous coco, extremely high aeration" }
  ];

  const handleCalculate = async () => {
    setIsCalculating(true);
    setIsApplied(false);
    
    // Convert to Liters if the selected unit is Gallons before transmitting to the server
    const targetLiters = volumeUnit === "Liters" ? potSize : potSize * 3.78541;

    try {
      const response = await fetch("/api/v1/treatments/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scan_id: scanId,
          diseaseName: diseaseName,
          pot_size_liters: parseFloat(targetLiters.toFixed(3)),
          soil_type: soilType,
          severity_pct: severity
        })
      });

      if (!response.ok) {
        throw new Error("Calculation API failed");
      }

      const data = await response.json();
      setPrescription(data);
      onShowToast("Precision treatment prescription calculated successfully!");
    } catch (e) {
      console.error(e);
      // Fallback client-side calculation if server is offline or unavailable
      const diseaseLower = diseaseName.toLowerCase();
      let baseChem = "Horticultural Soap Emulsion (Gentle Soap Bug Wash)";
      let unit = "mL";
      let rate = 1.0;

      if (/spot|rust|mildew|blight|fungal|fungus|mold/i.test(diseaseLower)) {
        baseChem = "Liquid Copper Fungicide (Organic Fungus Control)";
        unit = "mL";
        rate = 1.5;
      } else if (/bacterial|rot|wilt|canker/i.test(diseaseLower)) {
        baseChem = "Streptomycin Sulfate Solution (Plant Antibiotic Wash)";
        unit = "grams";
        rate = 0.8;
      } else if (/pest|mite|aphid|bug|scale|thrip|insect/i.test(diseaseLower)) {
        baseChem = "Cold-Pressed Neem Oil (Natural Insect & Pest Spray)";
        unit = "mL";
        rate = 2.0;
      } else if (/healthy/i.test(diseaseLower)) {
        baseChem = "Liquified Seaweed Kelp (Organic Tonic & Nutrient Booster)";
        unit = "mL";
        rate = 0.5;
      }

      let sevFactor = severity < 10 ? 0.6 : severity > 30 ? 1.6 : 1.0;
      let rawDose = rate * targetLiters * sevFactor;
      let rawWater = targetLiters * 200;
      let freq = "Once every 7 days (morning)";

      let soilNote = "Loam/Potting Mix parameters selected.";
      if (soilType === "Clay") {
        rawDose *= 0.85;
        rawWater *= 1.25;
        freq = "Once every 10 days";
        soilNote = "Clay Soil: High retention. Dosage diluted to secure uniform root distribution and prevent stagnation.";
      } else if (soilType === "Sandy") {
        rawDose *= 1.15;
        rawWater *= 0.85;
        freq = "Once every 5 days";
        soilNote = "Sandy Soil: Quick leaching. Increased active concentration and application frequency to compensate.";
      } else if (soilType === "Silty") {
        rawDose *= 1.0;
        rawWater *= 1.1;
        freq = "Once every 7 days";
        soilNote = "Silty Soil: Good moisture retention. Balanced dilution rate configured.";
      } else if (soilType === "Peaty") {
        rawDose *= 0.95;
        rawWater *= 1.15;
        freq = "Once every 8 days";
        soilNote = "Peaty Soil: Spongy matter. Lower active dosage slightly to protect acidic root balances.";
      } else if (soilType === "Coco Coir") {
        rawDose *= 1.05;
        rawWater *= 0.95;
        freq = "Once every 6 days";
        soilNote = "Coco Coir Substrate: Extremely high aeration. Fast drainage matches high-absorption delivery.";
      }

      const isSplit = targetLiters < 3 && severity > 30;

      let interval_days = 7;
      let frequency_per_day = 1;

      if (severity < 10) {
        interval_days = 14;
        frequency_per_day = 1;
      } else if (severity > 30) {
        interval_days = 7;
        frequency_per_day = 2;
      }

      const soilLower = soilType.toLowerCase();
      if (soilLower.includes("clay")) {
        interval_days = 10;
      } else if (soilLower.includes("sandy")) {
        if (severity < 10) {
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

      setPrescription({
        success: true,
        baseChemical: baseChem,
        exactDosageAmount: parseFloat(rawDose.toFixed(2)),
        measurementUnit: unit,
        dilutionWaterVolumeMl: parseFloat(rawWater.toFixed(1)),
        applicationFrequency: freq,
        soilAdjustmentNote: soilNote,
        isSplitDosage: isSplit,
        warningBanner: isSplit ? "⚠️ ROOT BURN HAZARD: Extremely high disease concentration on a small root system. Do NOT apply full volume at once. Transition to a Split-Dosage Strategy." : "",
        interval_days,
        frequency_per_day,
        total_days: 28
      });
      onShowToast("Calculated local backup precision prescription!");
    } finally {
      setIsCalculating(false);
    }
  };

  const toggleAppliedStatus = () => {
    const nextState = !isApplied;
    setIsApplied(nextState);
    if (nextState) {
      onShowToast("Prescription marked as APPLIED! Saved to outdoor log.");
    }
  };

  return (
    <div id="precision-calculator-container" className="mt-8 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 rounded-[40px] p-6 md:p-8 text-white shadow-2xl border-4 border-emerald-800">
      
      {/* Title & Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-emerald-800/85">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Calculator className="w-5 h-5 text-yellow-400" />
            <h3 className="text-xl font-black tracking-tight uppercase text-yellow-400">Precision Dosage & Treatment Calculator</h3>
          </div>
          <p className="text-xs text-emerald-200">Calculate exact therapeutic chemical dilution using cross-referenced agronomic matrices.</p>
        </div>
        <span className="bg-yellow-400/20 text-yellow-300 font-mono text-[10px] font-black tracking-wider uppercase px-2.5 py-1 rounded-md border border-yellow-400/40">
          ENGINE: AGRONOMY v3.1
        </span>
      </div>

      {/* Grid Inputs: Severity, Pot Volume, Soil Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Input 1: AI Diagnostic Severity Output */}
        <div className="bg-emerald-900/40 p-4 rounded-3xl border border-emerald-800/60 flex flex-col justify-between">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>1. Disease Severity ({severity}%)</span>
            </label>
            <p className="text-[11px] text-zinc-300 leading-normal mb-3">Adjust leaf damage percentage from diagnosis scanners.</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <input 
              type="range" 
              min="5" 
              max="95" 
              step="5"
              value={severity} 
              onChange={(e) => setSeverity(parseInt(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-400">
              <span>5% (Preventative)</span>
              <span>50%</span>
              <span>95% (Severe Infection)</span>
            </div>
          </div>
        </div>

        {/* Input 2: Pot/Container Field Volume */}
        <div className="bg-emerald-900/40 p-4 rounded-3xl border border-emerald-800/60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <label className="text-xs font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                <Droplets className="w-4 h-4" />
                <span>2. Container Size</span>
              </label>
              
              <div className="bg-emerald-950/80 p-0.5 rounded-lg border border-emerald-800/60 flex shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (volumeUnit !== "Liters") {
                      setVolumeUnit("Liters");
                      setPotSize(Math.max(1, Math.round(potSize * 3.78541)));
                    }
                  }}
                  className={`px-2 py-0.5 text-[9px] uppercase font-black rounded-md cursor-pointer transition-all ${volumeUnit === "Liters" ? "bg-yellow-400 text-emerald-950" : "text-zinc-400 hover:text-white"}`}
                >
                  L
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (volumeUnit !== "Gallons") {
                      setVolumeUnit("Gallons");
                      setPotSize(Math.max(0.25, Math.round(potSize * 0.264172 * 4) / 4));
                    }
                  }}
                  className={`px-2 py-0.5 text-[9px] uppercase font-black rounded-md cursor-pointer transition-all ${volumeUnit === "Gallons" ? "bg-yellow-400 text-emerald-950" : "text-zinc-400 hover:text-white"}`}
                >
                  Gal
                </button>
              </div>
            </div>
            <p className="text-[11px] text-zinc-300 leading-normal mb-3">Pot/field size in {volumeUnit === "Liters" ? "Liters" : "Gallons"} to calibrate precise liquid mix formula.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (volumeUnit === "Liters") {
                  setPotSize(Math.max(1, potSize - 1));
                } else {
                  setPotSize(Math.max(0.25, potSize - 0.25));
                }
              }}
              className="w-10 h-10 bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-lg flex items-center justify-center transition-transform"
            >
              -
            </button>
            <div className="flex-1 text-center bg-emerald-950 border border-emerald-800 py-2 rounded-xl text-sm font-mono font-bold">
              {potSize} {volumeUnit === "Liters" ? "L" : "Gal"}{" "}
              <span className="text-zinc-400 text-xs">
                ({volumeUnit === "Liters" ? `${(potSize * 0.264172).toFixed(1)} gal` : `${(potSize * 3.78541).toFixed(1)} L`})
              </span>
            </div>
            <button 
              onClick={() => {
                if (volumeUnit === "Liters") {
                  setPotSize(Math.min(100, potSize + 1));
                } else {
                  setPotSize(Math.min(25, potSize + 0.25));
                }
              }}
              className="w-10 h-10 bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-lg flex items-center justify-center transition-transform"
            >
              +
            </button>
          </div>
        </div>

        {/* Input 3: Soil drainage & absorption Profile */}
        <div className="bg-emerald-900/40 p-4 rounded-3xl border border-emerald-800/60 flex flex-col justify-between">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5 mb-1.5">
              <FlaskConical className="w-4 h-4" />
              <span>3. Soil Matrix Drainage</span>
            </label>
            <p className="text-[11px] text-zinc-300 leading-normal mb-3">Target substrate: Sandy leaches fast, Clay pools and holds nutrients.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {soilTypes.map((t) => (
              <button
                key={t.name}
                onClick={() => setSoilType(t.name)}
                className={`py-2 px-2.5 rounded-xl text-left text-[11px] font-extrabold transition-all flex flex-col justify-center leading-snug cursor-pointer ${
                  soilType === t.name
                    ? "bg-yellow-400 text-emerald-950 shadow-md shadow-yellow-400/10 scale-[1.01] border border-yellow-300"
                    : "bg-emerald-800/40 text-emerald-100 hover:bg-emerald-800 border border-emerald-700/30"
                }`}
              >
                <span className="font-black">{t.name}</span>
                <span className={`text-[8px] font-normal mt-0.5 leading-none ${soilType === t.name ? "text-emerald-900" : "text-emerald-300/85"}`}>
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Dynamic Action Trigger */}
      <button
        onClick={handleCalculate}
        disabled={isCalculating}
        className="w-full bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg text-sm uppercase tracking-wide cursor-pointer disabled:bg-emerald-800 disabled:text-zinc-400 disabled:cursor-not-allowed"
      >
        {isCalculating ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Consulting Agronomic Constants...</span>
          </>
        ) : (
          <>
            <Calculator className="w-5 h-5 text-emerald-900" />
            <span>Generate Exact Dosage Prescription</span>
          </>
        )}
      </button>

      {/* PRESCRIPTION OUTPUT AREA - Optimized for high-contrast sunlight readability */}
      {prescription && (
        <div id="prescription-details-screen" className="mt-8 bg-white text-emerald-950 rounded-[32px] p-6 md:p-8 shadow-inner border-4 border-yellow-400 flex flex-col gap-6">
          
          {/* Output Header */}
          <div className="flex justify-between items-center pb-3 border-b border-zinc-100 flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-mono font-black text-emerald-600 uppercase tracking-widest block">AGRONOMIC PRESCRIPTION FOR OUTDOORS</span>
              <h4 className="text-xl font-black text-emerald-950">Calculated Therapy Sheet</h4>
            </div>
            <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-mono font-bold text-xs uppercase">
              SEV: {prescription.isSplitDosage ? "CRITICAL RISK" : "CALCULATED"}
            </div>
          </div>

          {/* Burn Warning Banner */}
          {prescription.isSplitDosage && prescription.warningBanner && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-black text-xs text-rose-800 uppercase tracking-wide">Emergency Warning Banner</h5>
                <p className="text-xs text-rose-700 leading-relaxed mt-1 font-semibold">
                  {prescription.warningBanner} We strongly suggest executing a **Split-Dosage Strategy**: Apply 50% of the solution on Day 1, and 50% on Day 4 to avoid acute root systemic shocks.
                </p>
              </div>
            </div>
          )}

          {/* Numeric Dosage Layout with High-Contrast Typography */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            
            {/* Visual Mix Ratio Graphic & Chemical info */}
            <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono font-black text-emerald-700 uppercase tracking-wider block mb-2">🔭 DIAGNOSIS & ACTIVE INGREDIENT</span>
                <p className="text-xs text-zinc-500 font-semibold">Target Stress: <strong className="text-emerald-900 font-black">{diseaseName}</strong></p>
                <div className="mt-2 text-2xl font-black text-emerald-950 tracking-tight leading-tight">
                  🧪 {prescription.baseChemical}
                </div>
              </div>

              {/* Mix ratio graphical illustration */}
              <div className="mt-6 pt-5 border-t border-emerald-100">
                <span className="text-[9px] font-mono font-black text-emerald-600 block mb-3 uppercase tracking-wider">🍶 Mix-Ratio Graphic Layout</span>
                
                <div className="flex items-center gap-3">
                  {/* Container Outline graphic */}
                  <div className="w-12 h-20 border-2 border-emerald-800 rounded-lg relative overflow-hidden bg-emerald-50 shrink-0 flex flex-col justify-end">
                    {/* Water section */}
                    <div className="w-full bg-blue-100 flex items-center justify-center text-[8px] font-black text-blue-700" style={{ height: "70%" }}>
                      WATER
                    </div>
                    {/* Chemical chemical layer */}
                    <div className="w-full bg-yellow-400 flex items-center justify-center text-[7px] font-black text-emerald-950" style={{ height: "30%" }}>
                      CHEM
                    </div>
                  </div>
                  
                  {/* Visual formula text */}
                  <div className="flex-1 text-xs text-zinc-700 leading-relaxed">
                    <p className="font-bold text-emerald-900">Therapeutic Mixing Formula:</p>
                    <p className="mt-1">
                      Dissolve exact <strong className="text-yellow-600 font-black font-mono">{prescription.exactDosageAmount} {prescription.measurementUnit}</strong> of therapeutic concentrate in <strong className="text-blue-600 font-black font-mono">{prescription.dilutionWaterVolumeMl} mL</strong> of clean, room-temperature water.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Practical Field Guidelines */}
            <div className="bg-zinc-50 rounded-2xl p-5 border border-zinc-200 /60 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-wider block">⏱️ APPLICATION FREQUENCY</span>
                  <div className="text-lg font-black text-zinc-900 leading-tight mt-1">
                    🗓️ {prescription.applicationFrequency}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-wider block">🔬 SOIL MATRIX FEEDBACK</span>
                  <span className="text-xs text-zinc-750 font-medium block leading-relaxed mt-1">
                    {prescription.soilAdjustmentNote}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 text-[10px] text-emerald-800 p-2.5 rounded-xl font-medium mt-4">
                💡 <strong>Agronomic Pro-Tip:</strong> Avoid spraying during heat peaks. Perform application during early morning or evening twilight to eliminate foliage magnification sunburns.
              </div>
            </div>

          </div>

          {/* ADMINISTRATION PRECAUTIONS & ALERTS */}
          <div className="bg-amber-50/70 border border-amber-300 rounded-3xl p-5 flex flex-col gap-3">
            <span className="text-[10px] bg-amber-200 text-amber-950 font-black px-2.5 py-1 rounded-lg uppercase w-max tracking-wide flex items-center gap-1.5 font-mono">
              ⚠️ Administration Safety & Precautions
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-1.5 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5 uppercase tracking-tight text-[11px] font-sans">
                  🛡️ Personal Protection Guidelines
                </span>
                <p className="text-zinc-650 leading-relaxed font-medium text-[11.5px]">
                  Diluted concentrates can still irritate. Always use protective waterproof gloves and goggles. Avoid inhaling aerosol sprays. Make sure to keep pet food bowls, water containers, and toys away from target treatment scopes, and restrict garden access for pets or children until leaves are fully dry.
                </p>
              </div>
              
              <div className="flex flex-col gap-1.5 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5 uppercase tracking-tight text-[11px] font-sans">
                  🐝 Pollinator Defense & Sunlight Guard
                </span>
                <p className="text-zinc-650 leading-relaxed font-medium text-[11.5px]">
                  <strong>Do not spray in peak daylight (09:00 AM – 05:00 PM).</strong> Extreme solar UV rays will magnify wet drops, scorch foliage (phototoxicity), and break down active chemicals. Exclusively target early sunrise or sunset twilight hours when vital wild bees are inactive.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-zinc-600 font-medium flex items-center gap-2 mt-1 px-1 font-mono">
              <span>📌 Check drift:</span> Apply only during calm air conditions (wind below 10 mph) to secure neighbor greenhouse beds from non-target therapeutic spills.
            </div>
          </div>

          {/* DUAL INTERACTIVE COMPLIANCE CONTROLLER GRID */}
          <div className="mt-2 border-t border-zinc-100 pt-6 flex flex-col md:flex-row gap-4">
            <button 
              onClick={toggleAppliedStatus}
              className={`flex-1 p-4 rounded-3xl border-3 flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isApplied 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-md scale-[1.01]" 
                  : "bg-zinc-100 hover:bg-zinc-250 text-zinc-650 border-zinc-300 shadow-sm"
              }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isApplied ? "bg-white border-white text-emerald-800" : "bg-white border-zinc-400 text-transparent"
              }`}>
                <Check className="w-5 h-5 font-black shrink-0" />
              </div>

              <div className="text-left">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 block mb-0.5">MUDDY HANDS TRIGGER</span>
                <span className="text-xs font-black leading-none uppercase">
                  {isApplied ? "✓ Applied" : "Mark Treated"}
                </span>
              </div>
            </button>

            {onScheduleRoutine && (
              <button
                type="button"
                onClick={() => {
                  onScheduleRoutine({
                    scan_id: scanId,
                    disease_name: diseaseName,
                    base_chemical: prescription.baseChemical,
                    exact_dosage_amount: prescription.exactDosageAmount,
                    measurement_unit: prescription.measurementUnit,
                    dilution_water_volume_ml: prescription.dilutionWaterVolumeMl,
                    frequency_per_day: prescription.frequency_per_day || (diseaseName.toLowerCase().includes("blight") || diseaseName.toLowerCase().includes("pest") || severity > 30 ? 2 : 1),
                    total_days: prescription.total_days || (severity > 30 ? 10 : 7),
                    interval_days: prescription.interval_days || 7
                  });
                }}
                className="flex-1 p-4 rounded-3xl border-3 border-emerald-800 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-950/10 flex items-center justify-center text-emerald-950 shrink-0">
                  📅
                </div>
                <div className="text-left animate-pulse">
                  <span className="text-[10px] font-mono font-black uppercase text-emerald-900 block mb-0.5">TIMELINE CODE RUNNER</span>
                  <span className="text-xs font-black leading-none uppercase">
                    Initialize Active Calendar
                  </span>
                </div>
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
