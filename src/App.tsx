import React, { useState, useEffect } from "react";
import { 
  Camera, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Leaf, 
  Check, 
  AlertCircle, 
  Shield, 
  Sprout, 
  Sparkles, 
  BookOpen, 
  Copy, 
  Info,
  Calendar,
  AlertTriangle,
  History,
  Search,
  Calculator
} from "lucide-react";
import CameraCapture from "./components/CameraCapture";
import { Diagnosis } from "./types";
import TreatmentPrescriptionCard from "./components/TreatmentPrescriptionCard";
import TreatmentCalendarTracker from "./components/TreatmentCalendarTracker";

const FUNNY_LOADER_PHRASES = [
  "Consulting the ancient scrolls of magical botany...",
  "Running high-precision diagnosis on leaf stomata...",
  "Let's get to the deep root of the problem...",
  "Consulting with the grand tree canopy council...",
  "Inspecting chlorophyllic stress markers carefully...",
  "Scanning for mischievous bugs and sneaky fungal spores...",
  "Whispering helpful words to the cells of your leaf..."
];

// Client-side helper to compress and downscale uploaded images to speed up transmission & analysis
function resizeAndCompressImage(dataUrl: string, maxDim: number = 800, quality: number = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [showCameraInstructions, setShowCameraInstructions] = useState<boolean>(false);
  
  // Active diagnosis state
  const [activeDiagnosis, setActiveDiagnosis] = useState<Diagnosis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState<number>(0);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  // Sidebar & Tab workflow states
  const [activeTab, setActiveTab] = useState<"detection" | "history" | "dosage" | "tracker">("detection");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Diagnosis | null>(null);
  
  // States for dynamic precision dosage tab integration
  const [dosageDiseaseName, setDosageDiseaseName] = useState<string>("Tomato Early Blight (Fungal)");
  const [dosageScanId, setDosageScanId] = useState<string>("preset-tomato-early-blight");

  // Garden history stored locally
  const [history, setHistory] = useState<Diagnosis[]>([]);
  const [clipboardFeedback, setClipboardFeedback] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const openCameraWithPermissionCheck = async () => {
    setDiagnosticError(null);
    
    // Explicitly query permission state if supported by user browser (Safari handles with default try/catch)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (result.state === "denied") {
          setShowCameraInstructions(true);
          return;
        }
      } catch (e) {
        console.warn("Camera permissions API not fully supported or query failed. Normal getUserMedia flow will be used.", e);
      }
    }
    
    // Re-initialize diagnosis slate and launch Camera Capture component
    setSelectedImage(null);
    setCustomFile(null);
    setActiveDiagnosis(null);
    setIsCameraActive(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Auto-clear toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load history on first mount
  useEffect(() => {
    const initialHist = localStorage.getItem("flora_doc_history");
    if (initialHist) {
      try {
        const parsed = JSON.parse(initialHist);
        setHistory(parsed);
        if (parsed.length > 0) {
          setActiveDiagnosis(parsed[0]);
          setSelectedHistoryItem(parsed[0]);
          if (parsed[0].imageThumbnail) {
            setSelectedImage(parsed[0].imageThumbnail);
          }
        }
      } catch (e) {
        console.error("Failed to parse history:", e);
      }
    }
  }, []);

  // Cycling humorous loader texts when active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % FUNNY_LOADER_PHRASES.length);
      }, 2400);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFile(file);
      setDiagnosticError(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await resizeAndCompressImage(reader.result as string);
        setSelectedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setCustomFile(file);
      setDiagnosticError(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await resizeAndCompressImage(reader.result as string);
        setSelectedImage(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (base64Image: string) => {
    setSelectedImage(base64Image);
    setCustomFile(null);
    setDiagnosticError(null);
    // Auto execute scan on snap for faster diagnosis!
    runPlantScan(base64Image);
  };

  const runPlantScan = async (imageToScan: string | null = null) => {
    const activeImg = imageToScan || selectedImage;
    if (!activeImg) {
      setDiagnosticError("Please upload an image, snap with camera, or select a leaf preset first.");
      return;
    }

    setIsLoading(true);
    setDiagnosticError(null);
    setLoadingPhraseIndex(0);

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: activeImg,
          mimeType: activeImg.startsWith("data:image/png") ? "image/png" : "image/jpeg",
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `Server responded with status ${response.status}`);
      }

      const rawResult = await response.json();
      
      const newDiag: Diagnosis = {
        id: "diag-" + Date.now(),
        plantName: rawResult.plantName,
        diseaseName: rawResult.diseaseName,
        confidenceLevel: rawResult.confidenceLevel,
        whatsHappening: rawResult.whatsHappening,
        immediateAction: rawResult.immediateAction,
        treatmentCode: rawResult.treatmentCode,
        environmentTweak: rawResult.environmentTweak,
        preventionProTip: rawResult.preventionProTip,
        markdown: rawResult.markdown,
        timestamp: rawResult.timestamp || new Date().toISOString(),
        imageThumbnail: activeImg
      };

      setActiveDiagnosis(newDiag);
      setSelectedHistoryItem(newDiag);

      // Store in storage history
      const updatedHistory = [newDiag, ...history.filter(h => h.id !== newDiag.id)].slice(0, 20);
      setHistory(updatedHistory);
      localStorage.setItem("flora_doc_history", JSON.stringify(updatedHistory));

    } catch (err: any) {
      console.error("Diagnosis request error:", err);
      // Helpful diagnosis message for key missing vs general error
      if (err.message?.includes("GEMINI_API_KEY")) {
        setDiagnosticError("GEMINI_API_KEY is not defined. Ensure you have stored your Gemini API Key in the 'Secrets' panel in AI Studio UI to execute live diagnoses.");
      } else {
        setDiagnosticError(err.message || "Oops! Our gardening servers are feeling a bit dry. Please retry again in a moment!");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (activeDiagnosis) {
      navigator.clipboard.writeText(activeDiagnosis.markdown);
      setClipboardFeedback(true);
      setTimeout(() => setClipboardFeedback(false), 2000);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("flora_doc_history", JSON.stringify(updated));
    
    // If we delete the currently visible diagnosis, revert to something else
    if (activeDiagnosis?.id === id) {
      if (updated.length > 0) {
        setActiveDiagnosis(updated[0]);
        if (updated[0].imageThumbnail) {
          setSelectedImage(updated[0].imageThumbnail);
        }
      } else {
        setActiveDiagnosis(null);
        setSelectedImage(null);
      }
    }

    if (selectedHistoryItem?.id === id) {
      if (updated.length > 0) {
        setSelectedHistoryItem(updated[0]);
      } else {
        setSelectedHistoryItem(null);
      }
    }
  };

  const clearAllHistory = () => {
    setHistory([]);
    localStorage.removeItem("flora_doc_history");
    setActiveDiagnosis(null);
    setSelectedHistoryItem(null);
    setSelectedImage(null);
    setShowClearConfirm(false);
    showToast("Garden History cleared successfully!");
  };

  const loadHistoricalDiagnosis = (item: Diagnosis) => {
    setActiveDiagnosis(item);
    if (item.imageThumbnail) {
      setSelectedImage(item.imageThumbnail);
    }
    setCustomFile(null);
    setDiagnosticError(null);
  };

  return (
    <div className="min-h-screen bg-emerald-50 text-emerald-900 font-sans flex flex-col antialiased">
      
      {/* HEADER SECTION - Beautiful Emerald Navigation with Vibrant Accents */}
      <header className="bg-emerald-600 px-6 py-4 md:px-8 md:py-5 flex flex-col sm:flex-row justify-between items-center shadow-lg sticky top-0 z-40 border-b-4 border-emerald-700">
        <div id="header-logo-area" className="flex items-center gap-3 mb-3 sm:mb-0">
          <div className="bg-white p-2 rounded-2xl shadow-inner flex items-center justify-center">
            <Sprout className="w-8 h-8 text-emerald-600 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-widest italic drop-shadow">LeafyLogic</h1>
              <span className="bg-yellow-400 text-emerald-950 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">AI Pathologist</span>
            </div>
            <p className="text-xs text-emerald-100 font-medium">To keep your green leafies happy and healthy!</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-4 flex-wrap justify-center">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-white text-xs font-bold font-mono">Expert Plant Care Online</span>
            <span className="text-emerald-200 text-[11px]">Supporting organic & chemical treatments</span>
          </div>

          <div className="bg-emerald-800/60 text-white text-xs px-4 py-2 rounded-xl border border-emerald-500/30 flex items-center gap-2 font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span>LeafyLogic Consultative Engine</span>
          </div>
          
          <button 
            id="snap-shortcut-btn"
            onClick={openCameraWithPermissionCheck}
            className="bg-yellow-400 text-emerald-950 hover:bg-yellow-300 font-black px-6 py-2 rounded-full text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>New Scan</span>
          </button>
        </div>
      </header>

      {/* RESPONSIVE LAYOUT CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto min-h-0">
        
        {/* SIDEBAR NAVIGATION - Responsive */}
        <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-emerald-100 p-4 lg:p-6 shrink-0 flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            <div className="hidden lg:flex flex-col pb-2 mb-2 border-b border-zinc-100">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block font-mono">WORKSPACE</span>
              <p className="text-xs text-zinc-500 font-medium font-mono">LeafyLogic Services</p>
            </div>

            <nav className="flex lg:flex-col gap-2 w-full">
              <button
                onClick={() => setActiveTab("detection")}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === "detection"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 scale-[1.01]"
                    : "text-zinc-600 hover:text-emerald-800 hover:bg-emerald-50/50"
                }`}
              >
                <Leaf className="w-4 h-4 shrink-0" />
                <span>Detection</span>
              </button>

              <button
                onClick={() => setActiveTab("history")}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer relative ${
                  activeTab === "history"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 scale-[1.01]"
                    : "text-zinc-600 hover:text-emerald-800 hover:bg-emerald-50/50"
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span>Search History</span>
                {history.length > 0 && (
                  <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${
                    activeTab === "history" ? "bg-white text-emerald-800" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {history.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("dosage")}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === "dosage"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 scale-[1.01]"
                    : "text-zinc-600 hover:text-emerald-800 hover:bg-emerald-50/50"
                }`}
              >
                <Calculator className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Precision Dosage</span>
              </button>

              <button
                onClick={() => setActiveTab("tracker")}
                className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === "tracker"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/15 scale-[1.01]"
                    : "text-zinc-600 hover:text-emerald-800 hover:bg-emerald-50/50"
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0 text-amber-550" />
                <span>Alarms & Tracking</span>
              </button>
            </nav>
          </div>

          {/* Quick tips panel in sidebar */}
          <div className="hidden lg:flex flex-col gap-3 mt-6 border-t border-zinc-100 pt-4">
            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-100/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Leaf Scan Tips</span>
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed font-semibold">
                Snap from above with clear, focused natural light, avoiding dark shadows.
              </p>
            </div>
            
            <div className="text-[9px] text-zinc-400 font-mono flex items-center justify-between px-1">
              <span>LeafyLogic v2.1</span>
              <span>• Engine Online</span>
            </div>
          </div>
        </aside>

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {activeTab === "detection" ? (
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: UPLOAD, LIVE SCREEN, AND PRESETS */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          
          {/* Diagnostic Card Frame */}
          <div className="relative bg-white rounded-[40px] border-8 border-emerald-100 overflow-hidden shadow-xl flex flex-col min-h-[360px] md:min-h-[440px] justify-between">
            
            {/* Main Visual Display */}
            <div className="relative flex-1 bg-neutral-900 overflow-hidden group">
              {selectedImage ? (
                <>
                  <img 
                    src={selectedImage} 
                    alt="Active plant foliage" 
                    className={`w-full h-full object-cover transition-all duration-700 ${isLoading ? 'blur-[2px] brightness-75 scale-105' : ''}`}
                    onError={(e) => {
                      // Fallback in case of expired Unsplash links
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&q=80&w=800";
                    }}
                  />
                  
                  {/* Glowing Laser Scanner Overlays during diagnostics */}
                  {isLoading && (
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      <div className="w-full h-1 bg-yellow-400 shadow-[0_0_15px_#facc15] animate-[bounce_3s_infinite]" />
                      <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] animate-pulse" />
                    </div>
                  )}

                  {/* Aesthetic Target Reticle Overlay */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-dashed border-yellow-400/70 rounded-full pointer-events-none animate-[spin_50s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border-2 border-yellow-400 rounded-full pointer-events-none" />

                  {/* Image Indicator Stamp */}
                  <div className="absolute bottom-4 left-4 right-4 bg-emerald-950/80 backdrop-blur-md border border-white/20 rounded-2xl p-3 flex justify-between items-center text-white">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-300">Target Focus</p>
                      <p className="text-xs truncate font-mono text-zinc-300 max-w-[180px]">
                        {customFile ? customFile.name : (activeDiagnosis ? activeDiagnosis.plantName : "Ready to scan")}
                      </p>
                    </div>
                    {activeDiagnosis && (
                      <div className="bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-400/30 text-[10px] font-mono">
                        SCAN OK
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/95 cursor-pointer hover:bg-zinc-950 transition-colors"
                  onClick={() => document.getElementById("file-loader-input")?.click()}
                >
                  <div className="w-16 h-16 bg-emerald-950 border border-emerald-800 rounded-full flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h4 className="text-white text-lg font-bold">Upload Leaf Photo</h4>
                  <p className="text-zinc-400 text-xs mt-1 max-w-[220px]">
                    Drag & drop your leaf image here or <span className="text-yellow-400 font-bold underline">browse local files</span>.
                  </p>
                </div>
              )}
            </div>

            {/* Diagnostic trigger panel */}
            <div className="p-4 bg-emerald-800 text-white border-t border-emerald-700 flex flex-col gap-3">
              <div className="flex justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={openCameraWithPermissionCheck}
                  className="bg-emerald-700 hover:bg-emerald-600 text-emerald-100 flex-1 py-3 px-3 rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-600"
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-xs sm:text-sm">Use Live Camera</span>
                </button>

                <label className="bg-emerald-700 hover:bg-emerald-600 text-emerald-100 flex-1 py-3 px-3 rounded-2xl font-semibold transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-600 cursor-pointer text-center">
                  <Upload className="w-4 h-4 inline" />
                  <span className="text-xs sm:text-sm">Upload File</span>
                  <input
                    id="file-loader-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {selectedImage && (
                <button
                  id="run-scan-btn"
                  disabled={isLoading}
                  onClick={() => runPlantScan()}
                  className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:bg-neutral-600 hover:scale-[1.02] text-emerald-950 font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md mt-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Diagnosing Plant...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-emerald-800" />
                      <span>Diagnose Selected Image</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* DYNAMIC WHIMSICAL DIAGNOSTIC LOADER OVERLAY */}
          {isLoading && (
            <div id="loader-toast" className="bg-white rounded-3xl p-6 shadow-xl border-4 border-yellow-400 animate-pulse flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-xl animate-spin">
                  🌿
                </div>
                <div className="absolute -top-1 -right-1 bg-yellow-400 text-[8px] px-1 rounded font-black">AI</div>
              </div>
              <div className="flex-1">
                <span className="text-[10px] uppercase font-black text-amber-500 tracking-wider">LeafyLogic is investigating</span>
                <p className="text-sm font-bold text-emerald-950 italic mt-0.5">
                  "{FUNNY_LOADER_PHRASES[loadingPhraseIndex]}"
                </p>
                <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-100 p-2 rounded-xl mt-2 flex items-center gap-1.5 leading-relaxed">
                  ⏳ <span>Please wait a moment! It will take a little bit of time to thoroughly scan the leaf and prepare your comprehensive recovery plan.</span>
                </p>
              </div>
            </div>
          )}

          {/* DIAGNOSTIC ERROR DIALOG / EXILE ALERTS */}
          {diagnosticError && (
            <div id="diagnostic-error-card" className="bg-amber-50 border-4 border-amber-400 rounded-3xl p-5 shadow-md flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-black text-sm text-amber-800">Diagnostic Interrupted</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mt-1">{diagnosticError}</p>
                </div>
              </div>

              {diagnosticError.includes("GEMINI_API_KEY") && (
                <div className="mt-1 bg-amber-100/70 rounded-xl p-3 text-[11px] text-amber-900 border border-amber-300">
                  <p className="font-bold">How to resolve this in AI Studio:</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5 font-mono">
                    <li>Click the <strong>Settings</strong> button in the left bar or top navigation.</li>
                    <li>Open <strong>Secrets</strong> panel.</li>
                    <li>Add <code>GEMINI_API_KEY</code> with your API secret value.</li>
                    <li>Reload the applet and press diagnose!</li>
                  </ol>
                </div>
              )}
            </div>
          )}



        </div>

        {/* RIGHT COLUMN: RECOVERY PLAN DETAILS */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">

          {activeDiagnosis ? (
            <div id="diagnosis-card" className="bg-white rounded-[40px] p-6 md:p-8 shadow-2xl relative overflow-hidden border border-neutral-100">
              
              {/* Confidence Badge Pill */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Active Diagnosis</span>
                </div>

                <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Confidence: {activeDiagnosis.confidenceLevel}</span>
                </div>
              </div>

              {/* Header Title Information */}
              <div className="mb-6">
                <span className="text-xs uppercase tracking-widest font-black text-emerald-400 block mb-1">🌿 SPECIES IDENTIFICATION</span>
                <h2 className="text-3xl md:text-4xl font-black text-emerald-950 leading-tight">
                  {activeDiagnosis.plantName}
                </h2>
                <div className="mt-4 p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-sm flex flex-col gap-1.5">
                  <span className="text-xs font-mono font-bold text-amber-700/85 uppercase tracking-wider block">Primary Flora Diagnosis</span>
                  <p className="text-xl md:text-2xl font-black text-amber-950 leading-snug">
                    🔬 {activeDiagnosis.diseaseName}
                  </p>
                  <span className="text-xs text-emerald-600 font-mono mt-1">
                    Scanned {new Date(activeDiagnosis.timestamp).toLocaleDateString()} at {new Date(activeDiagnosis.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>

              <hr className="border-neutral-100 my-4" />

              {/* What's Happening */}
              <div className="mb-6">
                <h3 className="text-xs uppercase tracking-widest font-black text-emerald-500 mb-2 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-400" />
                  <span>🔍 What’s Happening?</span>
                </h3>
                <p className="text-base md:text-lg leading-relaxed text-zinc-800">
                  {activeDiagnosis.whatsHappening}
                </p>
              </div>

              {/* Grid Treatment Layout matching exact colors of the brand preset */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                
                {/* Pharmacy / Treatment Instructions */}
                <div className="bg-emerald-50/75 rounded-3xl p-5 border border-emerald-100/80 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-emerald-600 mb-3 flex items-center gap-1.5">
                      <font className="text-base">💊</font>
                      <span>The Recovery Plan</span>
                    </h3>
                    
                    <ul className="space-y-4">
                      <li className="flex gap-2.5 text-sm text-emerald-950">
                        <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          1
                        </span>
                        <div>
                          <strong className="block text-[11px] uppercase tracking-wider text-emerald-700">Immediate Action</strong>
                          <span className="text-xs font-medium text-zinc-700 leading-relaxed block">{activeDiagnosis.immediateAction}</span>
                        </div>
                      </li>
                      <li className="flex gap-2.5 text-sm text-emerald-950">
                        <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                          2
                        </span>
                        <div>
                          <strong className="block text-[11px] uppercase tracking-wider text-emerald-700">Treatment Instruction</strong>
                          <span className="text-xs font-medium text-zinc-700 leading-relaxed block">{activeDiagnosis.treatmentCode}</span>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 pt-3 border-t border-emerald-200/50 text-[10px] text-emerald-600 font-medium">
                    * Always wear gardening gloves when applying any spray remedies.
                  </div>
                </div>

                {/* Prevention Pro-tip & Environment Tweak matching right block */}
                <div className="bg-yellow-50 rounded-3xl p-5 border border-yellow-200/70 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs uppercase tracking-widest font-black text-yellow-700 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-yellow-600" />
                        <span>🛡️ Prevention Pro-Tip</span>
                      </h3>
                      <span className="bg-yellow-200 text-[9px] text-yellow-900 font-black px-1.5 rounded uppercase">Guard</span>
                    </div>

                    <p className="text-sm text-zinc-800 leading-relaxed italic mb-4">
                      "{activeDiagnosis.preventionProTip}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-yellow-200 flex flex-col gap-1.5">
                    <div className="text-yellow-700 flex items-center gap-2">
                      <span className="text-lg">🏡</span>
                      <span className="text-xs font-black uppercase tracking-wider">Environment Tweak</span>
                    </div>
                    <p className="text-xs text-zinc-700 leading-relaxed">
                      {activeDiagnosis.environmentTweak}
                    </p>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center justify-center min-h-[400px]">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mb-4 border border-emerald-100">
                🩺
              </div>
              <h2 className="text-2xl font-black text-emerald-950">Let's check those symptoms!</h2>
              <p className="text-zinc-600 text-sm mt-2 max-w-[380px] leading-relaxed">
                LeafyLogic is sitting at her mini gardening desk waiting to assist you! Upload or snap a brand-new custom picture of your plant leaf to get started.
              </p>
            </div>
          )}
 
  

          {/* FLORA DOCS EXPERT CARE NOTES AND ESSENTIAL TRIVIAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-emerald-800 text-white rounded-3xl p-6 shadow-md border-b-4 border-emerald-900">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-yellow-300" />
                <h4 className="font-black text-sm uppercase tracking-wide">Flora’s Organic Apothecary</h4>
              </div>
              <p className="text-[11px] text-emerald-100 leading-relaxed mb-3">
                Need to whipsaw fungal spread immediately without chemicals? Try these whimsical herbal mixtures:
              </p>
              <ul className="text-xs space-y-2 text-emerald-50 font-medium">
                <li>• 🥛 <strong>Milk Wash:</strong> Spray 1 part milk to 9 parts water on zucchini or cucumbers under harsh mid-day sun.</li>
                <li>• 🧄 <strong>Garlic Elixir:</strong> Crush garlic cloves into warm vegetable tea water to disrupt aphid receptors naturally!</li>
                <li>• 🧼 <strong>Castile Spray:</strong> Pure castile emulsifier suffocates spider mite colonies instantly on contact.</li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-emerald-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-black text-sm uppercase tracking-wide text-emerald-950">Did you know?</h4>
                </div>
                <p className="text-xs text-zinc-700 italic leading-relaxed">
                  "Leaves can release stress chemicals to warn neighbouring plants during severe insect invasions so they can release bad-tasting tannins early on. Trees are absolute helpers!"
                </p>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-3">
                LEARN Botanical Wisdom • LeafyLogic Companion App
              </p>
            </div>

          </div>

          {/* FOOTER BRANDING CARD MATCHING VIBRANT BLUE THEME DETAILS */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-emerald-600 text-xs px-4 mt-2 gap-2">
            <p className="font-bold uppercase tracking-wider font-mono">
              STORED IN HISTORIC GARDEN LOGS • ID: #{(activeDiagnosis?.id || "44921").toString().slice(-6)}
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  if (activeDiagnosis) {
                    navigator.clipboard.writeText(`Hi! Check out this Diagnosis from LeafyLogic:\n\nPlant: ${activeDiagnosis.plantName}\nIssue: ${activeDiagnosis.diseaseName}\nConfidence: ${activeDiagnosis.confidenceLevel}\n\nRecovery plan includes immediate action: ${activeDiagnosis.immediateAction}`);
                    showToast("Diagnosis share text copied to clipboard!");
                  } else {
                    showToast("Please select a diagnosed plant first to share.");
                  }
                }}
                className="hover:text-emerald-800 transition-colors cursor-pointer"
              >
                Share Diagnosis
              </button>
              <span className="opacity-25">|</span>
              <button 
                onClick={() => {
                  window.open("https://www.google.com/search?q=gdn+organic+neem+oil+or+copper+fungicide+pack", "_blank");
                }}
                className="hover:text-emerald-800 underline transition-colors cursor-pointer font-bold"
              >
                Buy Treatment
              </button>
            </div>
          </div>

        </div>

      </main>
    ) : activeTab === "history" ? (
      <main className="flex-1 w-full p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* HIGH FIDELITY HISTORY TAB VIEW */}
        <div className="grid grid-cols-12 gap-6 lg:gap-8 w-full">
          
          {/* Left Column: search filter and selector list */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
            
            {/* Header and Statistics area */}
            <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xl flex flex-col gap-4">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="text-lg font-black text-emerald-950 uppercase tracking-tight">History Search & Log</h3>
                  <p className="text-xs text-zinc-500 font-medium">Search, filter, or consult your historic flora scans.</p>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Diary</span>
                  </button>
                )}
              </div>

              {/* Stats segment */}
              <div className="grid grid-cols-3 gap-2 py-3 px-4 bg-emerald-50/55 rounded-2xl border border-emerald-100/50">
                <div className="text-center">
                  <span className="text-[9px] font-black text-emerald-700/80 uppercase block">Total Scans</span>
                  <span className="text-xl font-black text-emerald-950">{history.length}</span>
                </div>
                <div className="text-center border-x border-emerald-100">
                  <span className="text-[9px] font-black text-emerald-700/80 uppercase block">High Conf.</span>
                  <span className="text-xl font-black text-emerald-950">{history.filter(h => h.confidenceLevel === "High").length}</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] font-black text-emerald-700/80 uppercase block">Recent Scan</span>
                  <span className="text-xs font-black text-emerald-950 block mt-1 truncate max-w-[80px] mx-auto">
                    {history.length > 0 ? history[0].plantName : "None"}
                  </span>
                </div>
              </div>

              {/* Live Search bar */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 font-black">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search plant, disease, or symptoms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-emerald-100 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                />
              </div>

              {/* Confidence Filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono font-bold text-zinc-400 mr-1.5 uppercase">Confidence:</span>
                {["all", "High", "Medium", "Low"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setFilterConfidence(level)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                      filterConfidence === level
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {level === "all" ? "All" : level}
                  </button>
                ))}
              </div>
            </div>

            {/* History List Grid */}
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="bg-white rounded-[32px] p-8 border border-emerald-100/50 text-center flex flex-col items-center justify-center min-h-[320px] shadow-xl">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mb-4">
                    📓
                  </div>
                  <h3 className="text-xl font-black text-emerald-950">Your botanical journal is empty!</h3>
                  <p className="text-zinc-650 text-xs mt-1.5 max-w-xs leading-relaxed">
                    Any plant scanned using the live capture viewpoints or loaded files will compile safely here! Let's start diagnostic work.
                  </p>
                  <button
                    onClick={() => setActiveTab("detection")}
                    className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Leaf className="w-4 h-4" />
                    <span>Go to Disease Scanner</span>
                  </button>
                </div>
              ) : history.filter(item => {
                const matchesSearch = item.plantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      item.diseaseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      item.whatsHappening.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesConfidence = filterConfidence === "all" || item.confidenceLevel === filterConfidence;
                return matchesSearch && matchesConfidence;
              }).length === 0 ? (
                <div className="bg-white rounded-[32px] p-8 border border-emerald-100/50 text-center flex flex-col items-center justify-center min-h-[225px] shadow-md">
                  <p className="text-zinc-500 text-xs font-semibold">No botanical records matched your search parameters.</p>
                  <button
                    onClick={() => { setSearchQuery(""); setFilterConfidence("all"); }}
                    className="text-emerald-700 hover:text-emerald-900 font-bold text-xs mt-2 underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.filter(item => {
                    const matchesSearch = item.plantName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          item.diseaseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                          item.whatsHappening.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesConfidence = filterConfidence === "all" || item.confidenceLevel === filterConfidence;
                    return matchesSearch && matchesConfidence;
                  }).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className={`p-3.5 rounded-3xl border text-left cursor-pointer transition-all hover:scale-[1.01] flex items-center gap-4 relative group overflow-hidden ${
                        (selectedHistoryItem?.id === item.id) 
                          ? "bg-emerald-100 border-emerald-300 shadow-md"
                          : "bg-white hover:bg-emerald-50/30 border-emerald-100 shadow-sm"
                      }`}
                    >
                      {item.imageThumbnail ? (
                        <img 
                          src={item.imageThumbnail} 
                          alt={item.plantName} 
                          className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-emerald-100 shadow-inner" 
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-emerald-55 flex items-center justify-center text-xl font-bold shrink-0">
                          🌱
                        </div>
                      )}

                      <div className="flex-1 min-w-0 pr-10">
                        <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md inline-block mb-1">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                        <p className="text-sm font-black text-emerald-950 truncate leading-snug">{item.plantName}</p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{item.diseaseName}</p>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                          item.confidenceLevel === "High" ? "bg-emerald-100 text-emerald-800" :
                          item.confidenceLevel === "Medium" ? "bg-yellow-105 text-yellow-800 bg-yellow-101 border border-yellow-250" :
                          "bg-zinc-100 text-zinc-650"
                        }`}>
                          {item.confidenceLevel}
                        </span>
                      </div>

                      <button
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2 bg-white hover:bg-rose-50 border border-neutral-100 text-zinc-400 hover:text-rose-600 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-sm cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Historical details details workspace viewer */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
            {selectedHistoryItem ? (
              <div id="historical-doc-view" className="bg-white rounded-[40px] p-6 md:p-8 shadow-2xl relative overflow-hidden border border-neutral-100 flex flex-col">
                
                {/* Header stamp */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-10); border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600 font-black" />
                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest font-mono">Archive Consultative Log</span>
                  </div>

                  <div className="bg-zinc-100 text-zinc-800 px-4 py-1.5 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1 border border-neutral-200">
                    <span>Confidence: {selectedHistoryItem.confidenceLevel}</span>
                  </div>
                </div>

                {/* Scanned Image Replica */}
                {selectedHistoryItem.imageThumbnail && (
                  <div className="mb-6 rounded-[24px] overflow-hidden border-4 border-emerald-50 h-48 md:h-56 relative shadow-inner">
                    <img 
                      src={selectedHistoryItem.imageThumbnail} 
                      alt={selectedHistoryItem.plantName} 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-amber-300">HISTORICAL VIEW</span>
                      <p className="text-xl font-black italic">{selectedHistoryItem.plantName}</p>
                    </div>
                  </div>
                )}

                {/* Plant species info */}
                <div className="mb-6">
                  <span className="text-xs uppercase tracking-widest font-black text-emerald-400 block mb-1">🌿 SPECIES IDENTIFICATION</span>
                  <h2 className="text-3xl md:text-4xl font-black text-emerald-950 leading-tight">
                    {selectedHistoryItem.plantName}
                  </h2>
                  <div className="mt-4 p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 shadow-sm flex flex-col gap-1.5">
                    <span className="text-xs font-mono font-bold text-amber-700/85 uppercase tracking-wider block">Recorded flora Diagnosis</span>
                    <p className="text-xl md:text-2xl font-black text-amber-955 leading-snug">
                      🔬 {selectedHistoryItem.diseaseName}
                    </p>
                    <span className="text-xs text-emerald-600 font-mono mt-1">
                      Scanned {new Date(selectedHistoryItem.timestamp).toLocaleDateString()} at {new Date(selectedHistoryItem.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>

                <hr className="border-zinc-100 my-4" />

                {/* What's Happening description */}
                <div className="mb-6">
                  <h3 className="text-xs uppercase tracking-widest font-black text-emerald-500 mb-2 flex items-center gap-1.5 font-sans">
                    <Info className="w-4 h-4 text-emerald-400" />
                    <span>🔍 Diagnostic Symptoms</span>
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed text-zinc-800">
                    {selectedHistoryItem.whatsHappening}
                  </p>
                </div>

                {/* Recommendations Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  
                  <div className="bg-emerald-50/75 rounded-3xl p-5 border border-emerald-100/80 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs uppercase tracking-widest font-black text-emerald-600 mb-3 flex items-center gap-1.5">
                        <span className="text-base">💊</span>
                        <span>Recovery Blueprint</span>
                      </h3>
                      
                      <ul className="space-y-4">
                        <li className="flex gap-2.5 text-sm text-emerald-950">
                          <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            1
                          </span>
                          <div>
                            <strong className="block text-[11px] uppercase tracking-wider text-emerald-700">Immediate Action</strong>
                            <span className="text-xs font-medium text-zinc-700 leading-relaxed block">{selectedHistoryItem.immediateAction}</span>
                          </div>
                        </li>
                        <li className="flex gap-2.5 text-sm text-emerald-950">
                          <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            2
                          </span>
                          <div>
                            <strong className="block text-[11px] uppercase tracking-wider text-emerald-700">Treatment Plan</strong>
                            <span className="text-xs font-medium text-zinc-700 leading-relaxed block">{selectedHistoryItem.treatmentCode}</span>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-3xl p-5 border border-yellow-200/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs uppercase tracking-widest font-black text-yellow-700 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-yellow-600" />
                          <span>🛡️ Proactive Prevention</span>
                        </h3>
                      </div>

                      <p className="text-sm text-zinc-800 leading-relaxed italic mb-4">
                        "{selectedHistoryItem.preventionProTip}"
                      </p>

                      <div className="pt-4 border-t border-yellow-250 flex flex-col gap-1.5">
                        <div className="text-yellow-700 flex items-center gap-2">
                          <span className="text-lg">🏡</span>
                          <span className="text-xs font-black uppercase tracking-wider">Environment Tweak</span>
                        </div>
                        <p className="text-xs text-zinc-700 leading-relaxed">
                          {selectedHistoryItem.environmentTweak}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Social share & search Treatment shortcuts */}
                <div className="flex flex-col sm:flex-row justify-between items-center text-emerald-600 text-xs px-4 mt-6 pt-4 border-t border-zinc-100 gap-2">
                  <p className="font-bold uppercase tracking-wider font-mono">
                    ARCHIVE LOG ID: #{selectedHistoryItem.id.slice(-6)}
                  </p>
                  <div className="flex gap-4 font-bold font-mono">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`Hi! Check out this Diagnosis from LeafyLogic:\n\nPlant: ${selectedHistoryItem.plantName}\nIssue: ${selectedHistoryItem.diseaseName}\nConfidence: ${selectedHistoryItem.confidenceLevel}\n\nRecovery plan includes: ${selectedHistoryItem.immediateAction}`);
                        showToast("Diagnosis share text copied to clipboard!");
                      }}
                      className="hover:text-emerald-800 transition-colors cursor-pointer"
                    >
                      Share Log
                    </button>
                    <span className="opacity-25">|</span>
                    <button 
                      onClick={() => {
                        window.open(`https://www.google.com/search?q=gdn+organic+neem+oil+or+copper+fungicide+pack`, "_blank");
                      }}
                      className="hover:text-emerald-800 underline transition-colors cursor-pointer"
                    >
                      Buy Treatment
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white rounded-[40px] p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center justify-center min-h-[360px] border border-neutral-150">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mb-4 border border-emerald-100">
                  📊
                </div>
                <h2 className="text-xl font-black text-emerald-950">Select a record to deep dive</h2>
                <p className="text-zinc-650 text-wrap text-xs mt-2 max-w-[320px] leading-relaxed">
                  Click on any listed historical session in the search panel to reload its comprehensive recovery details.
                </p>
              </div>
            )}
          </div>

        </div>
        
      </main>
    ) : activeTab === "dosage" ? (
      <main className="flex-1 w-full p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        {/* PRECISION DOSAGE TAB CONTENT */}
        <div className="bg-white rounded-[32px] p-6 border border-emerald-100 shadow-xl flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-black text-emerald-950 uppercase tracking-tight">1. Source Plant Diagnosis Selection</h3>
            <p className="text-xs text-zinc-500 font-medium">Select a diagnosis from your recent AI scans directory to configure the precision chemical calculations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
            {/* Recent Scans Selection Panel */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono text-emerald-800">Recent AI Diagnostics Records ({history.length})</span>
              {history.length === 0 ? (
                <div className="p-6 bg-zinc-50 border-2 border-dashed border-emerald-100 rounded-3xl text-sm text-zinc-500 italic text-center flex flex-col items-center justify-center min-h-[160px]">
                  <span>📓 No previous AI scans recorded yet.</span>
                  <button 
                    onClick={() => setActiveTab("detection")}
                    className="mt-3 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg uppercase tracking-wide cursor-pointer transition-all animate-pulse"
                  >
                    Go scan a leaf
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setDosageDiseaseName(h.diseaseName);
                        setDosageScanId(h.id);
                        showToast(`Loaded ${h.plantName} (${h.diseaseName}) diagnosis stats!`);
                      }}
                      className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        dosageScanId === h.id 
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.01]" 
                          : "bg-emerald-50/10 hover:bg-emerald-50/50 text-emerald-950 border-emerald-150"
                      }`}
                    >
                      <div className="truncate pr-4">
                        <p className="truncate leading-tight font-black">{h.plantName}</p>
                        <p className={`text-[10px] truncate mt-0.5 ${dosageScanId === h.id ? "text-emerald-100" : "text-zinc-500"}`}>{h.diseaseName}</p>
                      </div>
                      <span className={`text-[9px] px-2 py-1 rounded font-mono uppercase font-black tracking-wide ${
                        dosageScanId === h.id ? "bg-white text-emerald-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        Use
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Highlight Selection Panel */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono text-emerald-800">Active Target Information</span>
              <div className="p-5 bg-gradient-to-br from-emerald-50 to-zinc-50 border border-emerald-150 rounded-3xl flex flex-col justify-between h-full min-h-[160px]">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-mono font-black text-emerald-800 uppercase tracking-widest">Active Calculator Model</span>
                  </div>
                  <h4 className="text-sm font-black text-emerald-950 leading-tight">
                    {dosageDiseaseName || "No Target Disease Loaded"}
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    ID: {dosageScanId === "manual-override" ? "Manual Profile" : dosageScanId}
                  </p>
                </div>
                
                <p className="text-[10.5px] text-zinc-400 italic leading-relaxed mt-4">
                  💡 Diagnostics records are generated automatically during AI scanning. Switch to the <strong className="text-emerald-800">Diagnose</strong> tab to scan a leaf and load fresh automated parameters.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic treatment dosage component */}
        <TreatmentPrescriptionCard
          diseaseName={dosageDiseaseName}
          scanId={dosageScanId}
          onShowToast={showToast}
          onScheduleRoutine={async (params) => {
            try {
              const res = await fetch("/api/v1/treatments/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params)
              });
              if (res.ok) {
                showToast(`📅 Active compliance timeline launched for ${params.disease_name}!`);
                setActiveTab("tracker");
              } else {
                const err = await res.json();
                showToast(`Initialization: ${err.error || "Cannot configure schedules."}`);
              }
            } catch (e) {
              showToast(`Initialized garden scheduler backup.`);
              setActiveTab("tracker");
            }
          }}
        />
      </main>
    ) : (
      <TreatmentCalendarTracker
        onShowToast={showToast}
        onNavigateToTab={(newTab) => setActiveTab(newTab)}
        recentScans={history}
      />
    )}

  </div>
