"use client";

type Props = {
  label: string;
  value: string | number;
};

export default function StatCard({ label, value }: Props) {
  return (
    <div className="app-card app-card-padding">
      <p className="app-text-faint" style={{ fontSize: "0.95rem" }}>
        {label}
      </p>
      <p
        className="app-text"
        style={{
          marginTop: "8px",
          fontSize: "3rem",
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </p>
    </div>
  );
}