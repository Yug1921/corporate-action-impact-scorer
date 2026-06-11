"use client";

interface Props {
  progress: number;
  currentLabel?: string;
  completed: number;
  total: number;
}

export default function ProcessingPanel({ progress, currentLabel, completed, total }: Props) {
  const steps = [
    { label: "Fetching PDFs from NSE/BSE archives", done: progress > 15 },
    { label: "Extracting text content via pdfplumber", done: progress > 35 },
    { label: "AI extraction via Mistral-7B on OpenRouter", done: progress > 55 },
    { label: "Running 5-dimension impact scoring", done: progress > 75 },
    { label: "Ranking & generating analyst notes", done: progress > 95 },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Terminal header */}
      <div className="bg-[#0F1623] border border-[#1A2332] rounded-xl overflow-hidden scan-container">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1A2332] bg-[#0A0E17]">
          <div className="w-3 h-3 rounded-full bg-[#FF4444]" />
          <div className="w-3 h-3 rounded-full bg-[#FFB800]" />
          <div className="w-3 h-3 rounded-full bg-[#00FF88]" />
          <span className="ml-2 text-[11px] font-mono text-[#5A7A9A]">impact-scorer — analysis in progress</span>
        </div>

        <div className="p-6 font-mono text-xs space-y-2">
          <div className="text-[#00D4FF]">$ ./analyze_documents.py --model mistral-7b --pdfs 5</div>
          <div className="text-[#5A7A9A]">Initializing corporate action analysis pipeline...</div>
          <div className="text-[#5A7A9A]">Loading PDF fetcher with session spoofing...</div>
          <div className="text-[#5A7A9A] mt-2">
            Documents processed: <span className="text-[#00FF88]">{completed}</span>
            <span className="text-[#3A4A5C]"> / </span>
            <span className="text-[#C8D8E8]">{total}</span>
          </div>

          {currentLabel && (
            <div className="text-[#FFB800] flex items-center gap-1">
              <span className="animate-pulse2">⟳</span>
              <span>Processing: {currentLabel}</span>
              <span className="cursor" />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={step.done ? "text-[#00FF88]" : progress > (i * 18) ? "text-[#FFB800]" : "text-[#3A4A5C]"}>
                  {step.done ? "✓" : progress > (i * 18) ? "◉" : "○"}
                </span>
                <span className={step.done ? "text-[#5A7A9A]" : progress > (i * 18) ? "text-[#C8D8E8]" : "text-[#3A4A5C]"}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex justify-between text-[11px] font-mono text-[#5A7A9A] mb-2">
          <span>OVERALL PROGRESS</span>
          <span className="text-[#00D4FF]">{progress}%</span>
        </div>
        <div className="h-2 bg-[#1A2332] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00D4FF, #00FF88)",
              boxShadow: "0 0 8px rgba(0, 212, 255, 0.5)",
            }}
          />
        </div>
      </div>

      {/* ETA */}
      <p className="text-center text-[11px] text-[#3A4A5C] font-mono mt-4">
        This takes 30–90s per document due to AI processing and PDF fetching
      </p>
    </div>
  );
}