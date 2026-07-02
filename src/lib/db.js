import { supabase, hasSupabase } from "./supabase";

/* ------------------------------------------------------------------ *
 * Key-value store (table: app_kv)
 * Books, meetings, and unit settings are stored as JSON blobs under a
 * key. Low write-frequency, usually one editor at a time.
 * ------------------------------------------------------------------ */
export async function kvGet(key) {
  if (!hasSupabase) return null;
  const { data, error } = await supabase.from("app_kv").select("v").eq("k", key).maybeSingle();
  if (error) throw error;
  return data ? data.v : null;
}

export async function kvSet(key, value) {
  if (!hasSupabase) return false;
  const { error } = await supabase.from("app_kv").upsert({ k: key, v: value });
  if (error) throw error;
  return true;
}

/* ------------------------------------------------------------------ *
 * Message board (table: messages)
 * A real row per post so two people transmitting at once never
 * overwrite each other.
 * ------------------------------------------------------------------ */
const toMsg = (r) => ({ id: r.id, who: r.who, body: r.body, ts: new Date(r.created_at).getTime() });

export async function listMessages() {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(toMsg);
}

export async function addMessage(who, body) {
  if (!hasSupabase) throw new Error("No database configured");
  const { data, error } = await supabase.from("messages").insert({ who, body }).select().single();
  if (error) throw error;
  return toMsg(data);
}

export async function deleteMessage(id) {
  if (!hasSupabase) return;
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}
