import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaColor?: string;
  icon?: ReactNode;
  valueColor?: string;
}

export default function StatCard({
  label,
  value,
  delta,
  deltaColor,
  icon,
  valueColor = "#fff",
}: StatCardProps) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, color: "#888" }}>{label}</span>
        {icon && (
          <span style={{ color: "#c9a84c", opacity: 0.8 }}>{icon}</span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: valueColor }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 12, color: deltaColor ?? "#888" }}>{delta}</div>
      )}
    </div>
  );
}
