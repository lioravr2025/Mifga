import { useEffect, useRef } from "react";
import { AttributionControl, Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import type { Friend, HazardReport, LatLng } from "../types";
import { getHazardType } from "../data/hazardTypes";
import { friendDivIcon, hazardDivIcon, selfDivIcon } from "../lib/mapIcons";
import { timeAgo } from "../lib/geo";
import { useApp } from "../context/AppContext";

// CARTO's free "dark matter" basemap needs no API key, so local dev never
// depends on a Google Maps billing key. To port to native (Capacitor), swap
// this TileLayer for @capacitor/google-maps or the Google Maps JS SDK - the
// hazard/friend marker layer above it is provider-agnostic.
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
// Close street-level default so the map opens zoomed in on the user, not the neighborhood.
const DEFAULT_ZOOM = 18;

function RecenterController({ target, signal }: { target: LatLng; signal: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      map.setView([target.lat, target.lng], DEFAULT_ZOOM);
      first.current = false;
      return;
    }
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), DEFAULT_ZOOM), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

/**
 * Leaflet caches its container's pixel size internally and only recomputes it
 * on window resize by default - if the container resizes for any other
 * reason (a sibling panel appearing/disappearing, like the bottom bar
 * hiding while picking a manual pin location), that cache goes stale and
 * map.getCenter()/pixel<->latlng conversions become geographically wrong,
 * even though the map visually re-renders at its new size. This is what was
 * causing the manual-pin "gap between where I dropped it and where it
 * actually landed" bug. Watching the container with ResizeObserver and
 * calling invalidateSize() keeps Leaflet's internal size in sync with
 * reality regardless of *why* the container resized.
 */
export function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function CenterTracker({ onChange }: { onChange: (c: LatLng) => void }) {
  const map = useMapEvents({
    move: () => {
      const c = map.getCenter();
      onChange({ lat: c.lat, lng: c.lng });
    },
  });
  useEffect(() => {
    const c = map.getCenter();
    onChange({ lat: c.lat, lng: c.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface MapViewProps {
  userPosition: LatLng;
  /** where the camera should fly to on the next recenterSignal bump - defaults to userPosition (e.g. when focusing a friend instead) */
  cameraTarget?: LatLng;
  recenterSignal: number;
  hazards: HazardReport[];
  friends?: Friend[];
  showFriends?: boolean;
  theme: "dark" | "light";
  onSelectHazard?: (h: HazardReport) => void;
  onSelectSelf?: () => void;
  pickingLocation?: boolean;
  onPickedCenterChange?: (c: LatLng) => void;
  /** shows a "protection radius" halo around the self marker, matching settings.rideAlertRadiusM, while a ride is active */
  rideActive?: boolean;
  /** tapping a bare point on the map (not a marker/popup) - used to report a hazard right at that spot */
  onMapClick?: (pos: LatLng) => void;
}

function ClickHandler({ onClick }: { onClick: (pos: LatLng) => void }) {
  useMapEvents({
    click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

export default function MapView({
  userPosition,
  cameraTarget,
  recenterSignal,
  hazards,
  friends = [],
  showFriends = false,
  theme,
  onSelectHazard,
  onSelectSelf,
  pickingLocation = false,
  onPickedCenterChange,
  rideActive = false,
  onMapClick,
}: MapViewProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const { user, settings } = useApp();

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[userPosition.lat, userPosition.lng]}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        ref={mapRef}
      >
        {/* Default position, but lifted clear of the floating ride button via CSS (see index.css) - every other corner already has a control (menu/bell/locate). */}
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer url={theme === "dark" ? DARK_TILES : LIGHT_TILES} attribution="&copy; OpenStreetMap &copy; CARTO" />
        <MapResizeHandler />
        <RecenterController target={cameraTarget ?? userPosition} signal={recenterSignal} />
        {pickingLocation && onPickedCenterChange && <CenterTracker onChange={onPickedCenterChange} />}
        {!pickingLocation && onMapClick && <ClickHandler onClick={onMapClick} />}

        {rideActive && (
          <Circle
            center={[userPosition.lat, userPosition.lng]}
            radius={settings.rideAlertRadiusM}
            pathOptions={{ color: "#7c3aed", weight: 2, fillColor: "#7c3aed", fillOpacity: 0.08 }}
            interactive={false}
          />
        )}

        <Marker
          position={[userPosition.lat, userPosition.lng]}
          icon={selfDivIcon(user.vehicleType)}
          eventHandlers={{ click: () => onSelectSelf?.() }}
        />

        {showFriends &&
          friends
            .filter((f) => f.shareLocation)
            .map((f) => (
              <Marker key={f.id} position={[f.position.lat, f.position.lng]} icon={friendDivIcon(f.avatarEmoji, f.online, f.avatarPhoto)}>
                <Popup>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {f.avatarPhoto ? (
                      <img src={f.avatarPhoto} alt="" style={{ width: 22, height: 22, borderRadius: "9999px", objectFit: "cover" }} />
                    ) : (
                      <span>{f.avatarEmoji}</span>
                    )}
                    {f.name}
                  </div>
                </Popup>
              </Marker>
            ))}

        {hazards.map((h) => {
          const def = getHazardType(h.type);
          return (
            <Marker
              key={h.id}
              position={[h.position.lat, h.position.lng]}
              icon={hazardDivIcon(def)}
              eventHandlers={{
                click: () => onSelectHazard?.(h),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{def.label}</div>
                  <div className="text-neutral-500">{timeAgo(h.createdAt)}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
