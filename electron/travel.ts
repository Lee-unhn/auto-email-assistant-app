import os from 'os'
import path from 'path'
import { promises as fs } from 'fs'
import { writeJsonAtomic } from '../src/util/atomicWrite'

// Travel-time estimate via FREE keyless OSM services:
//   geocode  → Nominatim (https://nominatim.openstreetmap.org) — needs a User-Agent,
//              ~1 req/s; we cache results so we stay well under the usage policy.
//   driving  → OSRM public car server (https://routing.openstreetmap.de/routed-car).
//   origin   → configured home address (geocoded), else IP location (ip-api, keyless).
// Everything is best-effort with a haversine fallback; nothing is sent to any
// non-OSM endpoint. Addresses are used only for the user's own reminders.

const UA = 'auto-email-assistant/1.0 (personal calendar travel reminder)'
const GEOCACHE = path.join(os.homedir(), '.auto-email-assistant-geocache.json')

export interface LatLon { lat: number; lon: number }
let cache: Record<string, LatLon | null> | null = null

async function loadCache(): Promise<Record<string, LatLon | null>> {
  if (cache) return cache
  try { cache = JSON.parse(await fs.readFile(GEOCACHE, 'utf-8')) } catch { cache = {} }
  return cache!
}

export async function geocode(q: string): Promise<LatLon | null> {
  q = (q || '').trim()
  if (!q) return null
  const c = await loadCache()
  if (q in c) return c[q]
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-TW,en' } })
    if (!r.ok) throw new Error(String(r.status))
    const arr = (await r.json()) as Array<{ lat: string; lon: string }>
    const hit = Array.isArray(arr) && arr[0] ? { lat: +arr[0].lat, lon: +arr[0].lon } : null
    c[q] = hit
    await writeJsonAtomic(GEOCACHE, c)
    return hit
  } catch { return null }
}

export async function ipLocate(): Promise<LatLon | null> {
  try {
    const r = await fetch('https://ip-api.com/json/?fields=status,lat,lon')
    const j = (await r.json()) as { status: string; lat: number; lon: number }
    return j.status === 'success' ? { lat: j.lat, lon: j.lon } : null
  } catch { return null }
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function osrmMinutes(from: LatLon, to: LatLon): Promise<number | null> {
  try {
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    const j = (await r.json()) as { routes?: Array<{ duration: number }> }
    const dur = j?.routes?.[0]?.duration
    return typeof dur === 'number' ? Math.round(dur / 60) : null
  } catch { return null }
}

async function resolveOrigin(homeAddress: string): Promise<LatLon | null> {
  if (homeAddress?.trim()) { const g = await geocode(homeAddress); if (g) return g }
  return ipLocate()
}

// Estimated driving minutes origin → destination address. OSRM first; haversine/30km·h
// fallback if routing is down; null only if the destination can't be located at all.
export async function estimateTravelMin(homeAddress: string, destAddress: string): Promise<number | null> {
  const to = await geocode(destAddress)
  if (!to) return null
  const from = await resolveOrigin(homeAddress)
  if (!from) return null
  const osrm = await osrmMinutes(from, to)
  if (osrm != null) return osrm
  return Math.max(5, Math.round((haversineKm(from, to) / 30) * 60))
}
