"use client";
import { useState, useEffect, useRef } from "react";
import {
  startAnalysis, pollJob, cancelJob, getDefaultPDFs, uploadPDF,
  type AnalysisResult, type PDFMeta
} from "./lib/api";
import ScoreCard from "./components/ScoreCard";
import ProcessingPanel from "./components/ProcessingPanel";
import RankingLeaderboard from "./components/RankingLeaderboard";

type AppState = "idle" | "processing" | "completed" | "error";
type Mode = "default" | "upload";
type View = "cards" | "ranking";

const DEFAULT_DOCS = [
  { id: "pdf1", label: "BHELCC — Info to SE", sub: "NSE · Jun 2026", url: "https://nsearchives.nseindia.com/corporate/BHELCC_05062026113257_Info_to_SE_05_06_2026.pdf" },
  { id: "pdf2", label: "BLUSPRING — Reg 30 BALCO", sub: "NSE · Jun 2026", url: "https://nsearchives.nseindia.com/corporate/BLUSPRING_05062026130923_Reg_30_-_SESI-BALCO.pdf" },
  { id: "pdf3", label: "ETHOS — GST Order Disclosure", sub: "NSE · Jun 2026", url: "https://nsearchives.nseindia.com/corporate/ETHOS_05062026160606_Disclosure_GST_Order.pdf" },
  { id: "pdf4", label: "EDUTECH — Reg 30 Disclosure", sub: "NSE · Jun 2026", url: "https://nsearchives.nseindia.com/corporate/EDUTECH_05062026174716_Disclosure_Reg_30_EDUTECH_05062026.pdf" },
  { id: "pdf5", label: "BSE Filing — Corporate Action", sub: "BSE · Jun 2026", url: "https://www.bseindia.com/xml-data/corpfiling/AttachLive/cc79e53e-be66-400d-82db-6e88c3a42188.pdf" },
];

const DIMS = [
  { icon: "₹", label: "Financial Magnitude", desc: "Order / contract value" },
  { icon: "⚡", label: "Sector Sensitivity", desc: "Market-moving potential" },
  { icon: "↗", label: "Revenue Contribution", desc: "% impact on revenues" },
  { icon: "◈", label: "Credibility", desc: "Counterparty quality" },
  { icon: "◎", label: "Market Impact", desc: "Price movement catalyst" },
];

