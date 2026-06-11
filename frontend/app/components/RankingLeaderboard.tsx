"use client";
import { AnalysisResult } from "../lib/api";

interface Props {
  results: AnalysisResult[];
}

export default function RankingLeaderboard({ results }: Props) {
  const sorted = [...results]
    .filter(r => r.scores && r.scores.total_score !== undefined)
    .sort((a, b) => (b.scores?.total_score ?? 0) - (a.scores?.total_score ?? 0));

  const maxScore = sorted[0]?.scores?.total_score ?? 100;

  return (
    <div className="bg-[#0F1623] border border-[#1A2332] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A2332] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#C8D8E8]">Impact Ranking</h2>
          <p className="text-[10px] text-[#5A7A9A] font-mono mt-0.5">Sorted by total impact score</p>
        </div>
        <span className="text-[10px] font-mono text-[#5A7A9A] bg-[#1A2332] px-2 py-1 rounded">
          {sorted.length} filings
        </span>
      </div>

      <div className="p-4 space-y-2">
        {sorted.map((result, idx) => {
          const score = result.scores?.total_score ?? 0;
          const rating = result.scores?.rating ?? "UNKNOWN";
          const ringColor = result.scores?.rating_color ?? "#555";
          const barWidth = maxScore > 0 ? (score / 100) * 100 : 0;

          const rankLabel = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

          return (
            <div key={result.id} className="bg-[#0A0E17] rounded-lg p-3 border border-[#1A2332] hover:border-[#2A3F55] transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm w-7 text-center flex-shrink-0">{rankLabel}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-[#C8D8E8] truncate">
                      {result.extracted?.company_name || result.label.split("—")[0].trim()}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded rating-${rating}`}>
                        {rating}
                      </span>
                      <span className="text-sm font-mono font-bold" style={{ color: ringColor }}>
                        {score}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#1A2332] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full score-bar"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${ringColor}66, ${ringColor})`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-[#5A7A9A]">
                      {result.extracted?.announcement_type || "—"}
                    </span>
                    {result.extracted?.financial_value && (
                      <span className="text-[9px] font-mono text-[#00FF88]">
                        {result.extracted.financial_value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}