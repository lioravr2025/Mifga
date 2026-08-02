import { useEffect, useRef } from "react";
import { AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import type { Friend, HazardReport, LatLng, Prize } from "../types";
import { getHazardType } from "../data/hazardTypes";
import { useApp } from "../context/AppContext";
import { HazardIcon } from "./HazardIcon";
import { VehicleIcon } from "./VehicleIcons";
import { HAZARD_COLOR_HEX } from "../lib/colors";

// Google Maps experiment (google-maps-experiment branch) - drop-in replacement
// for MapView.tsx with the same props, swapping Leaflet/CARTO/OSM for the
// Google Maps JavaScript API. See MapView.tsx for the original.
const DEFAULT_ZOOM = 18;

export function RecenterController({ target, signal }: { target: LatLng; signal: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) {
      map.moveCamera({ center: { lat: target.lat, lng: target.lng }, zoom: DEFAULT_ZOOM });
      first.current = false;
      return;
    }
    map.panTo({ lat: target.lat, lng: target.lng });
    if ((map.getZoom() ?? 0) < DEFAULT_ZOOM) map.setZoom(DEFAULT_ZOOM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, map]);
  return null;
}

export function AutoFollow({ position, zoom }: { position: LatLng; zoom?: number }) {
  const map = useMap();
  const zoomedInRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    if (zoom != null && !zoomedInRef.current) {
      zoomedInRef.current = true;
      map.moveCamera({ center: { lat: position.lat, lng: position.lng }, zoom });
    } else {
      map.panTo({ lat: position.lat, lng: position.lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng, map]);
  return null;
}

export function CenterTracker({ onChange }: { onChange: (c: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const report = () => {
      const c = map.getCenter();
      if (c) onChange({ lat: c.lat(), lng: c.lng() });
    };
    report();
    const listener = map.addListener("center_changed", report);
    return () => listener.remove();
  }, [map, onChange]);
  return null;
}

function ClickHandler({ onClick }: { onClick: (pos: LatLng) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) onClick({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => listener.remove();
  }, [map, onClick]);
  return null;
}

interface MapViewProps {
  userPosition: LatLng;
  cameraTarget?: LatLng;
  recenterSignal: number;
  hazards: HazardReport[];
  prizes?: Prize[];
  friends?: Friend[];
  showFriends?: boolean;
  theme: "dark" | "light";
  onSelectHazard?: (h: HazardReport) => void;
  onSelectSelf?: () => void;
  pickingLocation?: boolean;
  onPickedCenterChange?: (c: LatLng) => void;
  rideActive?: boolean;
  onMapClick?: (pos: LatLng) => void;
  autoFollow?: boolean;
}

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;

export default function GoogleMapView({
  userPosition,
  cameraTarget,
  recenterSignal,
  hazards,
  prizes = [],
  friends = [],
  showFriends = false,
  theme,
  onSelectHazard,
  onSelectSelf,
  pickingLocation = false,
  onPickedCenterChange,
  rideActive = false,
  onMapClick,
  autoFollow = false,
}: MapViewProps) {
  const { user } = useApp();

  return (
    <div className="relative w-full h-full">
      <Map
        mapId={MAP_ID}
        defaultCenter={{ lat: userPosition.lat, lng: userPosition.lng }}
        defaultZoom={DEFAULT_ZOOM}
        colorScheme={theme === "dark" ? "DARK" : "LIGHT"}
        disableDefaultUI
        gestureHandling="greedy"
        className="w-full h-full"
        onClick={!pickingLocation && onMapClick ? (e) => e.detail.latLng && onMapClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng }) : undefined}
      >
        <RecenterController target={cameraTarget ?? userPosition} signal={recenterSignal} />
        {autoFollow && <AutoFollow position={userPosition} />}
        {pickingLocation && onPickedCenterChange && <CenterTracker onChange={onPickedCenterChange} />}

        {rideActive && <RideRadiusCircle center={userPosition} />}

        <AdvancedMarker position={{ lat: userPosition.lat, lng: userPosition.lng }} onClick={() => onSelectSelf?.()}>
          <div className="relative">
            <span className="absolute inset-0 rounded-full border-2 border-brand animate-pulseRing" />
            <div
              className="relative rounded-full flex items-center justify-center border-[3px] border-white"
              style={{ width: user.vehicleType ? 38 : 26, height: user.vehicleType ? 38 : 26, background: "#7c3aed", boxShadow: "0 0 10px 2px rgba(124,58,237,0.8)" }}
            >
              {user.vehicleType && <VehicleIcon type={user.vehicleType} size={18} color="white" />}
            </div>
          </div>
        </AdvancedMarker>

        {showFriends &&
          friends
            .filter((f) => f.shareLocation)
            .map((f) => (
              <AdvancedMarker key={f.id} position={{ lat: f.position.lat, lng: f.position.lng }}>
                <div
                  className="rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    width: 34,
                    height: 34,
                    background: "#1a2438",
                    border: `2px solid ${f.online ? "#22c55e" : "#4b5568"}`,
                    boxShadow: f.online ? "0 0 10px -1px #22c55e" : "none",
                    fontSize: 18,
                  }}
                >
                  {f.avatarPhoto ? <img src={f.avatarPhoto} alt="" className="w-full h-full object-cover" /> : f.avatarEmoji}
                </div>
              </AdvancedMarker>
            ))}

        {prizes.map((p) => (
          <AdvancedMarker key={p.id} position={{ lat: p.position.lat, lng: p.position.lng }}>
            <div
              className="rounded-full flex items-center justify-center overflow-hidden"
              style={{ width: 40, height: 40, background: "#0f1830", border: "2px solid #f59e0b", boxShadow: "0 0 14px -1px #f59e0b", fontSize: 20 }}
            >
              {p.iconImageUrl ? <img src={p.iconImageUrl} alt="" className="w-full h-full object-cover" /> : p.icon}
            </div>
          </AdvancedMarker>
        ))}

        {hazards.map((h) => {
          const def = getHazardType(h.type);
          const hex = HAZARD_COLOR_HEX[def.color] ?? "#38bdf8";
          const size = def.highPriority ? 44 : 38;
          return (
            <AdvancedMarker key={h.id} position={{ lat: h.position.lat, lng: h.position.lng }} onClick={() => onSelectHazard?.(h)}>
              <div className="relative" style={{ width: size, height: size }}>
                {def.highPriority && <span className="absolute inset-0 rounded-full border-2 animate-pulseRing" style={{ borderColor: hex }} />}
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center"
                  style={{ background: "#0f1830", border: `2px solid ${hex}`, boxShadow: `0 0 12px -1px ${hex}` }}
                >
                  <HazardIcon name={def.icon} color={hex} size={def.highPriority ? 22 : 18} strokeWidth={2.4} />
                </div>
              </div>
            </AdvancedMarker>
          );
        })}
      </Map>
    </div>
  );
}

function RideRadiusCircle({ center }: { center: LatLng }) {
  const map = useMap();
  const { settings } = useApp();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      map,
      center: { lat: center.lat, lng: center.lng },
      radius: settings.rideAlertRadiusM,
      strokeColor: "#7c3aed",
      strokeWeight: 2,
      fillColor: "#7c3aed",
      fillOpacity: 0.08,
      clickable: false,
    });
    circleRef.current = circle;
    return () => circle.setMap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    circleRef.current?.setCenter({ lat: center.lat, lng: center.lng });
  }, [center.lat, center.lng]);

  useEffect(() => {
    circleRef.current?.setRadius(settings.rideAlertRadiusM);
  }, [settings.rideAlertRadiusM]);

  return null;
}
