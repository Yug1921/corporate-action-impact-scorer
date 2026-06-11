"use client";
import { useState, useEffect, useRef } from "react";
import {
  startAnalysis, pollJob, getDefaultPDFs,
  type AnalysisResult, type PDFMeta
} from "./lib/api";
import ScoreCard from "./components/ScoreCard";
import ProcessingPanel from "./components/ProcessingPanel";
import RankingLeaderboard from "./components/RankingLeaderboard";

type AppState = "idle" | "processing" | "completed" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [defaultPDFs, setDefaultPDFs] = useState<PDFMeta[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiInput, setShowApiInput] = useState(false);
  const [view, setView] = useState<"cards" | "ranking">("cards");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getDefaultPDFs().then(setDefaultPDFs).catch(() => {});
    const saved = localStorage.getItem("openrouter_api_key");
    if (saved) setApiKey(saved);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const startPolling = (jid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollJob(jid);
        setProgress(job.progress);
        if (job.results && job.results.length > 0) setResults(job.results);
        if (job.status === "completed") { stopPolling(); setAppState("completed"); }
        else if (job.status === "failed") { stopPolling(); setError(job.error || "Analysis failed"); setAppState("error"); }
      } catch (e) { console.error("Poll error:", e); }
    }, 2000);
  };

  const handleStart = async () => {
    if (!apiKey) { setShowApiInput(true); return; }
    setAppState("processing"); setProgress(0); setResults([]); setError(null);
    try {
      const { job_id } = await startAnalysis();
      startPolling(job_id);
    } catch (e: any) { setError(e.message || "Failed to start"); setAppState("error"); }
  };

  const handleSaveKey = () => {
    localStorage.setItem("openrouter_api_key", apiKeyInput);
    setApiKey(apiKeyInput); setShowApiInput(false);
  };

  const handleReset = () => { stopPolling(); setAppState("idle"); setResults([]); setProgress(0); setError(null); };

  const completedCount = results.filter(r => r.status === "completed").length;
  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.scores?.total_score ?? 0), 0) / results.length) : 0;
  const topResult = [...results].sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0))[0];

  return (
    <main className="min-h-screen grid-bg">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-[#00D4FF] opacity-[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-[#00FF88] opacity-[0.03] rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" style={{ animationDelay: "0.3s" }} />
              <div className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse" style={{ animationDelay: "0.6s" }} />
            </div>
            <span className="text-[10px] font-mono text-[#3A4A5C]">SEBI REGULATORY INTELLIGENCE SYSTEM v1.0</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#C8D8E8] tracking-tight">
            Corporate Action<span className="text-[#00D4FF]"> Impact</span> Scorer
          </h1>
          <p className="text-[#5A7A9A] text-sm mt-2 max-w-xl">
            AI-powered analysis of NSE/BSE filings. Extracts key data, scores across 5 market dimensions, and ranks corporate announcements by potential stock impact.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["FastAPI", "Mistral-7B (OpenRouter)", "pdfplumber", "Next.js 14", "Recharts"].map(t => (
              <span key={t} className="text-[9px] font-mono text-[#3A4A5C] border border-[#1A2332] px-2 py-0.5 rounded">{t}</span>
            ))}
          </div>
        </div>

        {/* API Key modal */}
        {showApiInput && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0F1623] border border-[#1A2332] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-sm font-semibold text-[#C8D8E8] mb-1">OpenRouter API Key Required</h3>
              <p className="text-[11px] text-[#5A7A9A] mb-4">Get a free key at <a href="https://openrouter.ai" target="_blank" className="text-[#00D4FF]">openrouter.ai</a>. Stored in your browser only.</p>
              <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-or-v1-..."
                className="w-full bg-[#0A0E17] border border-[#1A2332] text-[#C8D8E8] text-sm font-mono rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00D4FF] mb-3" />
              <div className="flex gap-2">
                <button onClick={handleSaveKey} className="flex-1 bg-[#00D4FF] text-[#0A0E17] text-sm font-semibold py-2 rounded-lg hover:bg-[#00B8E6]">Save & Continue</button>
                <button onClick={() => setShowApiInput(false)} className="px-4 border border-[#1A2332] text-[#5A7A9A] text-sm py-2 rounded-lg">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* IDLE */}
        {appState === "idle" && (
          <div className="space-y-6">
            <div className="bg-[#0F1623] border border-[#1A2332] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1A2332]">
                <h2 className="text-sm font-semibold text-[#C8D8E8]">Documents Queued for Analysis</h2>
                <p className="text-[10px] text-[#5A7A9A] font-mono mt-0.5">NSE & BSE corporate filings · June 2026</p>
              </div>
              <div className="divide-y divide-[#1A2332]">
                {(defaultPDFs.length > 0 ? defaultPDFs : [
                  { id: "1", label: "BHELCC — Info to SE (NSE)", url: "" },
                  { id: "2", label: "BLUSPRING — Reg 30 SESI-BALCO (NSE)", url: "" },
                  { id: "3", label: "ETHOS — GST Order Disclosure (NSE)", url: "" },
                  { id: "4", label: "EDUTECH — Reg 30 Disclosure (NSE)", url: "" },
                  { id: "5", label: "BSE Filing — Corporate Action", url: "" },
                ]).map((pdf, i) => (
                  <div key={pdf.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#1A2332]/30 transition-colors">
                    <span className="text-[10px] font-mono text-[#3A4A5C] w-5">{String(i + 1).padStart(2, "0")}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] opacity-50" />
                    <span className="text-[11px] text-[#C8D8E8] flex-1">{pdf.label}</span>
                    {pdf.url && <span className="text-[9px] font-mono text-[#3A4A5C] hidden sm:block">{new URL(pdf.url).hostname}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0F1623] border border-[#1A2332] rounded-xl p-5">
              <p className="text-[10px] font-mono text-[#5A7A9A] mb-3">SCORING FRAMEWORK — 5 DIMENSIONS × 20 PTS = 100 MAX</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { icon: "₹", label: "Financial Magnitude", desc: "Order/contract value" },
                  { icon: "⚡", label: "Sector Sensitivity", desc: "Market sensitivity" },
                  { icon: "📈", label: "Revenue Contribution", desc: "% revenue impact" },
                  { icon: "🏛", label: "Credibility", desc: "Filing quality" },
                  { icon: "🎯", label: "Market Impact", desc: "Price movement potential" },
                ].map(d => (
                  <div key={d.label} className="bg-[#0A0E17] rounded-lg p-3 text-center border border-[#1A2332]">
                    <div className="text-xl mb-1">{d.icon}</div>
                    <div className="text-[10px] font-semibold text-[#C8D8E8]">{d.label}</div>
                    <div className="text-[9px] text-[#5A7A9A] mt-0.5">{d.desc}</div>
                    <div className="text-[9px] font-mono text-[#00D4FF] mt-1">0 – 20 pts</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <button onClick={handleStart}
                className="flex items-center gap-2 bg-[#00D4FF] text-[#0A0E17] font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#00B8E6] transition-all hover:scale-105 active:scale-95">
                ▶ Run Full Analysis
              </button>
              {!apiKey ? (
                <button onClick={() => setShowApiInput(true)}
                  className="text-[11px] font-mono text-[#FFB800] border border-[#FFB80030] px-4 py-3 rounded-xl hover:border-[#FFB800] transition-colors">
                  ⚠ Set OpenRouter API Key first
                </button>
              ) : (
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#00FF88] border border-[#00FF8820] px-4 py-3 rounded-xl">
                  ✓ API key configured
                  <button onClick={() => setShowApiInput(true)} className="text-[#5A7A9A] hover:text-[#C8D8E8] ml-1">(change)</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {appState === "processing" && (
          <div>
            <ProcessingPanel progress={progress} currentLabel={results.length < 5 ? defaultPDFs[results.length]?.label : undefined} completed={completedCount} total={5} />
            {results.length > 0 && (
              <div className="mt-10 space-y-4">
                <p className="text-[10px] font-mono text-[#3A4A5C]">PARTIAL RESULTS — UPDATING LIVE ↓</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {results.map((result, i) => <ScoreCard key={result.id} result={result} animationDelay={i * 100} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ERROR */}
        {appState === "error" && (
          <div className="max-w-xl mx-auto text-center">
            <div className="bg-[#0F1623] border border-[#FF444430] rounded-xl p-8">
              <div className="text-4xl mb-4">⚠</div>
              <h3 className="text-[#FF4444] font-semibold mb-2">Analysis Failed</h3>
              <p className="text-[11px] font-mono text-[#5A7A9A] mb-4">{error}</p>
              <button onClick={handleReset} className="bg-[#1A2332] text-[#C8D8E8] text-sm px-6 py-2 rounded-lg hover:bg-[#2A3F55] transition-colors">Try Again</button>
            </div>
          </div>
        )}

        {/* COMPLETED */}
        {appState === "completed" && results.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "DOCUMENTS ANALYZED", value: String(results.length), unit: "filings", color: "#00D4FF" },
                { label: "SUCCESSFULLY FETCHED", value: String(completedCount), unit: `/ ${results.length}`, color: "#00FF88" },
                { label: "AVG IMPACT SCORE", value: String(avgScore), unit: "/ 100", color: "#FFB800" },
                { label: "HIGHEST RATING", value: topResult?.scores?.rating || "—", unit: topResult?.extracted?.company_name?.split(" ")[0] || "", color: topResult?.scores?.rating_color || "#555" },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0F1623] border border-[#1A2332] rounded-xl p-4">
                  <p className="text-[9px] font-mono text-[#3A4A5C] mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[10px] text-[#5A7A9A]">{stat.unit}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex bg-[#0F1623] border border-[#1A2332] rounded-lg p-1 gap-1">
                {(["cards", "ranking"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`text-[11px] font-mono px-4 py-1.5 rounded-md transition-all ${view === v ? "bg-[#1A2332] text-[#C8D8E8]" : "text-[#5A7A9A] hover:text-[#C8D8E8]"}`}>
                    {v === "cards" ? "📋 Score Cards" : "🏆 Rankings"}
                  </button>
                ))}
              </div>
              <button onClick={handleReset} className="text-[11px] font-mono text-[#5A7A9A] border border-[#1A2332] px-4 py-2 rounded-lg hover:border-[#2A3F55] hover:text-[#C8D8E8] transition-all">
                ↺ New Analysis
              </button>
            </div>

            {view === "ranking" && <RankingLeaderboard results={results} />}
            {view === "cards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...results].sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0))
                  .map((result, i) => <ScoreCard key={result.id} result={result} animationDelay={i * 100} />)}
              </div>
            )}
          </div>
        )}

        <footer className="mt-16 pt-6 border-t border-[#1A2332] flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] font-mono text-[#3A4A5C]">Corporate Impact Scorer · Built for Assessment · {new Date().getFullYear()}</p>
          <div className="flex gap-4">
            {["FastAPI + Next.js", "Mistral-7B via OpenRouter", "100% Free Tier"].map(t => (
              <span key={t} className="text-[10px] font-mono text-[#3A4A5C]">{t}</span>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}