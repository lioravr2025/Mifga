import type { VehicleTypeId } from "../types";

// Curated list of real, popular model names per vehicle category, used to
// power the model-name autocomplete in the profile's vehicle editor.
// Note: there's no reliable free public API for "consumer scooter/e-bike/
// e-motorcycle model catalogs", so this ships as a static local list rather
// than a live web lookup - freeform text entry is always available too for
// anything not listed, same as it would be against a real catalog.
export const VEHICLE_MODELS: Record<VehicleTypeId, string[]> = {
  scooter: [
    "Xiaomi Mi Electric Scooter Pro 2",
    "Xiaomi Electric Scooter 4",
    "Ninebot Max G30",
    "Ninebot KickScooter F40",
    "Segway Ninebot ES4",
    "Bird One",
    "Lime Gen4",
    "Wind W5",
    "Kaabo Mantis",
    "InMotion L9",
    "Micro Explorer",
    "Dualtron Thunder",
  ],
  ebike: [
    "Ride Rider 8",
    "Ride Rider RX",
    "Ride Nitro",
    "Rad Power RadRunner",
    "Cannondale Tesoro",
    "Trek Allant+",
    "Cube Reaction Hybrid",
    "Specialized Turbo Vado",
    "Giant Explore E+",
    "Buzz Cerato",
  ],
  emotorcycle: [
    "Sur-Ron Light Bee",
    "Sur-Ron Storm Bee",
    "Talaria Sting",
    "Talaria XXX",
    "Zero FXE",
    "Zero SR/F",
    "Super Soco TC Max",
    "NIU NQi GTS",
    "CAKE Kalk",
    "Segway E300SE",
  ],
};

export function searchVehicleModels(type: VehicleTypeId, query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  const list = VEHICLE_MODELS[type] ?? [];
  if (!q) return list.slice(0, limit);
  return list.filter((m) => m.toLowerCase().includes(q)).slice(0, limit);
}
