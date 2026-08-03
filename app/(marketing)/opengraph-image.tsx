import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const paper = "#faf8f3";
const ink = "#26241e";
const inkMuted = "#8a8578";
const stamp = "#173e73";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        backgroundColor: paper,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            width: 48,
            height: 48,
            borderRadius: 10,
            backgroundColor: stamp,
            color: paper,
            fontSize: 24,
            fontWeight: 700,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          T
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: ink }}>Trezofy</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 60,
            fontWeight: 600,
            color: ink,
            lineHeight: 1.15,
            maxWidth: 920,
          }}
        >
          Do pedido do cliente ao envio do orçamento, em segundos.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `2px solid ${ink}1a`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", fontSize: 22, color: inkMuted }}>
          Orçamento automático + CRM enxuto para times de vendas
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `3px solid ${stamp}`,
            color: stamp,
            borderRadius: 999,
            padding: "10px 22px",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            transform: "rotate(-8deg)",
          }}
        >
          PRONTO
        </div>
      </div>
    </div>,
    { ...size },
  );
}
