"use client";

type Props = {
  status?: string;
};

type StepKey = "invited" | "accepted" | "funded" | "submitted" | "live";

const steps: { key: StepKey; label: string }[] = [
  { key: "invited", label: "Invited" },
  { key: "accepted", label: "Accepted" },
  { key: "funded", label: "Funded" },
  { key: "submitted", label: "Submitted" },
  { key: "live", label: "Live" },
];

function getCurrentIndex(status?: string) {
  switch (status) {
    case "accepted":
      return 1;
    case "funded":
      return 2;
    case "submitted":
      return 3;
    case "live":
      return 4;
    case "rejected":
      return 0;
    default:
      return 0;
  }
}

export default function CampaignTimeline({ status }: Props) {
  const currentIndex = getCurrentIndex(status);
  const isRejected = status === "rejected";

  return (
    <div style={{ marginTop: "24px" }}>
      <h3 className="app-text" style={{ fontWeight: 600, marginBottom: "14px" }}>
        Campaign Progress
      </h3>

      {isRejected ? (
        <div className="app-card app-card-padding">
          <p className="app-text" style={{ margin: 0, fontWeight: 600 }}>
            Campaign Rejected
          </p>
          <p className="app-text-soft" style={{ marginTop: "8px", marginBottom: 0 }}>
            This campaign was declined and will not move to the next stages.
          </p>
        </div>
      ) : (
        <div
          className="app-card app-card-padding"
          style={{
            display: "grid",
            gap: "14px",
          }}
        >
          {steps.map((step, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

            let circleBg = "var(--surface-muted)";
            let circleBorder = "var(--border)";
            let circleText = "var(--text-faint)";
            let lineBg = "var(--border)";

            if (isComplete) {
              circleBg = "var(--primary)";
              circleBorder = "var(--primary)";
              circleText = "var(--primary-text)";
              lineBg = "var(--primary)";
            } else if (isCurrent) {
              circleBg = "var(--surface)";
              circleBorder = "var(--primary)";
              circleText = "var(--text)";
            }

            return (
              <div
                key={step.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr",
                  columnGap: "14px",
                  alignItems: "start",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "999px",
                      border: `2px solid ${circleBorder}`,
                      background: circleBg,
                      color: circleText,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </div>

                  {index < steps.length - 1 && (
                    <div
                      style={{
                        width: "2px",
                        minHeight: "28px",
                        background: lineBg,
                        marginTop: "6px",
                      }}
                    />
                  )}
                </div>

                <div style={{ paddingTop: "4px" }}>
                  <p
                    className="app-text"
                    style={{
                      margin: 0,
                      fontWeight: isCurrent ? 700 : 600,
                    }}
                  >
                    {step.label}
                  </p>
                  <p
                    className="app-text-soft"
                    style={{
                      marginTop: "4px",
                      marginBottom: 0,
                    }}
                  >
                    {isCurrent
                      ? "Current step"
                      : isComplete
                      ? "Completed"
                      : "Coming next"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}