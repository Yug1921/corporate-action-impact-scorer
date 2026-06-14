"use client";
import { useState } from "react";
import { AnalysisResult, DIMENSION_LABELS, DIMENSION_ICONS, getDimReason, getRatingColor } from "../lib/api";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

type DimKey = "financial_magnitude"|"sector_sensitivity"|"revenue_contribution"|"announcement_credibility"|"market_impact_potential";
const DIMS: DimKey[] = ["financial_magnitude","sector_sensitivity","revenue_contribution","announcement_credibility","market_impact_potential"];

interface Props { result: AnalysisResult; animationDelay?: number; }

export default function ScoreCard({ result, animationDelay = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { scores, extracted, rank, fetch_error } = result;

  const total   = scores?.total_score ?? 0;
  const rating  = scores?.rating ?? "UNKNOWN";
  const pct     = scores?.score_percentage ?? 0;
  const color   = scores?.rating_color || getRatingColor(rating);
  const company = extracted?.company_name || result.label.split("—")[0].trim();

  const C = 2 * Math.PI * 40;
  const dash = C - (pct / 100) * C;

  const radarData = DIMS.map(d => ({
    subject: DIMENSION_LABELS[d].split(" ")[0],
    score: scores?.[d]?.score ?? 0,
    fullMark: 20,
  }));

  return (
    <div className="card flex flex-col" style={{ animationDelay: `${animationDelay}ms` }}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-4">
          {/* Left: company info */}
          <div className="flex-1 min-w-0">
            {rank && (
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold mb-2 ${rank <= 3 ? `medal-${rank}` : ""}`}
                style={rank > 3 ? {
                  background: "var(--bg-hover)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-mid)",
                } : {}}
              >
                {rank}
              </span>
            )}
            <h3 className="font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>{company}</h3>

            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {extracted?.ticker && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(56,189,248,0.1)", color: "var(--accent)", border: "1px solid rgba(56,189,248,0.2)" }}>
                  {extracted.ticker}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {extracted?.announcement_type || (result.status === "processing" ? "Analysing…" : "—")}
              </span>
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {extracted?.financial_value && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.1)", color: "var(--positive)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {extracted.financial_value}
                </span>
              )}
              {extracted?.sector && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}>
                  {extracted.sector}
                </span>
              )}
              {extracted?.time_horizon && extracted.time_horizon !== "Unknown" && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}>
                  {extracted.time_horizon}
                </span>
              )}
            </div>
          </div>

          {/* Right: score ring */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="40" fill="none" stroke="var(--bg-raised)" strokeWidth="6" />
              <circle cx="42" cy="42" r="40" fill="none"
                stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={dash}
                transform="rotate(-90 42 42)"
                className="ring-progress"
              />
              <text x="42" y="38" textAnchor="middle" fill={color} fontSize="17" fontWeight="700" fontFamily="JetBrains Mono, monospace">{total}</text>
              <text x="42" y="51" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="Inter, sans-serif">/ 100</text>
            </svg>
            <span className={`chip chip-${rating}`}>{rating}</span>
          </div>
        </div>

        {/* Summary */}
        {extracted?.summary && !extracted.summary.startsWith("Analysis failed") && (
          <p className="text-[11px] leading-relaxed mt-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {extracted.summary}
          </p>
        )}

        {fetch_error && (
          <div className="mt-2.5 text-[10px] font-mono p-2.5 rounded" style={{ background: "rgba(239,68,68,0.07)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.15)" }}>
            ⚠ {fetch_error.slice(0, 120)}
          </div>
        )}
      </div>

      {/* ── Score bars ─────────────────────────────────── */}
      <div className="p-5 flex-1">
        <div className="space-y-3">
          {DIMS.map(dim => {
            const s = scores?.[dim]?.score ?? 0;
            return (
              <div key={dim}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    <span>{DIMENSION_ICONS[dim]}</span>
                    {DIMENSION_LABELS[dim]}
                  </span>
                  <span className="text-[10px] font-mono font-bold" style={{ color }}>{s}/20</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-raised)" }}>
                  <div className="h-full rounded-full bar-fill" style={{ width: `${(s / 20) * 100}%`, background: `linear-gradient(90deg, ${color}70, ${color})` }} />
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 w-full text-[10px] font-mono py-2 rounded-lg transition-all"
          style={{ color: "var(--accent)", border: "1px solid var(--border)", background: "transparent" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.35)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.04)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          {expanded ? "▲ Collapse" : "▼ Full Analysis"}
        </button>
      </div>

      {/* ── Expanded panel ─────────────────────────────── */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Radar */}
          <div className="pt-4">
            <p className="text-[9px] font-mono tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>IMPACT RADAR</p>
            <ResponsiveContainer width="100%" height={150}>
              <RadarChart data={radarData} margin={{ top: 5, right: 15, bottom: 5, left: 15 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-secondary)", fontSize: 9, fontFamily: "JetBrains Mono" }} />
                <Radar dataKey="score" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={1.5} />
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} itemStyle={{ color }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Rationale */}
          <div>
            <p className="text-[9px] font-mono tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>SCORING RATIONALE</p>
            <div className="space-y-2">
              {DIMS.map(dim => {
                const d = scores?.[dim];
                const reason = getDimReason(d);
                if (!reason) return null;
                return (
                  <div key={dim} className="rounded-lg p-3" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-primary)" }}>{DIMENSION_LABELS[dim]}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color }}>{d!.score}/20</span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{reason}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Counterparty */}
          {extracted?.counterparty && (
            <div>
              <p className="text-[9px] font-mono tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>COUNTERPARTY</p>
              <p className="text-[11px]" style={{ color: "var(--text-primary)" }}>{extracted.counterparty}</p>
            </div>
          )}

          {/* Key facts */}
          {extracted?.key_facts && extracted.key_facts.length > 0 && (
            <div>
              <p className="text-[9px] font-mono tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>KEY FACTS</p>
              <ul className="space-y-1.5">
                {extracted.key_facts.map((f, i) => (
                  <li key={i} className="flex gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--accent)", flexShrink: 0 }}>→</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analyst note */}
          {scores?.analyst_note && (
            <div className="rounded-lg p-3.5" style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.15)" }}>
              <p className="text-[9px] font-mono tracking-wider mb-1.5" style={{ color: "var(--accent)" }}>ANALYST NOTE</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{scores.analyst_note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}