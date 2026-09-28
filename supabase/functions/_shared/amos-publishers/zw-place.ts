// Business rule: every video PaMarket posts to Facebook/Instagram must
// carry a Zimbabwe or Harare location tag (user instruction, 2026-09-28).
// Resolves a real Meta "Place" object via the Graph API place-search
// endpoint using the same Page access token the publisher already has —
// no place ID is ever hardcoded or invented. If Graph doesn't return a
// usable place (keyword-only place search is not guaranteed the way
// geo-bounded search is), this fails soft: the caller gets `null` and
// still publishes the video, just without the tag, rather than blocking
// the whole publish over a location lookup.
const GRAPH_API_VERSION = 'v21.0'

async function searchPlace(pageAccessToken: string, query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/search?type=place&q=${encodeURIComponent(query)}&fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`,
    )
    const body = await res.json()
    if (!res.ok || body.error || !Array.isArray(body.data)) return null
    const hit = body.data.find((p: { id?: string; name?: string }) =>
      typeof p.name === 'string' && p.name.toLowerCase().includes(query.toLowerCase()) && p.id,
    )
    return hit?.id ?? null
  } catch {
    return null
  }
}

/** Prefers "Harare" (more specific), falls back to "Zimbabwe" (the country Page). */
export async function resolveZwPlaceId(pageAccessToken: string): Promise<string | null> {
  return (await searchPlace(pageAccessToken, 'Harare')) ?? (await searchPlace(pageAccessToken, 'Zimbabwe'))
}
