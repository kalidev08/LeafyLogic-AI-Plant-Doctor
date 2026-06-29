import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Check, 
  AlertTriangle, 
  Trash2, 
  Clock, 
  Sun, 
  Sunset, 
  ShieldAlert, 
  FileSpreadsheet,
  Award,
  AlertCircle
} from "lucide-react";

import { Diagnosis } from "../types";
import ScheduleCorrectionModal from "./ScheduleCorrectionModal";

export interface Schedule {
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
  interval_days?: number;
  is_sun_sensitive: boolean;
  status: "active" | "completed" | "abandoned";
}

export interface ActivityLog {
  id: string;
  schedule_id: string;
  scheduled_time: string;
  actual_applied_time: string | null;
  notes: string;
}

export interface ProgressMetrics {
  schedule_id: string;
  total_expected_doses: number;
  doses_completed: number;
  compliance_percentage: number;
  status: "HEALTHY_ADHERENCE" | "MISSED_DOSES" | "ABANDONED" | string;
}

interface Props {
  onShowToast: (msg: string) => void;
  onNavigateToTab: (tab: "detection" | "history" | "dosage" | "tracker") => void;
  recentScans: Diagnosis[];
}

export default function TreatmentCalendarTracker({ onShowToast, onNavigateToTab, recentScans }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedDayTab, setSelectedDayTab] = useState<number>(0);

  // History-to-schedule builder states
  const [showHistoryConnector, setShowHistoryConnector] = useState<boolean>(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [selectedScanId, setSelectedScanId] = useState<string>("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleRescheduleSlots = async (targetDoseIndex: number, newTimeString: string) => {
    if (!activeScheduleId) return;

    try {
      const res = await fetch(`/api/v1/treatments/schedules/${activeScheduleId}/reschedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_slot_index: (targetDoseIndex),
          new_time_string: newTimeString
        })
      });

      if (res.ok) {
        await fetchLogsAndMetrics(activeScheduleId);
        onShowToast(`🕒 Care schedule alarms cascade synchronized for Recurrence Dose #${targetDoseIndex + 1}!`);
      } else {
        const err = await res.json();
        throw new Error(err.error || "Compliance validation rule error.");
      }
    } catch (error: any) {
      throw error;
    }
  };
  const [newBaseChemical, setNewBaseChemical] = useState<string>("");
  const [newDosageAmount, setNewDosageAmount] = useState<number>(2.5);
  const [newUnit, setNewUnit] = useState<string>("mL");
  const [newWaterVolume, setNewWaterVolume] = useState<number>(500);
  const [newFrequency, setNewFrequency] = useState<number>(2);
  const [newDuration, setNewDuration] = useState<number>(7);

  // Selector callback logic to formulate recommended properties on-the-fly
  const handleSelectScanChange = (scanId: string) => {
    setSelectedScanId(scanId);
    if (!scanId) return;

    const scan = recentScans?.find(s => s.id === scanId);
    if (!scan) return;

    // Propose therapeutic values matching disease category
    const diseaseLower = (scan.diseaseName || "").toLowerCase();
    let baseChem = "Horticultural Soap Emulsion (Gentle Soap Bug Wash)";
    let unit = "mL";
    let rate = 2.5;

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
      rate = 3.0;
    } else if (/healthy/i.test(diseaseLower)) {
      baseChem = "Liquified Seaweed Kelp (Organic Tonic & Nutrient Booster)";
      unit = "mL";
      rate = 0.5;
    }

    setNewBaseChemical(baseChem);
    setNewDosageAmount(rate);
    setNewUnit(unit);
    setNewWaterVolume(500);
    setNewFrequency(2);
    setNewDuration(7);
  };

  const handleLaunchScheduleFromHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScanId) {
      onShowToast("⚠️ Please select a diagnostic scan to target.");
      return;
    }

    const scan = recentScans?.find(s => s.id === selectedScanId);
    if (!scan) {
      onShowToast("⚠️ Selected scan history item not found.");
      return;
    }

    const payload = {
      scan_id: scan.id,
      disease_name: `${scan.diseaseName} (${scan.plantName})`,
      base_chemical: newBaseChemical,
      exact_dosage_amount: Number(newDosageAmount),
      measurement_unit: newUnit,
      dilution_water_volume_ml: Number(newWaterVolume),
      frequency_per_day: Number(newFrequency),
      total_days: Number(newDuration)
    };

    try {
      const res = await fetch("/api/v1/treatments/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        onShowToast(`🎉 Active timelines configured for "${payload.disease_name}"!`);
        
        // Add to state and auto-focus
        setSchedules(prev => [data.schedule, ...prev]);
        setActiveScheduleId(data.schedule.id);
        
        // Reset builder state
        setShowHistoryConnector(false);
        setSelectedScanId("");
      } else {
        const err = await res.json();
        onShowToast(`System error: ${err.error || "Cannot configure schedules."}`);
      }
    } catch (err) {
      onShowToast("Database routine sync error.");
    }
  };

  // 1. Fetch Schedules
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/treatments/schedules");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules);
        
        // Default to the first schedule
        if (data.schedules.length > 0 && !activeScheduleId) {
          setActiveScheduleId(data.schedules[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch schedules from API", e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Logs and calculate Progress for the active schedule
  const fetchLogsAndMetrics = async (scheduleId: string) => {
    try {
      // Fetch Logs
      const logsRes = await fetch(`/api/v1/treatments/schedules/${scheduleId}/logs`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs);
      }

      // Fetch compliance progress metrics
      const progressRes = await fetch(`/api/v1/treatments/schedules/${scheduleId}/progress`);
      if (progressRes.ok) {
        const metricsData = await progressRes.json();
        setMetrics(metricsData);
      }
    } catch (e) {
      console.error(`Failed to pull compliance items for: ${scheduleId}`, e);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSchedules();
  }, []);

  // Sync if active schedule is updated
  useEffect(() => {
    if (activeScheduleId) {
      fetchLogsAndMetrics(activeScheduleId);
      // reset selected day view to Day 1
      setSelectedDayTab(0);
    } else {
      setLogs([]);
      setMetrics(null);
    }
  }, [activeScheduleId]);

  // Create standard schedule wrapper (sandbox helper)
  const handleCreateSchedule = async (params: {
    scan_id?: string;
    disease_name: string;
    base_chemical: string;
    exact_dosage_amount: number;
    measurement_unit: string;
    dilution_water_volume_ml: number;
    frequency_per_day: number;
    total_days: number;
    interval_days: number;
  }) => {
    try {
      const res = await fetch("/api/v1/treatments/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = await res.json();
        onShowToast(`🎉 Active treatment routine launched successfully for ${params.disease_name}!`);
        setSchedules(prev => [data.schedule, ...prev]);
        setActiveScheduleId(data.schedule.id);
      } else {
        const err = await res.json();
        onShowToast(`System issue: ${err.error || "failed creating schedule"}`);
      }
    } catch (e) {
      onShowToast("Agronomic schedule server network error.");
    }
  };

  // Delete an existing routine
  const handleDeleteSchedule = async (id: string, diseaseName: string) => {
    try {
      const res = await fetch(`/api/v1/treatments/schedules/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onShowToast(`🗑️ Routine for "${diseaseName}" deleted.`);
        const nextList = schedules.filter(s => s.id !== id);
        setSchedules(nextList);
        if (activeScheduleId === id) {
          if (nextList.length > 0) {
            setActiveScheduleId(nextList[0].id);
          } else {
            setActiveScheduleId(null);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        onShowToast(err.error || "Failed to delete treatment routine.");
      }
    } catch (e) {
      onShowToast("Network error deleting schedule.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Toggle compliance dose logging slot
  const handleToggleLog = async (logId: string) => {
    if (!activeScheduleId) return;
    try {
      const res = await fetch(`/api/v1/treatments/schedules/${activeScheduleId}/logs/${logId}/toggle`, {
        method: "POST"
      });
      if (res.ok) {
        // Redraw stats dynamically
        fetchLogsAndMetrics(activeScheduleId);
        onShowToast("🔄 Activity ledger logged successfully.");
      }
    } catch (e) {
      onShowToast("Compliance ledger synchronization error.");
    }
  };

  // Switch status (Complete/Abandon)
  const handleUpdateStatus = async (status: "completed" | "abandoned") => {
    if (!activeScheduleId) return;
    try {
      const res = await fetch(`/api/v1/treatments/schedules/${activeScheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchSchedules(); // reload list
        // Update active schedule status directly
        setSchedules(prev => prev.map(s => s.id === activeScheduleId ? { ...s, status } : s));
        onShowToast(`Schedule status flagged as ${status.toUpperCase()}!`);
      }
    } catch (e) {
      onShowToast("Failed updating status.");
    }
  };

  // Timezone-fixed scheduled hour display
  const formatScheduledTime = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      const hours = d.getUTCHours();
      const minutes = d.getUTCMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${displayHours}:${displayMinutes} ${ampm}`;
    } catch (e) {
      return "09:00 AM";
    }
  };

  // Helper date metrics
  const activeSched = schedules.find(s => s.id === activeScheduleId);
  
  const calculateDayOfCount = () => {
    if (!activeSched) return 0;
    const start = new Date(activeSched.start_date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(diffDays, activeSched.total_days);
  };

  const dayOfCount = calculateDayOfCount();

  // Helper check for sun sensitive alert
  const checkCurrentSunExposureAlert = () => {
    if (!activeSched || !activeSched.is_sun_sensitive) return false;
    const localHour = new Date().getHours();
    return localHour >= 9 && localHour < 17;
  };

  const showSunAlert = checkCurrentSunExposureAlert();

  // Group logs by Day Number
  const daysArray = Array.from({ length: activeSched?.total_days || 0 }, (_, i) => i);
  
  // Find precise log entries matching schedule ID and selectedDayTab day index
  const filteredLogsForSelectedDay = logs.filter(log => {
    const dayMatch = log.id.match(/-d(\d+)-dose/);
    if (dayMatch) {
      return parseInt(dayMatch[1], 10) === selectedDayTab;
    }
    return false;
  });

  return (
    <div className="flex-1 w-full p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6" id="treatment-tracker-applet">
      
      {/* 1. TOP STATS BANNER */}
      <div className="bg-emerald-900 text-white rounded-[32px] p-6 shadow-xl border-4 border-emerald-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-yellow-400 text-emerald-950 font-black tracking-wider uppercase text-[10px] px-2 py-0.5 rounded-md">
              Lifecycle Module
            </span>
            <span className="text-zinc-300 text-xs font-mono">Real-time Adherence Tracker</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
            <Calendar className="w-6 h-6 text-yellow-400" />
            <span>Prescription Scheduler</span>
          </h2>
          <p className="text-xs text-emerald-200 mt-1 max-w-lg leading-relaxed">
            Monitor multiple garden routines, record scheduled sprays, and safeguard crop immunity parameters timezone-aligned.
          </p>
        </div>
      </div>

      {/* 2. CHOOSE IF SCHEDULES EXIST OR REDIRECT */}
      {schedules.length === 0 ? (
        <div className="flex flex-col gap-6 items-center">
          <div className="bg-white rounded-[40px] p-8 md:p-10 shadow-xl border border-emerald-100/50 text-center flex flex-col items-center justify-center w-full min-h-[300px]">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mb-4 animate-bounce">
              🗓️
            </div>
            <h3 className="text-xl font-black text-emerald-950">No Active Treatment Calendars</h3>
            <p className="text-zinc-550 text-xs mt-2 max-w-md leading-relaxed">
              You don't have any treatment cycles scheduled right now. Compute requirements in the <strong className="text-emerald-800">Precision Dosage</strong> calculator first!
            </p>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => onNavigateToTab("dosage")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-full text-xs shadow-md shadow-emerald-600/15 transition-all active:scale-95 cursor-pointer"
              >
                Go to Dosage Calculator
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* MULTIPLE TREATMENT CYCLES DASHBOARD SECTION */}
          <div className="bg-gradient-to-br from-emerald-50 to-zinc-50 rounded-[32px] p-6 border border-emerald-100/60 shadow-inner">
            <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
              <div>
                <span className="text-[10px] font-black font-mono tracking-wider text-emerald-800 uppercase">
                  Simultaneous Multi-Cycle Admin Tracker
                </span>
                <h3 className="text-base font-black text-emerald-950 uppercase">
                  🌿 Active Treatment Cycles ({schedules.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-200 px-2 py-1 rounded font-mono font-bold">
                  Multi-Interval Enabled
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((s) => {
                const isSelected = s.id === activeScheduleId;
                return (
                  <div 
                    key={s.id} 
                    onClick={() => setActiveScheduleId(s.id)}
                    className={`p-5 rounded-[24px] border-2 text-left cursor-pointer transition-all flex flex-col justify-between gap-3 relative hover:scale-[1.01] ${
                      isSelected 
                        ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/10" 
                        : "bg-white/80 border-zinc-200/80 hover:border-zinc-300 shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[9px] font-black font-mono tracking-wider uppercase px-2 py-0.5 rounded ${
                          s.status === "active" 
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "completed"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-zinc-100 text-zinc-650"
                        }`}>
                          {s.status}
                        </span>
                        
                        {/* Option to Delete routine */}
                        {deleteConfirmId === s.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(s.id, s.disease_name)}
                              className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-[10px] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(s.id);
                            }}
                            title="Delete Treatment Cycle"
                            className="text-zinc-400 hover:text-rose-600 transition-colors p-1 rounded-full hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <h4 className="font-black text-emerald-950 text-xs mt-2 uppercase leading-tight line-clamp-1">
                        {s.disease_name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 font-medium font-mono mt-0.5 line-clamp-1">
                        {s.exact_dosage_amount} {s.measurement_unit} {s.base_chemical}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-1 pt-2.5 border-t border-zinc-100">
                      <span className="text-[10px] text-zinc-400 font-mono font-semibold">
                        ⏱️ {s.total_days} Days ({s.frequency_per_day}x/day)
                      </span>
                      <span className={`text-[10px] font-bold p-1 rounded uppercase ${
                        isSelected ? "text-emerald-600 font-black" : "text-zinc-400"
                      }`}>
                        {isSelected ? "● Focused" : "Inspect"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!activeSched ? (
            <div className="p-8 text-center italic text-zinc-500 font-mono">Select a treatment cycle from the deck above to load logs.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* L.H. CARD: ROUTINE DIAGNOSTIC INFORMATION */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                
                {/* SUN EXPOSURE PEAK HOUR WARNING BANNER */}
                {showSunAlert && (
                  <div className="bg-amber-100/90 border-l-4 border-yellow-500 p-4 rounded-3xl flex items-start gap-3 shadow-md">
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                        ⚠️ Diurnal Sun Alert (Sun-Sensitive Compound)
                      </h4>
                      <p className="text-[11px] text-amber-900 leading-normal mt-0.5 font-bold">
                        Do not apply <strong className="text-emerald-900">{activeSched.base_chemical}</strong> in direct hot peak sunlight. Apply morning or evening.
                      </p>
                    </div>
                  </div>
                )}

                {/* MAIN PRESCRIPTION TRACKER GRID */}
                <div className="bg-white rounded-[36px] p-6 md:p-8 shadow-xl border border-emerald-100/50 flex flex-col gap-6">
                  
                  {/* Routine metadata overview */}
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <span className="text-[9px] font-black font-mono tracking-wider text-emerald-800 uppercase bg-emerald-50 px-2 py-1 rounded">
                        Active Routine Profile
                      </span>
                      <h3 className="text-lg font-black text-emerald-950 mt-1 md:text-xl leading-tight uppercase">
                        {activeSched.disease_name}
                      </h3>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">
                        Formula: <span className="font-extrabold text-emerald-800">{activeSched.exact_dosage_amount} {activeSched.measurement_unit}</span> of {activeSched.base_chemical} mixed in <span className="font-extrabold text-emerald-800">{activeSched.dilution_water_volume_ml} mL</span> water.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowRescheduleModal(true)}
                        className="mt-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 hover:border-emerald-300 px-4 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm font-mono uppercase tracking-wide"
                      >
                        🔧 Correct Schedule Times
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-2.5 text-center min-w-[70px]">
                        <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-400 font-bold">DOSAGE FREQ</span>
                        <span className="text-xs font-mono font-black text-emerald-950">
                          {activeSched.frequency_per_day}x / day
                        </span>
                      </div>
                      <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-2.5 text-center min-w-[70px]">
                        <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-400 font-bold">INTERVAL</span>
                        <span className="text-xs font-mono font-black text-emerald-950">
                          Every {activeSched.interval_days || 7} days
                        </span>
                      </div>
                      <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-2.5 text-center min-w-[70px]">
                        <span className="block text-[8px] uppercase tracking-wider font-mono text-zinc-400 font-bold">COURSE</span>
                        <span className="text-xs font-mono font-black text-emerald-950 font-bold">
                          {activeSched.total_days} Days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Day X of Y Progress Streak Indicator */}
                  <div className="bg-zinc-50 rounded-3xl p-5 border border-zinc-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-600 font-mono">
                        COURSE PROGRESSION LOG
                      </span>
                      <span className="font-mono font-black text-emerald-800 uppercase bg-emerald-100/60 px-2.5 py-0.5 rounded-full">
                        Day {dayOfCount} of {activeSched.total_days} Timeline
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative w-full h-4 bg-zinc-200 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="absolute top-0 bottom-0 left-0 bg-emerald-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.round((dayOfCount / activeSched.total_days) * 100)}%` }}
                      >
                        {Math.round((dayOfCount / activeSched.total_days) * 100) > 10 && (
                          <span className="text-[8px] font-black text-emerald-950 font-mono">
                            {Math.round((dayOfCount / activeSched.total_days) * 100)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Micro metrics */}
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mt-1">
                      <span>Start: {new Date(activeSched.start_date).toLocaleDateString()}</span>
                      <span>End: {new Date(activeSched.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Day-by-Day Grid Selection Navigation — High-Fidelity Calendar Matrix */}
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black font-mono tracking-wider text-emerald-800 uppercase">
                        📅 TREATMENT COURSE CALENDAR TRACKER
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono font-semibold">Click any phase day to log doses</span>
                    </div>

                    <div className="grid grid-cols-7 gap-2 bg-zinc-50 border border-zinc-150 p-4 rounded-[28px] select-none shadow-sm">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
                        <div key={dayName} className="text-center text-[10px] uppercase font-black tracking-widest text-zinc-400 font-mono py-1">
                          {dayName}
                        </div>
                      ))}
                      {daysArray.map((dayNum) => {
                        const dLogs = logs.filter(log => {
                          const dayMatch = log.id.match(/-d(\d+)-dose/);
                          return dayMatch && parseInt(dayMatch[1], 10) === dayNum;
                        });
                        const isTreatmentDay = dLogs.length > 0;
                        const IsDayCompleted = isTreatmentDay && dLogs.every(l => l.actual_applied_time !== null);
                        const IsSomeCompleted = isTreatmentDay && dLogs.some(l => l.actual_applied_time !== null);
                        const dayActive = selectedDayTab === dayNum;

                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => setSelectedDayTab(dayNum)}
                            className={`aspect-square rounded-2xl border flex flex-col justify-between p-2 md:p-3 transition-all text-left cursor-pointer hover:border-emerald-400 relative ${
                              dayActive 
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md scale-[1.03] z-10 animate-fade-in" 
                                : isTreatmentDay 
                                  ? IsDayCompleted 
                                    ? "bg-emerald-50 border-emerald-250 text-emerald-800"
                                    : IsSomeCompleted
                                      ? "bg-amber-50 border-amber-300 text-amber-850"
                                      : "bg-rose-50/75 border-rose-200 text-rose-900"
                                  : "bg-zinc-100/50 border-zinc-250 text-zinc-400"
                            }`}
                          >
                            <span className={`text-[10px] font-mono font-black leading-none ${dayActive ? "text-white" : isTreatmentDay ? "text-emerald-950/80" : "text-zinc-400"}`}>
                              {dayNum + 1}
                            </span>
                            
                            <div className="flex items-center justify-between mt-auto">
                              {isTreatmentDay ? (
                                IsDayCompleted ? (
                                  <span className={`text-[8px] font-mono font-bold uppercase leading-none px-1 rounded ${dayActive ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-900"}`}>
                                    ✓ Done
                                  </span>
                                ) : (
                                  <span className={`text-[8px] font-mono leading-none font-bold uppercase px-1 rounded ${dayActive ? "bg-white/20 text-white" : "bg-yellow-400 text-emerald-950"}`}>
                                    {dLogs.length}x
                                  </span>
                                )
                              ) : (
                                <span className="text-[7.5px] font-mono font-black leading-none text-zinc-400 uppercase tracking-tighter">
                                  Rest
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TODAY'S TIMELINE OF REQUIRED DOSES */}
                  <div className="border-t border-zinc-100 pt-4 flex flex-col gap-4">
                    <div>
                      <h4 className="text-sm font-black text-emerald-950 uppercase">
                        Required Applications (Day {selectedDayTab + 1})
                      </h4>
                      <p className="text-[11px] text-zinc-500">
                        Calibrated treatment logs. Tap to toggle compliance.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredLogsForSelectedDay.map((log, index) => {
                        const isChecked = log.actual_applied_time !== null;
                        const scheduledHour = new Date(log.scheduled_time).getUTCHours();
                        const isSunsetDose = scheduledHour >= 12;

                        return (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => handleToggleLog(log.id)}
                            className={`p-6 rounded-3xl border-4 text-left transition-all active:scale-[0.98] outline-none flex items-center justify-between cursor-pointer ${
                              isChecked 
                                ? "bg-emerald-50/70 border-emerald-500/70 text-emerald-950 shadow-inner" 
                                : "bg-zinc-50/50 hover:bg-zinc-50 border-zinc-200 text-zinc-650 hover:border-zinc-300"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              {/* Circular Icon state badge */}
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                                isChecked ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-400"
                              }`}>
                                {isChecked ? (
                                  <Check className="w-7 h-7" strokeWidth={4} />
                                ) : isSunsetDose ? (
                                  <Sunset className="w-7 h-7" />
                                ) : (
                                  <Sun className="w-7 h-7" />
                                )}
                              </div>

                              <div>
                                <span className="block text-[9px] uppercase tracking-wider font-black font-mono text-zinc-400">
                                  {isSunsetDose ? "Sunset Evening Cycle" : "Sunrise Morning Cycle"}
                                </span>
                                
                                {/* Timezone offset fix applied cleanly */}
                                <span className="font-mono text-xs font-bold text-emerald-950">
                                  {formatScheduledTime(log.scheduled_time)}
                                </span>
                                
                                <span className="block text-[11px] text-zinc-400 italic font-mono mt-0.5">
                                  {isChecked 
                                    ? `Logged: ${new Date(log.actual_applied_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                                    : "Awaiting application log"}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center justify-center pr-1">
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                isChecked ? "bg-emerald-600 border-emerald-600 text-white" : "border-zinc-300 text-transparent"
                              }`}>
                                ✓
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {filteredLogsForSelectedDay.length === 0 && (
                        <div className="col-span-2 text-center p-8 bg-zinc-50 border border-dashed rounded-3xl text-xs text-zinc-500 italic">
                          There are no scheduled application phases registered for this specific day course slot.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* R.H. CARD: COMPLIANCE METRICS & ACTIONS */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                
                {/* COMPLIANCE STATUS BAR SECTION */}
                {metrics ? (
                  <div className="bg-white rounded-[36px] p-6 shadow-xl border border-emerald-100/50 flex flex-col gap-5">
                    <div>
                      <span className="text-[10px] font-black font-mono tracking-wider text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded">
                        Agronomic Adherence Score
                      </span>
                      <h4 className="text-base font-black text-emerald-950 uppercase tracking-tight mt-1">
                        Fidelity Metrics
                      </h4>
                    </div>

                    <div className="flex flex-col gap-1 items-center py-4 bg-gradient-to-br from-emerald-50 to-zinc-50 border border-emerald-100 rounded-3xl relative overflow-hidden">
                      
                      {/* Status Banner */}
                      <div className="absolute top-3 left-3 flex items-center gap-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          metrics.status === "HEALTHY_ADHERENCE" 
                            ? "bg-emerald-500 animate-pulse" 
                            : metrics.status === "MISSED_DOSES" 
                              ? "bg-rose-500 animate-bounce" 
                              : "bg-zinc-400"
                        }`} />
                        <span className="text-[8px] font-mono font-black uppercase text-zinc-500">
                          {metrics.status}
                        </span>
                      </div>

                      {/* Circular/Text Gauge */}
                      <span className="text-4xl font-extrabold font-mono text-emerald-950 tracking-tight mt-2">
                        {metrics.compliance_percentage}%
                      </span>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide font-mono mt-1">
                        Fidelity Adherence
                      </p>

                      <div className="flex justify-between w-full px-5 mt-4 text-[11px] border-t border-emerald-100/60 pt-3">
                        <div className="text-center flex-1 border-r border-emerald-100/60">
                          <span className="block font-mono font-black text-emerald-900">{metrics.doses_completed}</span>
                          <span className="text-[9px] text-zinc-400 font-mono">COMPLETED</span>
                        </div>
                        <div className="text-center flex-1">
                          <span className="block font-mono font-black text-emerald-900">{metrics.total_expected_doses}</span>
                          <span className="text-[9px] text-zinc-400 font-mono">EXPECTED</span>
                        </div>
                      </div>
                    </div>

                    {/* HEALTH WARNING SYSTEM FOR ADHERENCE DRAIN */}
                    {metrics.status === "MISSED_DOSES" && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-950 p-4 rounded-3xl flex flex-col gap-1.5 animate-pulse">
                        <div className="flex items-center gap-1.5 font-black text-rose-800 text-xs uppercase tracking-wide">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>Life-Cycle ALERT: AT RISK</span>
                        </div>
                        <p className="text-[10.5px] leading-relaxed text-rose-950 font-medium">
                          ⚠️ **3+ consecutive missed applications found**. Your plant's immunity timeline has been breached. Re-apply dose immediately to halt disease reproduction cycle.
                        </p>
                      </div>
                    )} {metrics.status === "HEALTHY_ADHERENCE" && metrics.compliance_percentage >= 80 && (
                      <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-950 p-4 rounded-3xl flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 font-black text-emerald-800 text-xs uppercase tracking-wide">
                          <Award className="w-4 h-4 text-emerald-600 animate-bounce" />
                          <span>GROWER CERTIFIED EXCELLENT</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-zinc-650 font-semibold font-mono">
                          High adherence guarantees molecular barrier stability on target leaves! Keep it up.
                        </p>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="bg-white rounded-[36px] p-6 text-center italic text-zinc-400 text-xs font-mono border">
                    Loading compliance gauge...
                  </div>
                )}

                {/* ROUTINE LIFECYCLE MANAGEMENT SUMMARY CARD */}
                <div className="bg-white rounded-[36px] p-6 shadow-xl border border-emerald-100/50 flex flex-col gap-4">
                  <h4 className="text-xs font-black font-mono uppercase text-zinc-400 tracking-wider">
                    Lifecycle actions
                  </h4>

                  <div className="flex flex-col gap-2">
                    {activeSched.status === "active" && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus("completed")}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer shadow flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Routine Completed Successfully</span>
                        </button>
                        <button
                          onClick={() => handleUpdateStatus("abandoned")}
                          className="w-full bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 border border-zinc-200 hover:border-rose-200"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Abandon / Halt Routine</span>
                        </button>
                      </>
                    )}

                    {activeSched.status !== "active" && (
                      <div className="p-4 rounded-2xl bg-zinc-100 text-center text-xs font-bold text-zinc-500 font-mono uppercase border">
                        TIMELINE ENDED: STATUS {activeSched.status.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* MEDICATION SAFETY & PRECAUTIONS ALERT BOX */}
                <div className="bg-amber-50 text-amber-950 rounded-[36px] p-6 shadow-md border border-amber-200 flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 font-mono font-black uppercase text-[10px] text-amber-900 leading-none">
                    <ShieldAlert className="w-4 h-4 text-amber-700 font-bold" />
                    <span>Medication Safety Alerts</span>
                  </div>
                  <div className="text-xs font-semibold space-y-3 leading-relaxed">
                    <p className="text-[11px] text-amber-950">
                      While administering therapeutic liquid sprays for <strong>{activeSched.disease_name}</strong>, adhere strictly to agronomic safety guidelines:
                    </p>
                    <div className="flex gap-2">
                      <span className="text-base">🛡️</span>
                      <div>
                        <strong className="text-amber-900 block font-sans text-[11px] uppercase tracking-wide">Gear Guard</strong>
                        <span className="text-zinc-650 text-[10.5px] leading-snug block mt-0.5">Wear safety gloves and goggles. Refrain from inhaling dry therapeutic powders or aerosolized spray.</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-base">🐝</span>
                      <div>
                        <strong className="text-amber-900 block font-sans text-[11px] uppercase tracking-wide">Pollinator Sanctuary</strong>
                        <span className="text-zinc-650 text-[10.5px] leading-snug block mt-0.5">Exclusively spray in late twilight evening or early sunrise. Never spray during active bee foraging times to preserve pollinator pathways.</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-base">☀️</span>
                      <div>
                        <strong className="text-amber-900 block font-sans text-[11px] uppercase tracking-wide">Sun Avoidance</strong>
                        <span className="text-zinc-650 text-[10.5px] leading-snug block mt-0.5 font-bold font-mono">Do NOT administer medication during peak sunburn hours (09:00 AM to 05:00 PM). Sun phototoxicity can severely scorch leaves.</span>
                      </div>
                    </div>
                  </div>
                </div>



              </div>

            </div>
          )}

        </div>
      )}

      {showRescheduleModal && activeSched && (
        <ScheduleCorrectionModal
          schedule={{
            id: activeSched.id,
            disease_name: activeSched.disease_name,
            base_chemical: activeSched.base_chemical,
            frequency_per_day: activeSched.frequency_per_day,
            is_sun_sensitive: activeSched.is_sun_sensitive
          }}
          tomorrowDoses={Array.from({ length: activeSched.frequency_per_day || 1 }).map((_, idx) => {
            const nextLogForDose = logs.find(l => 
              (l.id.endsWith(`-dose${idx}`) || l.id.endsWith(`-${idx}`)) && 
              l.actual_applied_time === null
            );
            return {
              id: nextLogForDose?.id || `simulated-${idx}`,
              doseIndex: idx,
              originalTime: nextLogForDose?.scheduled_time || new Date().toISOString()
            };
          })}
          onClose={() => setShowRescheduleModal(false)}
          onSave={handleRescheduleSlots}
          onShowToast={onShowToast}
        />
      )}

    </div>
  );
}
