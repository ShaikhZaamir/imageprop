"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Stage = "idle" | "preview" | "uploading" | "processing" | "done" | "error";

// Messages shown at each attempt interval (every 3s = each attempt)
const PROCESSING_MESSAGES = [
  "Running Azure Function…",
  "Still working on it…",
  "Applying transformations…",
  "Almost there, hang tight…",
  "This one's taking a moment…",
  "Still processing, please wait…",
  "Finalising your image…",
  "Azure is crunching the pixels…",
  "Nearly done now…",
  "Just a bit longer…",
];

const MAX_ATTEMPTS = 20; // 20 × 3s = 60s max (8s avg + generous buffer)

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Progress & messages
  const [attempts, setAttempts] = useState(0);
  const [progress, setProgress] = useState(0); // 0–100
  const [loadingMsg, setLoadingMsg] = useState(PROCESSING_MESSAGES[0]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth progress ticker (runs every 400ms, fills up toward current attempt %)
  useEffect(() => {
    if (stage === "processing") {
      progressRef.current = setInterval(() => {
        setProgress((prev) => {
          const target = Math.min((attempts / MAX_ATTEMPTS) * 85, 85);
          const next = prev + (target - prev) * 0.12;
          return next;
        });
      }, 400);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
      if (stage === "done") setProgress(100);
      if (stage === "idle" || stage === "preview") setProgress(0);
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [stage, attempts]);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("image/")) return;
    setFile(selectedFile);
    setImage(URL.createObjectURL(selectedFile));
    setProcessedUrl(null);
    setUploadedUrl(null);
    setMessage("");
    setAttempts(0);
    setProgress(0);
    setStage("preview");
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const checkProcessedImage = (url: string) => {
    let att = 0;
    setAttempts(0);
    setLoadingMsg(PROCESSING_MESSAGES[0]);
    setStage("processing");

    const interval = setInterval(async () => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) {
          setProcessedUrl(url);
          setStage("done");
          clearInterval(interval);
          return;
        }
      } catch { /* continue */ }

      att++;
      setAttempts(att);
      const msgIdx = Math.min(att, PROCESSING_MESSAGES.length - 1);
      setLoadingMsg(PROCESSING_MESSAGES[msgIdx]);

      if (att > MAX_ATTEMPTS) {
        setStage("error");
        setMessage("Processing timed out. Please try again.");
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setStage("uploading");
    setMessage("");
    setProcessedUrl(null);

    try {
      const fileName = `${Date.now()}-${file.name}`;
      const sasBase = "https://imageprop.blob.core.windows.net/uploads";
      const sasToken =
        "?sp=rcw&st=2026-05-05T08:17:40Z&se=2026-05-10T16:32:40Z&spr=https&sv=2025-11-05&sr=c&sig=RErcCtQyHFEBzzbwN%2BOQ2VpIntfH4yj6t1OBIW4fN4o%3D";

      const res = await fetch(`${sasBase}/${fileName}${sasToken}`, {
        method: "PUT",
        headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Upload failed");

      const fileUrl = `${sasBase}/${fileName}`;
      setUploadedUrl(fileUrl);
      checkProcessedImage(fileUrl.replace("/uploads/", "/processed/"));
    } catch {
      setStage("error");
      setMessage("Upload failed. Please check your connection and try again.");
    }
  };

  const handleReset = () => {
    setImage(null);
    setFile(null);
    setStage("idle");
    setMessage("");
    setUploadedUrl(null);
    setProcessedUrl(null);
    setAttempts(0);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileSizeLabel = file
    ? file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`
    : null;

  const isActive = stage !== "idle";

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">

      {/* ── Sticky Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-800">ImageProp</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Live status pill */}
          {stage === "processing" && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Processing
            </div>
          )}
          {stage === "done" && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Complete
            </div>
          )}
          <span className="text-xs font-medium text-slate-600 bg-slate-200 border border-slate-200 px-3 py-1 rounded-full">
            Azure Pipeline
          </span>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL: Upload / Controls ── */}
        <div className="w-[380px] shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
          <div className="flex-1 p-6 flex flex-col gap-5">

            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                Image Processing
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Upload &amp; Process</h1>
              <p className="text-slate-600 text-xs leading-relaxed">
                Upload an image - processed by Azure Function and returned automatically.
              </p>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !isActive && fileInputRef.current?.click()}
              className={`
                rounded-2xl border-2 border-dashed transition-all duration-200
                flex flex-col items-center justify-center gap-3 py-10 px-6
                ${isActive ? "opacity-50 cursor-default" : "cursor-pointer"}
                ${isDragging
                  ? "border-indigo-400 bg-indigo-50"
                  : isActive
                    ? "border-slate-400 bg-slate-50"
                    : "border-slate-400 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
                }
              `}
            >
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm
                ${isDragging ? "bg-indigo-100" : "bg-white"}
              `}>
                <svg width="20" height="20" viewBox="0 0 22 22" fill="none"
                  className={isDragging ? "text-indigo-500" : "text-slate-600"}>
                  <path d="M11 3v12M11 3l-4 4M11 3l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 15v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-800">
                  {isDragging ? "Drop to upload" : isActive ? "File selected" : "Drop image or click to browse"}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">PNG, JPG, WEBP · Up to 20 MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </div>

            {/* File info */}
            {file && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="1" width="12" height="12" rx="2" stroke="#6366f1" strokeWidth="1.2" />
                      <path d="M3 9l2.5-2.5L7.5 8l2-2.5 1.5 2" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{file.name}</p>
                    <p className="text-[11px] text-slate-400">{fileSizeLabel}</p>
                  </div>
                </div>
                {(stage === "preview" || stage === "error") && (
                  <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 shrink-0">
                    Remove
                  </button>
                )}
                {stage === "done" && (
                  <button onClick={handleReset} className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 shrink-0">
                    New
                  </button>
                )}
              </div>
            )}

            {/* Action button / status */}
            <div>
              {stage === "preview" && (
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all text-sm font-semibold text-white shadow-sm shadow-indigo-200"
                >
                  Upload &amp; Process
                </button>
              )}

              {stage === "uploading" && (
                <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-slate-200">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">Uploading to Azure…</span>
                </div>
              )}

              {stage === "processing" && (
                <div className="space-y-3">
                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">Processing</span>
                      <span className="text-[11px] text-slate-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  {/* Animated message */}
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-3.5 h-3.5 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin shrink-0" />
                    <span className="text-xs text-amber-700 font-medium transition-all duration-500">{loadingMsg}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center">
                    {/* Attempt {attempts + 1} of {MAX_ATTEMPTS} · checking every 3s */}
                  </p>
                </div>
              )}

              {stage === "done" && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-emerald-600">Complete</span>
                      <span className="text-[11px] text-emerald-600">100%</span>
                    </div>
                    <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <path d="M3 7.5l3 3 6-6" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-xs font-semibold text-emerald-700">Processing complete</span>
                  </div>
                  {processedUrl && (
                    <a
                      href={processedUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-2"
                    >
                      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                        <path d="M6.5 2v7M6.5 9l-3-3M6.5 9l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      Download processed image
                    </a>
                  )}
                </div>
              )}

              {stage === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-red-50 border border-red-200">
                    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="shrink-0">
                      <path d="M7.5 5v4M7.5 11h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="7.5" cy="7.5" r="6" stroke="#dc2626" strokeWidth="1.2" />
                    </svg>
                    <span className="text-xs text-red-600 font-medium">{message}</span>
                  </div>
                  <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs text-slate-500 font-medium">
                    Retry upload
                  </button>
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Pipeline steps */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {[
                { color: "text-indigo-500 bg-indigo-50", label: "Upload", desc: "Azure Blob" },
                { color: "text-amber-600 bg-amber-50", label: "Process", desc: "Azure Function" },
                { color: "text-emerald-600 bg-emerald-50", label: "Retrieve", desc: "Processed" },
              ].map((s, i) => (
                <div key={i} className={`${s.color} rounded-xl p-2.5 text-center`}>
                  <p className="text-[11px] font-bold">{s.label}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Image Preview ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7]">

          {stage === "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-slate-300">
                  <rect x="3" y="3" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="10" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4 20l5.5-5.5 4 4 3.5-4 5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-400">No image selected</p>
                <p className="text-xs text-slate-300 mt-1">Upload an image on the left to get started</p>
              </div>
            </div>
          )}

          {isActive && (
            <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">

              {/* Original */}
              <div className="flex flex-col border-r border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider">Original</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7]">
                  {image && (
                    <img
                      src={image}
                      alt="Original"
                      className="max-w-[80%] max-h-full object-contain rounded-xl shadow-md"
                    />
                  )}
                </div>
              </div>

              {/* Processed */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${stage === "done" ? "bg-emerald-400"
                      : stage === "processing" ? "bg-amber-400 animate-pulse"
                        : "bg-slate-400"
                    }`} />
                  <span className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider">Processed</span>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7]">
                  {processedUrl ? (
                    <img
                      src={processedUrl}
                      alt="Processed"
                      className="max-w-[80%] max-h-full object-contain rounded-xl shadow-md"
                    />
                  ) : stage === "processing" || stage === "uploading" ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-slate-500 transition-all duration-500">{loadingMsg}</p>
                        {stage === "processing" && (
                          <p className="text-xs text-slate-400 mt-1">
                            ~{Math.max(0, (MAX_ATTEMPTS - attempts) * 3)}s remaining estimate
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-slate-300">
                          <rect x="2" y="2" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M7 14l3-3 2.5 2.5 2-2.5 2.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-400">Awaiting processing</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




// "use client";

// import { useState, useRef, useCallback, useEffect } from "react";

// type Stage = "idle" | "preview" | "uploading" | "processing" | "done" | "error";

// // Messages shown at each attempt interval (every 5s = each attempt)
// const PROCESSING_MESSAGES = [
//   "Running Azure Function…",
//   "Still working on it…",
//   "Applying transformations…",
//   "Almost there, hang tight…",
//   "This one's taking a moment…",
//   "Still processing, please wait…",
//   "Finalising your image…",
//   "Azure is crunching the pixels…",
//   "Nearly done now…",
//   "Just a bit longer…",
// ];

// const MAX_ATTEMPTS = 30; // 30 × 5s = 150s max

// export default function Home() {
//   const [image, setImage] = useState<string | null>(null);
//   const [file, setFile] = useState<File | null>(null);
//   const [stage, setStage] = useState<Stage>("idle");
//   const [message, setMessage] = useState("");
//   const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
//   const [processedUrl, setProcessedUrl] = useState<string | null>(null);
//   const [isDragging, setIsDragging] = useState(false);

//   // Progress & messages
//   const [attempts, setAttempts] = useState(0);
//   const [progress, setProgress] = useState(0); // 0–100
//   const [loadingMsg, setLoadingMsg] = useState(PROCESSING_MESSAGES[0]);

//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   // Smooth progress ticker (runs every 500ms, fills up toward current attempt %)
//   useEffect(() => {
//     if (stage === "processing") {
//       progressRef.current = setInterval(() => {
//         setProgress((prev) => {
//           const target = Math.min((attempts / MAX_ATTEMPTS) * 95, 95);
//           const next = prev + (target - prev) * 0.12;
//           return next;
//         });
//       }, 500);
//     } else {
//       if (progressRef.current) clearInterval(progressRef.current);
//       if (stage === "done") setProgress(100);
//       if (stage === "idle" || stage === "preview") setProgress(0);
//     }
//     return () => {
//       if (progressRef.current) clearInterval(progressRef.current);
//     };
//   }, [stage, attempts]);

//   const handleFile = (selectedFile: File) => {
//     if (!selectedFile.type.startsWith("image/")) return;
//     setFile(selectedFile);
//     setImage(URL.createObjectURL(selectedFile));
//     setProcessedUrl(null);
//     setUploadedUrl(null);
//     setMessage("");
//     setAttempts(0);
//     setProgress(0);
//     setStage("preview");
//   };

//   const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const f = e.target.files?.[0];
//     if (f) handleFile(f);
//   };

//   const handleDrop = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(false);
//     const f = e.dataTransfer.files?.[0];
//     if (f) handleFile(f);
//   }, []);

//   const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
//   const handleDragLeave = () => setIsDragging(false);

//   const checkProcessedImage = (url: string) => {
//     let att = 0;
//     setAttempts(0);
//     setLoadingMsg(PROCESSING_MESSAGES[0]);
//     setStage("processing");

//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(url, { method: "HEAD" });
//         if (res.ok) {
//           setProcessedUrl(url);
//           setStage("done");
//           clearInterval(interval);
//           return;
//         }
//       } catch { /* continue */ }

//       att++;
//       setAttempts(att);
//       const msgIdx = Math.min(att, PROCESSING_MESSAGES.length - 1);
//       setLoadingMsg(PROCESSING_MESSAGES[msgIdx]);

//       if (att > MAX_ATTEMPTS) {
//         setStage("error");
//         setMessage("Processing timed out. Please try again.");
//         clearInterval(interval);
//       }
//     }, 5000);
//   };

//   const handleSubmit = async () => {
//     if (!file) return;
//     setStage("uploading");
//     setMessage("");
//     setProcessedUrl(null);

//     try {
//       const fileName = `${Date.now()}-${file.name}`;
//       const sasBase = "https://imageprop.blob.core.windows.net/uploads";
//       const sasToken =
//         "?sp=rcw&st=2026-05-05T08:17:40Z&se=2026-05-10T16:32:40Z&spr=https&sv=2025-11-05&sr=c&sig=RErcCtQyHFEBzzbwN%2BOQ2VpIntfH4yj6t1OBIW4fN4o%3D";

//       const res = await fetch(`${sasBase}/${fileName}${sasToken}`, {
//         method: "PUT",
//         headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type },
//         body: file,
//       });

//       if (!res.ok) throw new Error("Upload failed");

//       const fileUrl = `${sasBase}/${fileName}`;
//       setUploadedUrl(fileUrl);
//       checkProcessedImage(fileUrl.replace("/uploads/", "/processed/"));
//     } catch {
//       setStage("error");
//       setMessage("Upload failed. Please check your connection and try again.");
//     }
//   };

//   const handleReset = () => {
//     setImage(null);
//     setFile(null);
//     setStage("idle");
//     setMessage("");
//     setUploadedUrl(null);
//     setProcessedUrl(null);
//     setAttempts(0);
//     setProgress(0);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   const fileSizeLabel = file
//     ? file.size > 1024 * 1024
//       ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
//       : `${(file.size / 1024).toFixed(0)} KB`
//     : null;

//   const isActive = stage !== "idle";

//   return (
//     <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">

//       {/* ── Sticky Nav ── */}
//       <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-6 h-14 flex items-center justify-between shrink-0">
//         <div className="flex items-center gap-2.5">
//           <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
//             <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//               <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
//               <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
//               <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
//               <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
//             </svg>
//           </div>
//           <span className="text-sm font-bold tracking-tight text-slate-800">ImageProp</span>
//         </div>
//         <div className="flex items-center gap-3">
//           {/* Live status pill */}
//           {stage === "processing" && (
//             <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
//               <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
//               Processing
//             </div>
//           )}
//           {stage === "done" && (
//             <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-1 rounded-full">
//               <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
//               Complete
//             </div>
//           )}
//           <span className="text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
//             Azure Pipeline
//           </span>
//         </div>
//       </nav>

//       {/* ── Main Content ── */}
//       <div className="flex-1 flex overflow-hidden">

//         {/* ── LEFT PANEL: Upload / Controls ── */}
//         <div className="w-[380px] shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
//           <div className="flex-1 p-6 flex flex-col gap-5">

//             {/* Header */}
//             <div>
//               <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-3">
//                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
//                 Image Processing
//               </div>
//               <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Upload &amp; Process</h1>
//               <p className="text-slate-400 text-xs leading-relaxed">
//                 Upload an image — processed by Azure Function and returned automatically.
//               </p>
//             </div>

//             {/* Drop Zone */}
//             <div
//               onDrop={handleDrop}
//               onDragOver={handleDragOver}
//               onDragLeave={handleDragLeave}
//               onClick={() => !isActive && fileInputRef.current?.click()}
//               className={`
//                 rounded-2xl border-2 border-dashed transition-all duration-200
//                 flex flex-col items-center justify-center gap-3 py-10 px-6
//                 ${isActive ? "opacity-50 cursor-default" : "cursor-pointer"}
//                 ${isDragging
//                   ? "border-indigo-400 bg-indigo-50"
//                   : isActive
//                     ? "border-slate-200 bg-slate-50"
//                     : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
//                 }
//               `}
//             >
//               <div className={`
//                 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm
//                 ${isDragging ? "bg-indigo-100" : "bg-white"}
//               `}>
//                 <svg width="20" height="20" viewBox="0 0 22 22" fill="none"
//                   className={isDragging ? "text-indigo-500" : "text-slate-400"}>
//                   <path d="M11 3v12M11 3l-4 4M11 3l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//                   <path d="M3 15v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
//                 </svg>
//               </div>
//               <div className="text-center">
//                 <p className="text-xs font-semibold text-slate-500">
//                   {isDragging ? "Drop to upload" : isActive ? "File selected" : "Drop image or click to browse"}
//                 </p>
//                 <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG, WEBP · Up to 20 MB</p>
//               </div>
//               <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
//             </div>

//             {/* File info */}
//             {file && (
//               <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
//                 <div className="flex items-center gap-2.5">
//                   <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
//                     <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
//                       <rect x="1" y="1" width="12" height="12" rx="2" stroke="#6366f1" strokeWidth="1.2" />
//                       <path d="M3 9l2.5-2.5L7.5 8l2-2.5 1.5 2" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
//                     </svg>
//                   </div>
//                   <div className="min-w-0">
//                     <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{file.name}</p>
//                     <p className="text-[11px] text-slate-400">{fileSizeLabel}</p>
//                   </div>
//                 </div>
//                 {(stage === "preview" || stage === "error") && (
//                   <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 shrink-0">
//                     Remove
//                   </button>
//                 )}
//                 {stage === "done" && (
//                   <button onClick={handleReset} className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 shrink-0">
//                     New
//                   </button>
//                 )}
//               </div>
//             )}

//             {/* Action button / status */}
//             <div>
//               {stage === "preview" && (
//                 <button
//                   onClick={handleSubmit}
//                   className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all text-sm font-semibold text-white shadow-sm shadow-indigo-200"
//                 >
//                   Upload &amp; Process
//                 </button>
//               )}

//               {stage === "uploading" && (
//                 <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-slate-200">
//                   <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
//                   <span className="text-sm text-slate-500">Uploading to Azure…</span>
//                 </div>
//               )}

//               {stage === "processing" && (
//                 <div className="space-y-3">
//                   {/* Progress bar */}
//                   <div className="space-y-1.5">
//                     <div className="flex items-center justify-between">
//                       <span className="text-[11px] font-medium text-slate-500">Processing</span>
//                       <span className="text-[11px] text-slate-400">{Math.round(progress)}%</span>
//                     </div>
//                     <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
//                       <div
//                         className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700"
//                         style={{ width: `${progress}%` }}
//                       />
//                     </div>
//                   </div>
//                   {/* Animated message */}
//                   <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-100">
//                     <div className="w-3.5 h-3.5 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin shrink-0" />
//                     <span className="text-xs text-amber-700 font-medium transition-all duration-500">{loadingMsg}</span>
//                   </div>
//                   <p className="text-[11px] text-slate-400 text-center">
//                     Attempt {attempts + 1} of {MAX_ATTEMPTS} · checking every 5s
//                   </p>
//                 </div>
//               )}

//               {stage === "done" && (
//                 <div className="space-y-2">
//                   <div className="space-y-1.5">
//                     <div className="flex items-center justify-between">
//                       <span className="text-[11px] font-medium text-emerald-600">Complete</span>
//                       <span className="text-[11px] text-emerald-600">100%</span>
//                     </div>
//                     <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
//                       <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
//                     </div>
//                   </div>
//                   <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
//                     <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
//                       <path d="M3 7.5l3 3 6-6" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//                     </svg>
//                     <span className="text-xs font-semibold text-emerald-700">Processing complete</span>
//                   </div>
//                   {processedUrl && (
//                     <a
//                       href={processedUrl}
//                       download
//                       target="_blank"
//                       rel="noreferrer"
//                       className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-2"
//                     >
//                       <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
//                         <path d="M6.5 2v7M6.5 9l-3-3M6.5 9l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
//                         <path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
//                       </svg>
//                       Download processed image
//                     </a>
//                   )}
//                 </div>
//               )}

//               {stage === "error" && (
//                 <div className="space-y-2">
//                   <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-red-50 border border-red-200">
//                     <svg width="14" height="14" viewBox="0 0 15 15" fill="none" className="shrink-0">
//                       <path d="M7.5 5v4M7.5 11h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
//                       <circle cx="7.5" cy="7.5" r="6" stroke="#dc2626" strokeWidth="1.2" />
//                     </svg>
//                     <span className="text-xs text-red-600 font-medium">{message}</span>
//                   </div>
//                   <button onClick={handleSubmit} className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs text-slate-500 font-medium">
//                     Retry upload
//                   </button>
//                 </div>
//               )}
//             </div>

//             {/* Spacer */}
//             <div className="flex-1" />

//             {/* Pipeline steps */}
//             <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
//               {[
//                 { color: "text-indigo-500 bg-indigo-50", label: "Upload", desc: "Azure Blob" },
//                 { color: "text-amber-600 bg-amber-50", label: "Process", desc: "Azure Fn" },
//                 { color: "text-emerald-600 bg-emerald-50", label: "Retrieve", desc: "Processed" },
//               ].map((s, i) => (
//                 <div key={i} className={`${s.color} rounded-xl p-2.5 text-center`}>
//                   <p className="text-[11px] font-bold">{s.label}</p>
//                   <p className="text-[10px] opacity-60 mt-0.5">{s.desc}</p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* ── RIGHT PANEL: Image Preview ── */}
//         <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f5f7]">

//           {stage === "idle" && (
//             <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
//               <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
//                 <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-slate-300">
//                   <rect x="3" y="3" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" />
//                   <circle cx="10" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.4" />
//                   <path d="M4 20l5.5-5.5 4 4 3.5-4 5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
//                 </svg>
//               </div>
//               <div>
//                 <p className="text-sm font-semibold text-slate-400">No image selected</p>
//                 <p className="text-xs text-slate-300 mt-1">Upload an image on the left to get started</p>
//               </div>
//             </div>
//           )}

//           {isActive && (
//             <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">

//               {/* Original */}
//               <div className="flex flex-col border-r border-slate-200 overflow-hidden">
//                 <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
//                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
//                   <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Original</span>
//                 </div>
//                 <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7]">
//                   {image && (
//                     <img
//                       src={image}
//                       alt="Original"
//                       className="max-w-full max-h-full object-contain rounded-xl shadow-md"
//                     />
//                   )}
//                 </div>
//               </div>

//               {/* Processed */}
//               <div className="flex flex-col overflow-hidden">
//                 <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2 shrink-0">
//                   <div className={`w-1.5 h-1.5 rounded-full ${stage === "done" ? "bg-emerald-400"
//                       : stage === "processing" ? "bg-amber-400 animate-pulse"
//                         : "bg-slate-200"
//                     }`} />
//                   <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Processed</span>
//                 </div>
//                 <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f5f7]">
//                   {processedUrl ? (
//                     <img
//                       src={processedUrl}
//                       alt="Processed"
//                       className="max-w-full max-h-full object-contain rounded-xl shadow-md"
//                     />
//                   ) : stage === "processing" || stage === "uploading" ? (
//                     <div className="flex flex-col items-center gap-4 text-center">
//                       <div className="w-12 h-12 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
//                       <div>
//                         <p className="text-sm font-medium text-slate-500 transition-all duration-500">{loadingMsg}</p>
//                         {stage === "processing" && (
//                           <p className="text-xs text-slate-400 mt-1">
//                             ~{Math.max(0, (MAX_ATTEMPTS - attempts) * 5)}s remaining estimate
//                           </p>
//                         )}
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="flex flex-col items-center gap-2 text-center">
//                       <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
//                         <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-slate-300">
//                           <rect x="2" y="2" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.4" />
//                           <path d="M7 14l3-3 2.5 2.5 2-2.5 2.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
//                         </svg>
//                       </div>
//                       <p className="text-xs text-slate-400">Awaiting processing</p>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useState, useRef, useCallback } from "react";

// type Stage = "idle" | "preview" | "uploading" | "processing" | "done" | "error";

// export default function Home() {
//   const [image, setImage] = useState<string | null>(null);
//   const [file, setFile] = useState<File | null>(null);
//   const [stage, setStage] = useState<Stage>("idle");
//   const [message, setMessage] = useState("");
//   const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
//   const [processedUrl, setProcessedUrl] = useState<string | null>(null);
//   const [isDragging, setIsDragging] = useState(false);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   const handleFile = (selectedFile: File) => {
//     if (!selectedFile.type.startsWith("image/")) return;
//     setFile(selectedFile);
//     setImage(URL.createObjectURL(selectedFile));
//     setProcessedUrl(null);
//     setUploadedUrl(null);
//     setMessage("");
//     setStage("preview");
//   };

//   const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = e.target.files?.[0];
//     if (selectedFile) handleFile(selectedFile);
//   };

//   const handleDrop = useCallback((e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(false);
//     const droppedFile = e.dataTransfer.files?.[0];
//     if (droppedFile) handleFile(droppedFile);
//   }, []);

//   const handleDragOver = (e: React.DragEvent) => {
//     e.preventDefault();
//     setIsDragging(true);
//   };

//   const handleDragLeave = () => setIsDragging(false);

//   const checkProcessedImage = (url: string) => {
//     let attempts = 0;
//     setStage("processing");

//     const interval = setInterval(async () => {
//       try {
//         const res = await fetch(url, { method: "HEAD" });
//         if (res.ok) {
//           setProcessedUrl(url);
//           setStage("done");
//           clearInterval(interval);
//         }
//       } catch {
//         // continue polling
//       }
//       attempts++;
//       if (attempts > 30) {
//         setStage("error");
//         setMessage("Processing timed out. Please try again.");
//         clearInterval(interval);
//       }
//     }, 5000);
//   };

//   const handleSubmit = async () => {
//     if (!file) return;
//     setStage("uploading");
//     setMessage("");
//     setProcessedUrl(null);

//     try {
//       const fileName = `${Date.now()}-${file.name}`;
//       const sasBase = "https://imageprop.blob.core.windows.net/uploads";
//       const sasToken =
//         "?sp=rcw&st=2026-05-05T08:17:40Z&se=2026-05-10T16:32:40Z&spr=https&sv=2025-11-05&sr=c&sig=RErcCtQyHFEBzzbwN%2BOQ2VpIntfH4yj6t1OBIW4fN4o%3D";
//       const uploadUrl = `${sasBase}/${fileName}${sasToken}`;

//       const res = await fetch(uploadUrl, {
//         method: "PUT",
//         headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": file.type },
//         body: file,
//       });

//       if (!res.ok) throw new Error("Upload failed");

//       const fileUrl = `${sasBase}/${fileName}`;
//       setUploadedUrl(fileUrl);
//       const processed = fileUrl.replace("/uploads/", "/processed/");
//       checkProcessedImage(processed);
//     } catch (err) {
//       console.error(err);
//       setStage("error");
//       setMessage("Upload failed. Please check your connection and try again.");
//     }
//   };

//   const handleReset = () => {
//     setImage(null);
//     setFile(null);
//     setStage("idle");
//     setMessage("");
//     setUploadedUrl(null);
//     setProcessedUrl(null);
//     if (fileInputRef.current) fileInputRef.current.value = "";
//   };

//   const fileSizeLabel = file
//     ? file.size > 1024 * 1024
//       ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
//       : `${(file.size / 1024).toFixed(0)} KB`
//     : null;

//   return (
//     <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">

//       {/* Nav */}
//       <nav className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
//         <div className="flex items-center gap-2.5">
//           <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
//             <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//               <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
//               <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
//               <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.5" />
//               <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.95" />
//             </svg>
//           </div>
//           <span className="text-sm font-bold tracking-tight text-slate-800">ImageProp</span>
//         </div>
//         <span className="text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
//           Azure Pipeline
//         </span>
//       </nav>

//       {/* Body */}
//       <div className="max-w-2xl mx-auto px-6 pt-7 pb-16">

//         {/* Header */}
//         <div className="mb-10">
//           <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
//             <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
//             Image Processing System
//           </div>
//           <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
//             Upload &amp; Process
//           </h1>
//           <p className="text-slate-500 text-sm leading-relaxed">
//             Upload an image — it&apos;s sent to Azure Blob Storage, processed by an Azure Function, and returned automatically.
//           </p>
//         </div>

//         {/* Upload Zone */}
//         {stage === "idle" && (
//           <div
//             onDrop={handleDrop}
//             onDragOver={handleDragOver}
//             onDragLeave={handleDragLeave}
//             onClick={() => fileInputRef.current?.click()}
//             className={`
//               relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200
//               flex flex-col items-center justify-center gap-4 py-16 px-8
//               ${isDragging
//                 ? "border-indigo-400 bg-indigo-50"
//                 : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
//               }
//             `}
//           >
//             <div className={`
//               w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm
//               ${isDragging ? "bg-indigo-100" : "bg-slate-100 group-hover:bg-indigo-100"}
//             `}>
//               <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
//                 className={`transition-colors ${isDragging ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500"}`}>
//                 <path d="M11 3v12M11 3l-4 4M11 3l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//                 <path d="M3 15v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
//               </svg>
//             </div>
//             <div className="text-center">
//               <p className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors">
//                 {isDragging ? "Drop to upload" : "Drop image here or click to browse"}
//               </p>
//               <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP · Up to 20 MB</p>
//             </div>
//             <input
//               ref={fileInputRef}
//               type="file"
//               accept="image/*"
//               onChange={handleUpload}
//               className="hidden"
//             />
//           </div>
//         )}

//         {/* Preview + Controls */}
//         {stage !== "idle" && image && (
//           <div className="space-y-4">

//             {/* File info bar */}
//             <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
//               <div className="flex items-center gap-3">
//                 <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
//                   <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
//                     <rect x="1" y="1" width="12" height="12" rx="2" stroke="#6366f1" strokeWidth="1.2" />
//                     <path d="M3 9l2.5-2.5L7.5 8l2-2.5 1.5 2" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
//                   </svg>
//                 </div>
//                 <div>
//                   <p className="text-xs font-semibold text-slate-700 leading-none mb-0.5">{file?.name}</p>
//                   <p className="text-[11px] text-slate-400">{fileSizeLabel}</p>
//                 </div>
//               </div>
//               {(stage === "preview" || stage === "error") && (
//                 <button
//                   onClick={handleReset}
//                   className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
//                 >
//                   Remove
//                 </button>
//               )}
//               {stage === "done" && (
//                 <button
//                   onClick={handleReset}
//                   className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
//                 >
//                   Upload new
//                 </button>
//               )}
//             </div>

//             {/* Image panels */}
//             <div className={`grid gap-3 ${processedUrl ? "grid-cols-2" : "grid-cols-1"}`}>
//               <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
//                 <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
//                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
//                   <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Original</span>
//                 </div>
//                 <img src={image} alt="Original" className="w-full h-56 object-contain p-3 bg-[#f8f9fb]" />
//               </div>

//               {(stage === "processing" || stage === "done") && (
//                 <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
//                   <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
//                     <div className={`w-1.5 h-1.5 rounded-full ${stage === "done" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
//                     <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Processed</span>
//                   </div>
//                   {processedUrl ? (
//                     <img src={processedUrl} alt="Processed" className="w-full h-56 object-contain p-3 bg-[#f8f9fb]" />
//                   ) : (
//                     <div className="h-56 bg-[#f8f9fb] flex flex-col items-center justify-center gap-3">
//                       <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
//                       <p className="text-xs text-slate-400">Running Azure Function…</p>
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>

//             {/* Action */}
//             <div className="mt-1">
//               {stage === "preview" && (
//                 <button
//                   onClick={handleSubmit}
//                   className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] transition-all text-sm font-semibold text-white shadow-sm shadow-indigo-200"
//                 >
//                   Upload &amp; Process
//                 </button>
//               )}

//               {stage === "uploading" && (
//                 <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-white border border-slate-200">
//                   <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
//                   <span className="text-sm text-slate-500">Uploading to Azure…</span>
//                 </div>
//               )}

//               {stage === "processing" && (
//                 <div className="flex items-center justify-center gap-3 py-3 rounded-xl bg-amber-50 border border-amber-200">
//                   <div className="w-4 h-4 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
//                   <span className="text-sm text-amber-700 font-medium">Processing image…</span>
//                 </div>
//               )}

//               {stage === "done" && (
//                 <div className="space-y-2.5">
//                   <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
//                     <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
//                       <path d="M3 7.5l3 3 6-6" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
//                     </svg>
//                     <span className="text-sm font-semibold text-emerald-700">Processing complete</span>
//                   </div>
//                   {processedUrl && (
//                     <a
//                       href={processedUrl}
//                       download
//                       target="_blank"
//                       rel="noreferrer"
//                       className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-2 shadow-sm"
//                     >
//                       <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
//                         <path d="M6.5 2v7M6.5 9l-3-3M6.5 9l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
//                         <path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
//                       </svg>
//                       Download processed image
//                     </a>
//                   )}
//                 </div>
//               )}

//               {stage === "error" && (
//                 <div className="space-y-2.5">
//                   <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 border border-red-200">
//                     <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
//                       <path d="M7.5 5v4M7.5 11h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
//                       <circle cx="7.5" cy="7.5" r="6" stroke="#dc2626" strokeWidth="1.2" />
//                     </svg>
//                     <span className="text-sm text-red-600 font-medium">{message}</span>
//                   </div>
//                   <button
//                     onClick={handleSubmit}
//                     className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm text-slate-500 hover:text-slate-700 font-medium shadow-sm"
//                   >
//                     Retry upload
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Pipeline steps */}
//         <div className="mt-10 grid grid-cols-3 gap-3">
//           {[
//             {
//               icon: (
//                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                   <path d="M8 2v9M8 2L5 5M8 2l3 3" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
//                   <path d="M2 11v1.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V11" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round" />
//                 </svg>
//               ),
//               label: "Upload",
//               desc: "Sent to Azure Blob Storage via SAS token",
//               card: "bg-indigo-50 border-indigo-100",
//             },
//             {
//               icon: (
//                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                   <circle cx="8" cy="8" r="3" stroke="#d97706" strokeWidth="1.4" />
//                   <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round" />
//                 </svg>
//               ),
//               label: "Process",
//               desc: "Azure Function triggered on new blob",
//               card: "bg-amber-50 border-amber-100",
//             },
//             {
//               icon: (
//                 <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//                   <path d="M8 2v9M8 11l-3-3M8 11l3-3" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
//                   <path d="M2 11v1.5A1.5 1.5 0 003.5 14h9a1.5 1.5 0 001.5-1.5V11" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" />
//                 </svg>
//               ),
//               label: "Retrieve",
//               desc: "Polled from processed container",
//               card: "bg-emerald-50 border-emerald-100",
//             },
//           ].map((step, i) => (
//             <div key={i} className={`${step.card} border rounded-2xl p-4`}>
//               <div className="mb-2.5">{step.icon}</div>
//               <p className="text-xs font-bold text-slate-700 mb-1">{step.label}</p>
//               <p className="text-[11px] text-slate-400 leading-relaxed">{step.desc}</p>
//             </div>
//           ))}
//         </div>

//         <p className="text-center text-xs text-slate-300 mt-10">
//           Powered by Azure Blob Storage &amp; Azure Functions
//         </p>
//       </div>
//     </main>
//   );
// }