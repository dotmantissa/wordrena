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
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: "#14121f",
          border: "2px solid #3a3455",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 11,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#ffd07a",
          }}
        />
        <div
          style={{
            color: "#ffb638",
            fontSize: 40,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          W
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 8,
            width: 34,
            height: 3,
            borderRadius: 999,
            background: "#38a8ff",
          }}
        />
      </div>
    ),
    size
  );
}
