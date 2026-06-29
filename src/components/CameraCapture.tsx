import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, X, AlertTriangle, Check } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Cleanup stream tracks when stream changes or component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Initialize camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setLoading(true);
      setError(null);
      try {
        // Prefer rear camera on mobile devices with smart standard constraints
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        // Request permission and standard stream first.
        // This is crucial because enumerateDevices() doesn't return ID or labels until permission is granted.
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Now that permission is granted, list real cameras with non-empty IDs/labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        setCameras(videoDevices);

        // Map current active stream's track device ID to active state
        const activeTrack = mediaStream.getVideoTracks()[0];
        if (activeTrack) {
          const settings = activeTrack.getSettings();
          if (settings.deviceId) {
            setActiveCameraId(settings.deviceId);
          } else if (videoDevices.length > 0) {
            setActiveCameraId(videoDevices[0].deviceId);
          }
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        const errName = err?.name || "";
        const errMsg = err?.message || "";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError" || errMsg.includes("Permission denied")) {
          setError("NotAllowedError: Camera permission was denied. The browser is blocked from accessing your camera.");
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError" || errMsg.includes("Requested device not found")) {
          setError("NotFoundError: No physical camera hardware was found on this device.");
        } else {
          setError(`Camera Error: ${errMsg || "Could not access camera source. Please check browser settings or upload a saved file instead."}`);
        }
      } finally {
        setLoading(false);
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => {
          if (track.readyState === "live") {
            track.stop();
          }
        });
      }
    };
  }, []);

  // Switch between cameras
  const switchCamera = async (deviceId: string) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setLoading(true);
    setError(null);
    try {
      setActiveCameraId(deviceId);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Switch camera error:", err);
      setError("Failed to switch camera. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        let targetWidth = video.videoWidth || 640;
        let targetHeight = video.videoHeight || 480;

        // Downscale to max 800px dimensions to keep the transfer light and blistering fast
        const maxDimension = 800;
        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Convert to base64 with slight compression for ultra speed
        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        onCapture(dataUrl);
        
        // Clean up and close
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        onClose();
      }
    }
  };

  const cycleCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    switchCamera(cameras[nextIndex].deviceId);
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-neutral-200 max-w-lg w-full flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-300" />
            <h3 className="font-semibold text-lg">LeafyLogic Live Cam</h3>
          </div>
          <button 
            onClick={() => {
              if (stream) {
                stream.getTracks().forEach(track => track.stop());
              }
              onClose();
            }}
            className="p-1 hover:bg-emerald-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder or Error */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-neutral-950/90 gap-3">
              <RefreshCw className="w-10 h-10 animate-spin text-emerald-400" />
              <p className="text-sm font-mono tracking-wide">Warm-up camera lenses...</p>
            </div>
          )}

          {error ? (
            <div className="p-6 text-center text-white max-w-md flex flex-col items-center gap-4">
              <AlertTriangle className="w-12 h-12 text-amber-400 animate-pulse" />
              <div className="flex flex-col gap-1">
                <h4 className="text-base font-black text-white uppercase tracking-wider">
                  {error.includes("NotAllowed") ? "Camera Permission Denied" : "Camera Access Issue"}
                </h4>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-sm mx-auto">{error}</p>
              </div>

              {(error.includes("NotAllowed") || error.includes("permission")) && (
                <div className="bg-neutral-900/95 border border-neutral-800 p-4 rounded-2xl text-left text-xs text-neutral-200 mt-1 max-w-sm">
                  <p className="font-bold text-yellow-400 mb-2">🔓 Simple Steps to Reset Permissions:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-neutral-300 font-medium">
                    <li>Look at your browser's address bar.</li>
                    <li>Click on the **Lock Icon** 🔒 (or settings button) on the far-left of the URL.</li>
                    <li>Locate **Camera** in the permissions list.</li>
                    <li>Select **Allow** (or reset the permission state).</li>
                    <li>Close this camera window and retry scanning!</li>
                  </ol>
                </div>
              )}

              <button 
                onClick={onClose}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-xs"
              >
                Return to Upload Area
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover aspect-video"
            />
          )}

          {/* Hidden Canvas */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer actions */}
        {!error && !loading && (
          <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-4 w-full">
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={cycleCamera}
                  className="p-3 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-600 rounded-full transition-all active:scale-95 shadow-sm"
                  title="Switch Camera"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}

              <button
                type="button"
                onClick={handleCapture}
                className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 scale-105"
              >
                <Camera className="w-5 h-5" />
                <span>Snap Diagnostic Photo</span>
              </button>

              <div className="p-3 opacity-0 cursor-default">
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium">Place the infected/diseased leaf clearly in the center of the screen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
