import React, { useState } from "react";
import { Clock, ArrowRight, X, AlertTriangle, AlertCircle, Sparkles, Sun, Moon, Info, ShieldCheck } from "lucide-react";

interface ScheduleCorrectionModalProps {
  schedule: {
    id: string;
    disease_name: string;
    base_chemical: string;
    frequency_per_day: number;
    is_sun_sensitive: boolean;
  };
  tomorrowDoses: Array<{
    id: string;
    doseIndex: number;
    originalTime: string; // ISO String or "HH:MM"
  }>;
  onClose: () => void;
  onSave: (targetDoseIndex: number, newTimeString: string) => Promise<void>;
  onShowToast: (msg: string) => void;
}

export default function ScheduleCorrectionModal({
  schedule,
  tomorrowDoses,
  onClose,
  onSave,
  onShowToast
}: ScheduleCorrectionModalProps) {
  // We keep track of which slot (0 for dose 1, 1 for dose 2, etc.) we are correcting
  const [targetSlotIndex, setTargetSlotIndex] = useState<number>(0);

  // Initialize selected slot's time. Time format is "HH:MM" in 24h
  const getInitialTimeForSlot = (slotIdx: number) => {
    const dose = tomorrowDoses.find(d => d.doseIndex === slotIdx);
    if (dose) {
      const dt = new Date(dose.originalTime);
      const hours = String(dt.getUTCHours()).padStart(2, "0");
      const minutes = String(dt.getUTCMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    }
    return slotIdx === 0 ? "07:30" : "18:00";
  };

  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => getInitialTimeForSlot(0));
  const [submitting, setSubmitting] = useState(false);

  const handleSlotTabChange = (slotIdx: number) => {
    setTargetSlotIndex(slotIdx);
    setCurrentTimeStr(getInitialTimeForSlot(slotIdx));
  };

  // Helper to parse "HH:MM" to minutes total in the day
  const toTotalMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Helper to convert minutes total back to "HH:MM"
  const fromTotalMinutes = (totalMins: number): string => {
    // Keep within bounds of a single day
    let normalized = totalMins % 1440;
    if (normalized < 0) normalized += 1440;
    const h = Math.floor(normalized / 60);
    const m = normalized % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Big, easy-to-tap +/- 30 minutes adjustments
  const adjustMins = (amount: number) => {
    const currentMins = toTotalMinutes(currentTimeStr);
    const adjustedStr = fromTotalMinutes(currentMins + amount);
    setCurrentTimeStr(adjustedStr);
  };

  // Extract hour to check Diurnal UV safety parameters (9:00 AM to 5:00 PM is peak UV = Hours 9-16)
  const currentHour = parseInt(currentTimeStr.split(":")[0], 10);
  const isPeakUVSunSlot = currentHour >= 9 && currentHour < 17;
  const showSafeguardBreach = schedule.is_sun_sensitive && isPeakUVSunSlot;

  // Format nice 12-hour AM/PM string for comparative display
  const format12Hour = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h)) return "--:--";
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  // Get original time for selected slot formatted nicely list
  const selectedOriginalDose = tomorrowDoses.find(d => d.doseIndex === targetSlotIndex);
  const originalTimeFormatted = selectedOriginalDose
    ? (() => {
        const dt = new Date(selectedOriginalDose.originalTime);
        const hrs = String(dt.getUTCHours()).padStart(2, "0");
        const mins = String(dt.getUTCMinutes()).padStart(2, "0");
        return format12Hour(`${hrs}:${mins}`);
      })()
    : "Not Configured";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showSafeguardBreach) {
      onShowToast("❌ Cannot save changes. Adjusted slot breaches the sun safety peak interval!");
      return;
    }

    try {
      setSubmitting(true);
      await onSave(targetSlotIndex, currentTimeStr);
      onShowToast(`🎉 Future slots for Dose #${targetSlotIndex + 1} shifted to ${format12Hour(currentTimeStr)}!`);
      onClose();
    } catch (err: any) {
      onShowToast(`Failed: ${err?.message || "Cannot reschedule. Check fields."}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="correction-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[40px] border border-zinc-150 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col p-6 md:p-8 animation-slide-up">
        {/* HEADER SECTION */}
        <div className="flex justify-between items-start border-b border-zinc-150 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full uppercase tracking-wider block">
                Agronomic Compliance Override
              </span>
              {schedule.is_sun_sensitive && (
                <span className="text-[10px] font-mono font-black bg-yellow-100 text-yellow-900 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-500 fill-amber-500" /> Sun-Sensitive
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-950 to-zinc-900 bg-clip-text text-transparent mt-2">
              Adjust Prescription Schedule
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Active Routine: <strong className="text-zinc-800">{schedule.disease_name}</strong> ({schedule.base_chemical})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-6">
          {/* STEP 1: CHOOSE TARGET SLOT TO CHANGE */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black font-mono uppercase text-zinc-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Select Recurrence Dose Slot to Edit:
            </span>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: schedule.frequency_per_day }).map((_, idx) => {
                const active = targetSlotIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSlotTabChange(idx)}
                    className={`p-4 rounded-3xl border text-left cursor-pointer transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50/50 text-emerald-950 ring-2 ring-emerald-500/20"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide">
                        Recurrence {idx === 0 ? "Morning" : `Dose #${idx + 1}`}
                      </span>
                      {idx === 0 ? (
                        <Sun className={`w-4 h-4 ${active ? "text-emerald-600" : "text-zinc-400"}`} />
                      ) : (
                        <Moon className={`w-4 h-4 ${active ? "text-emerald-600" : "text-zinc-400"}`} />
                      )}
                    </div>
                    <p className="text-[10px] mt-1 text-zinc-500">
                      Modifies every upcoming matching slot.
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: GIANT CLICK-OPTIMIZED HOURS CONTROLLER */}
          <div className="p-6 bg-zinc-50 rounded-[32px] border border-zinc-150 text-center flex flex-col items-center justify-center">
            <span className="text-[11px] font-black font-mono uppercase text-zinc-500">
              Set Target Care Time (24h Standard UTC representation)
            </span>
            
            <div className="flex items-center gap-6 mt-4">
              {/* Decrement 30 mins Button */}
              <button
                type="button"
                onClick={() => adjustMins(-30)}
                className="w-16 h-16 rounded-full bg-white border border-zinc-200 shadow-md flex flex-col items-center justify-center active:scale-90 hover:bg-zinc-50 transition cursor-pointer select-none text-red-600 font-extrabold"
              >
                <div className="text-xs font-bold">Shift</div>
                <div className="text-sm font-black">-30m</div>
              </button>

              {/* Huge Numeric Display */}
              <div className="bg-white px-8 py-5 rounded-3xl border-2 border-emerald-600/20 shadow-inner flex flex-col items-center justify-center min-w-[180px]">
                <span className="text-4xl font-extrabold font-mono tracking-tight text-zinc-900">
                  {currentTimeStr}
                </span>
                <span className="text-xs text-emerald-800 font-bold mt-1.5 px-3 py-0.5 bg-emerald-50 rounded-full flex items-center gap-1 shadow-sm">
                  <Clock className="w-3 h-3" /> {format12Hour(currentTimeStr)}
                </span>
              </div>

              {/* Increment 30 mins Button */}
              <button
                type="button"
                onClick={() => adjustMins(30)}
                className="w-16 h-16 rounded-full bg-white border border-zinc-200 shadow-md flex flex-col items-center justify-center active:scale-90 hover:bg-zinc-50 transition cursor-pointer select-none text-emerald-700 font-extrabold"
              >
                <div className="text-xs font-bold font-mono">Shift</div>
                <div className="text-sm font-black">+30m</div>
              </button>
            </div>

            {/* Fine Tune / Typed Time Input alternative just in case */}
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[10px] text-zinc-400 font-medium">Fine tune fallback:</span>
              <input
                type="time"
                value={currentTimeStr}
                onChange={(e) => setCurrentTimeStr(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold border border-zinc-200 rounded-lg bg-white shadow-sm focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* STEP 3: SIDE-BY-SIDE BEFORE VS. AFTER TIMELINE COMPARISON */}
          <div className="border border-zinc-150 rounded-3xl p-5 bg-white">
            <span className="text-[11px] font-black font-mono uppercase text-zinc-500 block mb-3">
              📅 Cascade Timeline Change Forecast
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-zinc-150">
              {/* BEFORE */}
              <div className="flex flex-col gap-2 pb-3 md:pb-0">
                <span className="text-[10px] font-bold text-red-600 font-mono flex items-center gap-1 uppercase">
                  🔴 ORIGINAL SLOT SETTINGS
                </span>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-50 text-red-700 rounded-2xl">
                    <Clock className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Dose Recurrence #{targetSlotIndex + 1}</div>
                    <div className="text-sm font-black text-red-950 font-mono line-through">
                      {originalTimeFormatted}
                    </div>
                  </div>
                </div>
              </div>

              {/* AFTER */}
              <div className="flex flex-col gap-2 pt-3 md:pt-0 md:pl-4">
                <span className="text-[10px] font-bold text-emerald-600 font-mono flex items-center gap-1 uppercase">
                  🟢 NEW PROPOSED CYCLE
                </span>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl animate-pulse">
                    <Clock className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-700">Dose Recurrence #{targetSlotIndex + 1}</div>
                    <div className="text-sm font-black text-emerald-950 font-mono flex items-center gap-2">
                      <span>{format12Hour(currentTimeStr)}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono">
                        Cascade Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-400 mt-4 leading-relaxed bg-zinc-50 p-2.5 rounded-xl flex items-start gap-1.5 border border-zinc-100">
              <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <span>
                To satisfy the strict <strong>Transactional compliance laws</strong>, all completed historical applications in this treatment schedule remain locked to preserve analytic integrity. Only upcoming future doses will cascade-adjust.
              </span>
            </div>
          </div>

          {/* STEP 4: DYNAMIC ENVIRONMENTAL WARNING BANNER */}
          {showSafeguardBreach ? (
            <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200 text-red-950 text-xs flex gap-3 animation-shake">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <strong className="text-red-900 font-bold uppercase tracking-wide flex items-center gap-1 text-[11px]">
                  Diurnal Safety Warning: Daylight peak UV risk!
                </strong>
                <p className="leading-relaxed text-[11px]">
                  <strong>{schedule.base_chemical}</strong> is sun-sensitive! Rescheduling to peak daylight hours (<strong>09:00 AM to 05:00 PM</strong>) is hazard-blocked. Peak solar ultraviolet light will immediately degrade chemical efficacy. Please shift the time earlier or later.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 text-emerald-950 text-xs flex gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <strong className="text-emerald-900 font-bold uppercase tracking-wide text-[11px]">
                  Diurnal Environmental Validation Satisfied
                </strong>
                <p className="text-emerald-800 leading-relaxed text-[11px]">
                  No daylight exposure threats detected. Safe early-morning/late-evening cool therapy slot confirmed.
                </p>
              </div>
            </div>
          )}

          {/* BUTTONS */}
          <div className="flex gap-3 justify-end border-t border-zinc-150 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold px-5 py-3 rounded-2xl text-xs transition active:scale-95 cursor-pointer"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={showSafeguardBreach || submitting}
              className={`font-black px-6 py-3 rounded-2xl text-xs transition active:scale-95 cursor-pointer ${
                showSafeguardBreach
                  ? "bg-zinc-200 text-zinc-400 cursor-not-allowed border border-zinc-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/15"
              }`}
            >
              {submitting ? "Processing Transaction..." : "Save Time correction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
