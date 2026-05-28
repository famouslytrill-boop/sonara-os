import { ImageResponse } from "next/og";

export const alt = "SONARA Industries - Build. Create. Grow.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#07111F",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ color: "#2DD4BF", fontSize: 32, fontWeight: 800, letterSpacing: 6 }}>SONARA INDUSTRIES</div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1.05, marginTop: 24, textAlign: "center" }}>
          Build. Create. Grow.
        </div>
        <div style={{ color: "#CBD5E1", fontSize: 34, lineHeight: 1.35, marginTop: 30, maxWidth: 900, textAlign: "center" }}>
          Business Builder. Creator Studio. Growth Studio.
        </div>
      </div>
    ),
    size,
  );
}
