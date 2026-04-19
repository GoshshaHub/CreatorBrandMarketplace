"use client";

type Props = {
  status?: string;
};

function getLabel(status?: string) {
  switch (status) {
    case "live":
      return "Live";
    case "submitted":
      return "Submitted";
    case "funded":
      return "Funded";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default:
      return "Invited";
  }
}

function getClassName(status?: string) {
  switch (status) {
    case "live":
      return "app-pill app-pill-live";
    case "submitted":
      return "app-pill app-pill-submitted";
    case "funded":
      return "app-pill app-pill-funded";
    case "accepted":
      return "app-pill app-pill-accepted";
    case "rejected":
      return "app-pill app-pill-rejected";
    default:
      return "app-pill";
  }
}

export default function StatusPill({ status }: Props) {
  return <span className={getClassName(status)}>{getLabel(status)}</span>;
}