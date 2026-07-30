import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { HazardIcon } from "../components/HazardIcon";
import { VehicleIcon } from "../components/VehicleIcons";
import type { HazardTypeDef, VehicleTypeId } from "../types";
import { HAZARD_COLOR_HEX } from "./colors";

export function hazardDivIcon(def: HazardTypeDef, opts: { faded?: boolean } = {}): L.DivIcon {
  const hex = HAZARD_COLOR_HEX[def.color] ?? "#38bdf8";
  const size = def.highPriority ? 44 : 38;
  const iconSize = def.highPriority ? 22 : 18;
  const opacity = opts.faded ? 0.45 : 1;

  const html = renderToStaticMarkup(
    <div style={{ position: "relative", width: size, height: size }}>
      {def.highPriority && (
        <span
          className="animate-pulseRing"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            border: `2px solid ${hex}`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: "#0f1830",
          border: `2px solid ${hex}`,
          boxShadow: `0 0 12px -1px ${hex}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity,
        }}
      >
        <HazardIcon name={def.icon} color={hex} size={iconSize} strokeWidth={2.4} />
      </div>
    </div>
  );

  return L.divIcon({
    html,
    className: "mifga-hazard-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * The user's own marker. Once they've picked a vehicle in their profile it
 * shows that vehicle's icon instead of a plain dot, so "which pin is me" is
 * unambiguous next to hazard markers (police/inspector included).
 */
export function selfDivIcon(vehicleType?: VehicleTypeId): L.DivIcon {
  const size = vehicleType ? 38 : 26;
  const html = renderToStaticMarkup(
    <div style={{ position: "relative", width: size, height: size }}>
      <span
        className="animate-pulseRing"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          border: "2px solid #7c3aed",
        }}
      />
      {vehicleType ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            background: "#7c3aed",
            border: "3px solid white",
            boxShadow: "0 0 10px 2px rgba(124,58,237,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VehicleIcon type={vehicleType} size={18} color="white" />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: "9999px",
            background: "#7c3aed",
            border: "3px solid white",
            boxShadow: "0 0 10px 2px rgba(124,58,237,0.8)",
          }}
        />
      )}
    </div>
  );
  return L.divIcon({ html, className: "mifga-user-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

/** Admin-seeded collectible reward - a pulsing gold glow so it reads as "grab me" distinctly from hazard markers. Shows a custom uploaded image when set, the emoji otherwise. */
export function prizeDivIcon(icon: string, imageUrl?: string): L.DivIcon {
  const size = 40;
  const html = renderToStaticMarkup(
    <div style={{ position: "relative", width: size, height: size }}>
      <span
        className="animate-pulseRing"
        style={{ position: "absolute", inset: 0, borderRadius: "9999px", border: "2px solid #f59e0b" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "9999px",
          background: "#0f1830",
          border: "2px solid #f59e0b",
          boxShadow: "0 0 14px -1px #f59e0b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          overflow: "hidden",
        }}
      >
        {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "9999px" }} /> : icon}
      </div>
    </div>
  );
  return L.divIcon({
    html,
    className: "mifga-prize-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function destinationDivIcon(): L.DivIcon {
  const html = renderToStaticMarkup(
    <div style={{ position: "relative", width: 30, height: 40 }}>
      <svg width="30" height="40" viewBox="0 0 30 40" fill="none">
        <path
          d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.3-6.7-15-15-15z"
          fill="#ef4444"
          stroke="white"
          strokeWidth="1.5"
        />
        <circle cx="15" cy="15" r="5.5" fill="white" />
      </svg>
    </div>
  );
  return L.divIcon({ html, className: "mifga-dest-marker", iconSize: [30, 40], iconAnchor: [15, 40] });
}

export function friendDivIcon(emoji: string, online: boolean, photoUrl?: string): L.DivIcon {
  const html = renderToStaticMarkup(
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "9999px",
        background: "#1a2438",
        border: `2px solid ${online ? "#22c55e" : "#4b5568"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        boxShadow: online ? "0 0 10px -1px #22c55e" : "none",
        overflow: "hidden",
      }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        emoji
      )}
    </div>
  );
  return L.divIcon({ html, className: "mifga-friend-marker", iconSize: [34, 34], iconAnchor: [17, 17] });
}
