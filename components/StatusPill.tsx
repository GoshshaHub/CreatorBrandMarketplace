"use client";

type Props = {
  status?: string;
};

function normalize(status?: string) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getClassName(status?: string) {
  switch (status) {
    case "live":
    case "completed":
      return "app-pill app-pill-live";
    case "submitted":
      return "app-pill app-pill-submitted";
    case "funded":
      return "app-pill app-pill-funded";
    case "accepted":
    case "approved":
      return "app-pill app-pill-accepted";
    case "rejected":
      return "app-pill app-pill-rejected";
    default:
      return "app-pill";
  }
}

export default function StatusPill({ status }: Props) {
  return <span className={getClassName(status)}>{normalize(status)}</span>;
}