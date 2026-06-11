"use client";
import { useState } from "react";
import { AnalysisResult, DIMENSION_LABELS, DIMENSION_ICONS } from "../lib/api";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip
} from "recharts";

interface Props {
  result: AnalysisResult;
  animationDelay?: number;
}

export default function ScoreCard({ result, animationDelay = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const scores = result.scores;
  const extracted = result.extracted;

  const dimensions = [
    "financial_magnitude",
    "sector_sensitivity",
    "revenue_contribution",
    "announcement_credibility",
    "market_impact_potential",
  ];

  const radarData = dimensions.map((dim) => ({
    subject: DIMENSION_LABELS[dim].split(" ")[0],
    score: (scores as any)?.[dim]?.score ?? 0,
    fullMark: 20,
  }));

  const totalScore = scores?.total_score ?? 0;
  const rating = scores?.rating ?? "UNKNOWN";
  const scorePercent = scores?.score_percentage ?? 0;

  const ringColor =
    rating === "CRITICAL" ? "#FF4444" :
    rating === "HIGH" ? "#FF8C00" :
    rating === "MODERATE" ? "#FFD700" :
    rating === "LOW" ? "#00FF88" : "#555";

  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (scorePercent / 100) * circumference;

  return (
    <div
      className="impact-card bg-[#0F1623] border border-[#1A2332] rounded-xl overflow-hidden"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header */}
      <div className="p-5 border-b border-[#1A2332]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {result.rank && (
              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mb-2 rank-${result.rank <= 3 ? result.rank : 'other'}`}
                style={result.rank > 3 ? { background: '#1A2332', color: '#5A7A9A' } : {}}>
                #{result.rank}
              </div>
            )}
            <h3 className="text-[#C8D8E8] font-semibold text-sm leading-tight truncate">
              {extracted?.company_name || result.label.split("—")[0].trim()}
            </h3>
            {extracted?.ticker && (
              <span className="text-[10px] font-mono text-[#00D4FF] bg-[#00D4FF10] border border-[#00D4FF30] px-1.5 py-0.5 rounded mt-1 inline-block">
                {extracted.ticker}
              </span>
            )}
            <p className="text-[11px] text-[#5A7A9A] mt-1 truncate">
              {extracted?.announcement_type || "Processing..."}
            </p>
          </div>

          {/* Score Ring */}
          <div className="flex flex-col items-center flex-shrink-0">
            <svg width="70" height="70" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#1A2332" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45" fill="none"
                stroke={ringColor} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
              <text x="50" y="46" textAnchor="middle" fill={ringColor} fontSize="18" fontWeight="bold" fontFamily="JetBrains Mono">
                {totalScore}
              </text>
              <text x="50" y="60" textAnchor="middle" fill="#5A7A9A" fontSize="9" fontFamily="Inter">
                / 100
              </text>
            </svg>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded rating-${rating}`}>
              {rating}
            </span>
          </div>
        </div>

        {/* Key info pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {extracted?.financial_value && (
            <span className="text-[10px] font-mono bg-[#00FF8810] text-[#00FF88] border border-[#00FF8825] px-2 py-0.5 rounded">
              {extracted.financial_value}
            </span>
          )}
          {extracted?.sector && (
            <span className="text-[10px] bg-[#1A2332] text-[#5A7A9A] px-2 py-0.5 rounded">
              {extracted.sector}
            </span>
          )}
          {extracted?.time_horizon && extracted.time_horizon !== "Unknown" && (
            <span className="text-[10px] bg-[#1A2332] text-[#5A7A9A] px-2 py-0.5 rounded">
              {extracted.time_horizon}
            </span>
          )}
        </div>

        {/* Summary */}
        {extracted?.summary && extracted.summary !== "Could not parse document" && (
          <p className="text-[11px] text-[#5A7A9A] mt-3 leading-relaxed line-clamp-2">
            {extracted.summary}
          </p>
        )}

        {result.fetch_error && (
          <p className="text-[10px] text-[#FF4444] mt-2 font-mono bg-[#FF444410] border border-[#FF444425] p-2 rounded">
            ⚠ {result.fetch_error.slice(0, 120)}
          </p>
        )}
      </div>

      {/* Score Bars */}
      <div className="p-5">
        <div className="space-y-2.5">
          {dimensions.map((dim) => {
            const dimScore = (scores as any)?.[dim]?.score ?? 0;
            const pct = (dimScore / 20) * 100;
            return (
              <div key={dim}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-[#5A7A9A] font-mono flex items-center gap-1">
                    <span>{DIMENSION_ICONS[dim]}</span>
                    {DIMENSION_LABELS[dim]}
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: ringColor }}>
                    {dimScore}/20
                  </span>
                </div>
                <div className="h-1.5 bg-[#1A2332] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full score-bar"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${ringColor}88, ${ringColor})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 w-full text-[11px] text-[#00D4FF] border border-[#1A2332] hover:border-[#00D4FF40] py-2 rounded-lg transition-all font-mono"
        >
          {expanded ? "▲ Hide Analysis" : "▼ Full Analysis"}
        </button>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-[#1A2332] p-5 space-y-5">
          {/* Radar Chart */}
          <div>
            <p className="text-[10px] text-[#5A7A9A] font-mono mb-2">IMPACT RADAR</p>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1A2332" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#5A7A9A", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke={ringColor}
                  fill={ringColor}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                />
                <Tooltip
                  contentStyle={{ background: "#0F1623", border: "1px solid #1A2332", borderRadius: 8, fontSize: 11 }}
                  itemStyle={{ color: ringColor }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Dimension reasoning */}
          <div>
            <p className="text-[10px] text-[#5A7A9A] font-mono mb-2">SCORING RATIONALE</p>
            <div className="space-y-2">
              {dimensions.map((dim) => {
                const d = (scores as any)?.[dim];
                if (!d?.reasoning) return null;
                return (
                  <div key={dim} className="bg-[#0A0E17] rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-mono text-[#C8D8E8]">{DIMENSION_LABELS[dim]}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: ringColor }}>{d.score}/20</span>
                    </div>
                    <p className="text-[10px] text-[#5A7A9A] leading-relaxed">{d.reasoning}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counterparty & Key Facts */}
          {extracted?.counterparty && (
            <div>
              <p className="text-[10px] text-[#5A7A9A] font-mono mb-1">COUNTERPARTY</p>
              <p className="text-[11px] text-[#C8D8E8]">{extracted.counterparty}</p>
            </div>
          )}

          {extracted?.key_facts && extracted.key_facts.length > 0 && (
            <div>
              <p className="text-[10px] text-[#5A7A9A] font-mono mb-2">KEY FACTS</p>
              <ul className="space-y-1">
                {extracted.key_facts.map((fact, i) => (
                  <li key={i} className="text-[10px] text-[#C8D8E8] flex gap-2">
                    <span className="text-[#00D4FF] flex-shrink-0">→</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analyst note */}
          {scores?.analyst_note && (
            <div className="bg-[#00D4FF08] border border-[#00D4FF20] rounded-lg p-3">
              <p className="text-[10px] text-[#00D4FF] font-mono mb-1">ANALYST NOTE</p>
              <p className="text-[11px] text-[#C8D8E8] leading-relaxed">{scores.analyst_note}</p>
            </div>
          )}

          {/* Overall justification */}
          {scores?.overall_justification && (
            <div>
              <p className="text-[10px] text-[#5A7A9A] font-mono mb-1">OVERALL ASSESSMENT</p>
              <p className="text-[11px] text-[#5A7A9A] leading-relaxed">{scores.overall_justification}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}