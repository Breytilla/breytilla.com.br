import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#2A1F1A",
          color: "#C4956A",
          display: "flex",
          fontFamily: "Georgia, serif",
          fontSize: 42,
          fontStyle: "italic",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "1px solid rgba(245, 239, 230, 0.42)",
            borderRadius: "50%",
            inset: 7,
            position: "absolute",
          }}
        />
        B
      </div>
    ),
    size,
  );
}
