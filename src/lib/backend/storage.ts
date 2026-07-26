import { supabase } from "../supabaseClient";

function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const [header, base64] = dataUrl.split(",");
  const contentType = header.match(/data:(.*);base64/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

function extFromContentType(contentType: string): string {
  return contentType.split("/")[1]?.split(";")[0]?.split("+")[0] || "bin";
}

async function uploadAndGetUrl(bucket: string, path: string, blob: Blob, contentType: string): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Uploads a `data:...;base64,...` URL (what FileReader.readAsDataURL produces) and returns its public URL. */
export async function uploadDataUrl(bucket: string, pathPrefix: string, dataUrl: string): Promise<string> {
  const { blob, contentType } = dataUrlToBlob(dataUrl);
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromContentType(contentType)}`;
  return uploadAndGetUrl(bucket, path, blob, contentType);
}

/** Uploads a raw Blob (e.g. a MediaRecorder voice clip) and returns its public URL. */
export async function uploadBlob(bucket: string, pathPrefix: string, blob: Blob): Promise<string> {
  const contentType = blob.type || "application/octet-stream";
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromContentType(contentType)}`;
  return uploadAndGetUrl(bucket, path, blob, contentType);
}
