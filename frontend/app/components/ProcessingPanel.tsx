"use client";

interface Props {
  progress: number;
  currentLabel?: string;
  completed: number;
  total: number;
  jobId?: string;
  onCancel?: () => void;
}

const STEPS = [
  "Fetching PDFs from NSE/BSE archives",
  "Extracting text via pdfplumber",
  "Running AI extraction + scoring",
  "Computing 5-dimension impact scores",
  "Ranking & finalising analyst notes",
];

export default function ProcessingPanel({ progress, currentLabel, completed, total, onCancel }: Props) {
  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Terminal window */}
      <div className="card scan-wrap overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-raised)" }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="ml-2 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            impact-scorer · analysis running
          </span>
          <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--positive)" }}>
            {completed}/{total} done
          </span>
        </div>

        {/* Terminal body */}
        <div className="p-5 space-y-2 font-mono text-[11px]">
          <div style={{ color: "var(--accent)" }}>$ python analyze.py --pdfs {total} --model gemma-4-31b</div>
          <div style={{ color: "var(--text-muted)" }}>Initialising pipeline...</div>

          {currentLabel && (
            <div className="mt-1 blink-cursor" style={{ color: "var(--amber)" }}>
              ⟳ {currentLabel}
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            {STEPS.map((step, i) => {
              const threshold = (i / STEPS.length) * 100;
              const isDone = progress > threshold + 18;
              const isActive = !isDone && progress > threshold;
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-3 text-center" style={{
                    color: isDone ? "var(--positive)" : isActive ? "var(--amber)" : "var(--text-muted)"
                  }}>
                    {isDone ? "✓" : isActive ? "·" : "○"}
                  </span>
                  <span style={{
                    color: isDone ? "var(--text-muted)" : isActive ? "var(--text-primary)" : "var(--text-muted)",
                    opacity: isDone ? 0.6 : 1
                  }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono mb-1.5" style={{ color: "var(--text-muted)" }}>
          <span>OVERALL PROGRESS</span>
          <span style={{ color: "var(--accent)" }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
          <div
            className="h-full rounded-full bar-fill"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #38BDF8, #10B981)",
              boxShadow: "0 0 8px rgba(56,189,248,0.4)",
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
          ~30–90s per document · AI processing + PDF fetch
        </p>
        {onCancel && (
          <button onClick={onCancel} className="btn-ghost text-[10px]" style={{ color: "var(--red)", borderColor: "rgba(239,68,68,0.2)" }}>
            ✕ Cancel
          </button>
        )}
      </div>
    </div>
  );
}