export default function Home() {
  const [mode, setMode]           = useState<Mode>("default");
  const [appState, setAppState]   = useState<AppState>("idle");
  const [progress, setProgress]   = useState(0);
  const [results, setResults]     = useState<AnalysisResult[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [defaultPDFs, setDefaultPDFs] = useState<PDFMeta[]>([]);
  const [apiKey, setApiKey]       = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiModal, setShowApiModal] = useState(false);
  const [view, setView]           = useState<View>("cards");
  const [jobId, setJobId]         = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Upload state
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploadState, setUploadState]   = useState<"idle"|"uploading"|"done"|"error">("idle");
  const [uploadResult, setUploadResult] = useState<AnalysisResult | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDefaultPDFs().then(setDefaultPDFs).catch(() => {});
    const saved = localStorage.getItem("openrouter_api_key");
    if (saved) setApiKey(saved);
  }, []);

  const stopPolling = () => { if (pollRef.current) clearInterval(pollRef.current); };

  const startPolling = (jid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(jid);
        setProgress(job.progress);
        if (job.results?.length) setResults(job.results);
        if (job.status === "completed") { stopPolling(); setAppState("completed"); }
        else if (job.status === "cancelled") { stopPolling(); setAppState("idle"); setResults([]); }
        else if (job.status === "failed") { stopPolling(); setError(job.error || "Analysis failed"); setAppState("error"); }
      } catch (e) { console.error(e); }
    }, 2000);
  };

  const handleStart = async () => {
    if (!apiKey) { setShowApiModal(true); return; }
    setAppState("processing"); setProgress(0); setResults([]); setError(null);
    try {
      const { job_id } = await startAnalysis();
      setJobId(job_id);
      startPolling(job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setAppState("error");
    }
  };

  const handleCancel = async () => {
    if (jobId) { try { await cancelJob(jobId); } catch {} }
    stopPolling(); setAppState("idle"); setResults([]); setProgress(0); setJobId(null);
  };

  const handleReset = () => { stopPolling(); setAppState("idle"); setResults([]); setProgress(0); setError(null); setJobId(null); };
  const handleSaveKey = () => { localStorage.setItem("openrouter_api_key", apiKeyInput); setApiKey(apiKeyInput); setShowApiModal(false); };
  const handleModeSwitch = (m: Mode) => { setMode(m); handleReset(); setUploadFile(null); setUploadState("idle"); setUploadResult(null); setUploadError(null); };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setUploadFile(f);
  };

  const handleUploadAnalyze = async () => {
    if (!uploadFile) return;
    if (!apiKey) { setShowApiModal(true); return; }
    setUploadState("uploading"); setUploadError(null); setUploadResult(null);
    try { setUploadResult(await uploadPDF(uploadFile)); setUploadState("done"); }
    catch (e: unknown) { setUploadError(e instanceof Error ? e.message : "Failed"); setUploadState("error"); }
  };

  const completedCount = results.filter(r => r.status === "completed").length;
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + (r.scores?.total_score ?? 0), 0) / results.length) : 0;
  const topResult = [...results].sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0))[0];
  const docs = defaultPDFs.length > 0 ? defaultPDFs : DEFAULT_DOCS;

  return (
    <div className="app-bg min-h-screen">
      {/* ── Ticker tape bar ────────────────────────────
      <div style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="ticker-wrap py-1.5">
          <div className="ticker-track">
            {[...docs, ...docs].map((d, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-8 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--accent)" }} />
                {d.label}
              </span>
            ))}
          </div>
        </div> */}
      {/* </div> */}

      <div className="max-w-7xl mx-auto px-5 py-8">
        {/* ── Header ───────────────────────────────── */}
        <div className="mb-10">
          <p className="text-[10px] font-mono tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
            SEBI REGULATORY INTELLIGENCE · NSE/BSE ANALYSIS SYSTEM
          </p>
          <h1 className="text-4xl font-bold tracking-tight leading-none mb-3" style={{ color: "var(--text-primary)" }}>
            Corporate Filing<br />
            <span style={{ color: "var(--accent)" }}>Impact Scorer</span>
          </h1>
          <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
            Ingests NSE/BSE filings, extracts key data, and ranks announcements by market impact across five analytical dimensions.
          </p>

          {/* API key status — subtle, not a badge parade */}
          <div className="flex items-center gap-3 mt-4">
            {apiKey ? (
              <button onClick={() => setShowApiModal(true)} className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "var(--positive)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)", display: "inline-block" }} />
                API key active
                <span style={{ color: "var(--text-muted)" }}>(change)</span>
              </button>
            ) : (
              <button onClick={() => setShowApiModal(true)} className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: "var(--amber)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)", display: "inline-block" }} />
                Set OpenRouter API key
              </button>
            )}
          </div>
        </div>

        {/* ── Mode tabs ────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-lg w-fit mb-8" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <button className={`tab ${mode === "default" ? "active" : ""}`} onClick={() => handleModeSwitch("default")}>
            NSE/BSE Filings
          </button>
          <button className={`tab ${mode === "upload" ? "active" : ""}`} onClick={() => handleModeSwitch("upload")}>
            Upload PDF
          </button>
        </div>

        {/* ── API key modal ─────────────────────────── */}
        {showApiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
            <div className="card w-full max-w-sm p-6">
              <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>OpenRouter API Key</h3>
              <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
                Free at <a href="https://openrouter.ai" target="_blank" className="underline" style={{ color: "var(--accent)" }}>openrouter.ai</a> · Stored in your browser only
              </p>
              <input
                className="input-field mb-3"
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveKey()}
                placeholder="sk-or-v1-..."
              />
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={handleSaveKey}>Save & Continue</button>
                <button className="btn-ghost" onClick={() => setShowApiModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/*  UPLOAD MODE                               */}
        {/* ══════════════════════════════════════════ */}
        {mode === "upload" && (
          <div className="max-w-lg space-y-5">
            {uploadState === "idle" && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Analyse Any Corporate Filing</h2>
                <p className="text-[11px] mb-5" style={{ color: "var(--text-muted)" }}>Upload any NSE/BSE PDF and get an instant AI impact score.</p>

                <div
                  className={`drop-zone p-10 text-center ${dragOver ? "drag-over" : ""} ${uploadFile ? "has-file" : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }} className="hidden" />
                  {uploadFile ? (
                    <>
                      <div className="text-2xl mb-2">📄</div>
                      <p className="text-sm font-medium" style={{ color: "var(--positive)" }}>{uploadFile.name}</p>
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{(uploadFile.size / 1024).toFixed(1)} KB · click to change</p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl mb-3">↑</div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Drop PDF here or <span style={{ color: "var(--accent)" }}>browse</span></p>
                      <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>PDF files only</p>
                    </>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button className="btn-primary" onClick={handleUploadAnalyze} disabled={!uploadFile}>
                    ▶ Analyse
                  </button>
                </div>
              </div>
            )}

            {uploadState === "uploading" && (
              <div className="card p-8 text-center scan-wrap">
                <div className="text-2xl mb-3" style={{ color: "var(--accent)" }}>⟳</div>
                <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>Analysing {uploadFile?.name}</p>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Extracting text · running AI scoring…</p>
                <div className="mt-5 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                  <div className="h-full w-3/5 rounded-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--positive))", animation: "none" }} />
                </div>
              </div>
            )}

            {uploadState === "error" && (
              <div className="card p-5" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                <p className="text-sm font-mono mb-1" style={{ color: "var(--red)" }}>⚠ Upload Failed</p>
                <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>{uploadError}</p>
                <button className="btn-ghost" onClick={() => { setUploadState("idle"); setUploadError(null); }}>Try Again</button>
              </div>
            )}

            {uploadState === "done" && uploadResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono tracking-wider" style={{ color: "var(--text-muted)" }}>ANALYSIS RESULT</p>
                  <button className="btn-ghost" onClick={() => { setUploadState("idle"); setUploadResult(null); setUploadFile(null); }}>↺ Upload Another</button>
                </div>
                <ScoreCard result={uploadResult} />
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/*  DEFAULT MODE                              */}
        {/* ══════════════════════════════════════════ */}
        {mode === "default" && (
          <>
            {/* ── IDLE ─────────────────────────────── */}
            {appState === "idle" && (
              <div className="space-y-5">
                {/* Document queue + scoring framework side by side on wide screens */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  {/* Queue */}
                  <div className="card overflow-hidden lg:col-span-3">
                    <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                      <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Documents Queued</h2>
                      <p className="text-[13px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>NSE & BSE corporate filings · June 2026</p>
                    </div>
                    <div>
                      {docs.map((doc, i) => (
                        <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors" style={{ borderBottom: i < docs.length - 1 ? "1px solid var(--border)" : "none" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span className="text-[13px] font-mono w-5 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)", opacity: 0.5 }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{doc.label}</p>
                            {"sub" in doc && <p className="text-[9px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{(doc as typeof DEFAULT_DOCS[0]).sub}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scoring framework */}
                  <div className="card p-5 lg:col-span-2">
                    <p className="text-[12px] font-mono tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>SCORING FRAMEWORK</p>
                    <div className="space-y-3">
                      {DIMS.map((d, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                            {d.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{d.label}</p>
                            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{d.desc}</p>
                          </div>
                          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "var(--accent)" }}>0–20</span>
                        </div>
                      ))}
                    </div>
                    <div className="divider my-4" />
                    <p className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
                      Total: <span style={{ color: "var(--text-primary)" }}>5 dimensions × 20 pts = <strong style={{ color: "var(--accent)" }}>100 max</strong></span>
                    </p>
                  </div>
                </div>

                <button className="btn-primary" onClick={handleStart}>
                  ▶ Run Full Analysis
                </button>
              </div>
            )}

            {/* ── PROCESSING ───────────────────────── */}
            {appState === "processing" && (
              <div className="space-y-8">
                <ProcessingPanel
                  progress={progress}
                  currentLabel={results.length < 5 ? docs[results.length]?.label : undefined}
                  completed={completedCount}
                  total={5}
                  jobId={jobId ?? undefined}
                  onCancel={handleCancel}
                />
                {results.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>PARTIAL RESULTS · LIVE</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {results.map((r, i) => <ScoreCard key={r.id} result={r} animationDelay={i * 80} />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ERROR ────────────────────────────── */}
            {appState === "error" && (
              <div className="max-w-md">
                <div className="card p-8 text-center" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                  <p className="text-3xl mb-4">⚠</p>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--red)" }}>Analysis Failed</h3>
                  <p className="text-[11px] font-mono mb-5" style={{ color: "var(--text-muted)" }}>{error}</p>
                  <button className="btn-ghost" onClick={handleReset}>↺ Try Again</button>
                </div>
              </div>
            )}

            {/* ── COMPLETED ────────────────────────── */}
            {appState === "completed" && results.length > 0 && (
              <div className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "DOCUMENTS", value: String(results.length), sub: "filings analysed", color: "var(--accent)" },
                    { label: "SUCCESSFUL", value: `${completedCount}/${results.length}`, sub: "fetched & scored", color: "var(--positive)" },
                    { label: "AVG SCORE", value: String(avgScore), sub: "out of 100", color: "var(--amber)" },
                    { label: "TOP RATING", value: topResult?.scores?.rating || "—", sub: topResult?.extracted?.company_name?.split(" ")[0] || "", color: topResult?.scores?.rating_color || "var(--text-muted)" },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <p className="text-[13px] font-mono tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                      <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                    <button className={`tab ${view === "cards" ? "active" : ""}`} onClick={() => setView("cards")}>Score Cards</button>
                    <button className={`tab ${view === "ranking" ? "active" : ""}`} onClick={() => setView("ranking")}>Rankings</button>
                  </div>
                  <button className="btn-ghost" onClick={handleReset}>↺ New Analysis</button>
                </div>

                {view === "ranking" && <RankingLeaderboard results={results} />}
                {view === "cards" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...results].sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0))
                      .map((r, i) => <ScoreCard key={r.id} result={r} animationDelay={i * 80} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Footer ───────────────────────────────── */}
        <div className="divider mt-14 mb-4" />
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Corporate Impact Scorer · {new Date().getFullYear()}</p>
          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>FastAPI · Next.js 14 · OpenRouter</p>
        </div>
      </div>
    </div>
  );
}