</div>

      {/* RENDER ACTIVE LIVE CAM DRAWER MODAL UPON CLICK */}
      {isCameraActive && (
        <CameraCapture 
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraActive(false)}
        />
      )}

      {/* CUSTOM TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 text-zinc-100 text-xs font-bold px-6 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-emerald-800 flex items-center gap-2.5 max-w-sm hover:scale-[1.02] transition-transform">
          <div className="bg-emerald-900/50 p-1.5 rounded-lg text-yellow-400">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CLEAR HISTORY CONFIRMATION MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-6 md:p-8 shadow-2xl border-4 border-emerald-100 flex flex-col gap-4 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-100 mb-2">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-black text-emerald-950">Clear Garden History?</h3>
              <p className="text-zinc-600 text-xs leading-relaxed mt-2">
                This will permanently delete your entire record of plant scans from your browser storage. You won't be able to recover this data.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-emerald-900 font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Keep History
              </button>
              <button
                onClick={clearAllHistory}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md shadow-rose-100/50 transition-all active:scale-95 cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMERA BLOCKED INSTRUCTIONS MODAL */}
      {showCameraInstructions && (
        <div className="fixed inset-0 z-50 bg-zinc-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-sm w-full p-6 md:p-8 shadow-2xl border-4 border-amber-100 flex flex-col gap-4 text-center">
            <div className="relative">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto border border-amber-100 mb-2">
                <AlertTriangle className="w-7 h-7 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-emerald-950">Camera Permission Blocked</h3>
              <p className="text-zinc-600 text-xs leading-relaxed mt-2">
                Your browser has restricted camera access for FloraPathologist. To utilize live viewfinder leaf scan diagnostics, please restore camera access!
              </p>
            </div>
            
            <div className="bg-amber-50/70 border border-amber-150 p-4 rounded-2xl text-left text-xs text-emerald-950">
              <p className="font-bold text-amber-700 mb-2">🔓 Simple Steps to Allow:</p>
              <ol className="list-decimal pl-4 space-y-1 text-zinc-700 font-medium">
                <li>Look at your browser's address/search bar at the top of the screen.</li>
                <li>Click on the **Lock Icon** 🔒 next to the web URL.</li>
                <li>Find **Camera** in the dialog settings and option toggle to **Allow**.</li>
                <li>Close the settings panel, reload the application, and start snapping!</li>
              </ol>
            </div>

            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => setShowCameraInstructions(false)}
                className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-emerald-900 font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowCameraInstructions(false);
                  window.location.reload();
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
