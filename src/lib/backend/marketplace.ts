import { supabase } from "../supabaseClient";
import { uploadDataUrl } from "./storage";
import type { MarketplaceListingRow, ProfileRow } from "./types";
import type { LatLng, MarketplaceListing, VehicleTypeId } from "../../types";

function listingFromRow(row: MarketplaceListingRow, seller: ProfileRow | undefined): MarketplaceListing {
  // photo_urls is the current column; photo_url is kept only so listings written by the very first version of this feature still show their one photo.
  const photoUrls = row.photo_urls && row.photo_urls.length > 0 ? row.photo_urls : row.photo_url ? [row.photo_url] : [];
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: seller?.name ?? "",
    sellerAvatarEmoji: seller?.avatar_emoji ?? "🙂",
    sellerAvatarPhoto: seller?.avatar_photo_url ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    price: row.price ?? undefined,
    vehicleType: (row.vehicle_type as VehicleTypeId | "other" | null) ?? undefined,
    photoUrls,
    phone: row.phone,
    locationText: row.location_text ?? undefined,
    locationPosition: row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : undefined,
    views: row.views ?? 0,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchListings(): Promise<MarketplaceListing[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rows, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const listings = rows as MarketplaceListingRow[];
  if (listings.length === 0) return [];

  const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
  const { data: sellers, error: sErr } = await supabase.from("profiles_public").select("id, name, avatar_emoji, avatar_photo_url").in("id", sellerIds);
  if (sErr) throw sErr;
  const sellerById = new Map((sellers as ProfileRow[]).map((s) => [s.id, s]));

  return listings.map((l) => listingFromRow(l, sellerById.get(l.seller_id)));
}

export interface NewListingInput {
  sellerId: string;
  title: string;
  description?: string;
  price?: number;
  vehicleType?: VehicleTypeId | "other";
  photoDataUrls?: string[];
  phone: string;
  locationText?: string;
  locationPosition?: LatLng;
}

const MAX_PHOTOS = 5;

export async function createListing(input: NewListingInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const photos = (input.photoDataUrls ?? []).slice(0, MAX_PHOTOS);
  const photoUrls = await Promise.all(photos.map((p) => uploadDataUrl("marketplace-photos", input.sellerId, p)));
  const { error } = await supabase.from("marketplace_listings").insert({
    seller_id: input.sellerId,
    title: input.title,
    description: input.description ?? null,
    price: input.price ?? null,
    vehicle_type: input.vehicleType ?? null,
    photo_urls: photoUrls.length > 0 ? photoUrls : null,
    phone: input.phone,
    location_text: input.locationText ?? null,
    lat: input.locationPosition?.lat ?? null,
    lng: input.locationPosition?.lng ?? null,
  });
  if (error) throw error;
}

/** Soft-delete (active=false) rather than a hard delete, so a sold item's history isn't just gone. */
export async function removeListing(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("marketplace_listings").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function incrementListingViews(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("increment_listing_views", { p_listing_id: id });
  if (error) throw error;
}
