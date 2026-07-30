import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";

/** Mirrors the mobile app's prizeDivIcon (mapIcons.tsx) - a gold ring around the emoji or uploaded image. */
export function prizeMapIcon(icon: string, imageUrl?: string | null): L.DivIcon {
  const size = 32;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: "#0f1830",
        border: "2px solid #f59e0b",
        boxShadow: "0 0 10px -1px #f59e0b",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        overflow: "hidden",
      }}
    >
      {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "9999px" }} /> : icon}
    </div>
  );
  return L.divIcon({ html, className: "mifga-admin-prize-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
}
