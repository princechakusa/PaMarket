import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher, DraftForPublish, PublishResult } from './types.ts'

// Module 13 — real LinkedIn Posts API integration, posting to a Company
// Page. Requires w_organization_social scope, which needs LinkedIn's
// manual Community Management API review (commonly 1-4+ weeks) before
// it actually works — this adapter can be deployed and will correctly
// report LinkedIn's own permission error until that review completes.
//
// credentials_ref points to a Vault secret formatted as
// "<organizationUrn>:<accessToken>", e.g.
// "urn:li:organization:12345678:AQXxxx..." — same one-secret-per-
// platform pattern FacebookPublisher established.
//
// Text-only posts only for now. LinkedIn's image/video posting needs a
// separate asset-upload step (Images API / Videos API) to obtain a
// media URN before it can be referenced in a post — a real additional
// integration, not just an extra field on this same call — deferred
// until the text-only path is confirmed working with a real approved
// token.
const LINKEDIN_API_VERSION = '202601' // Linkedin-Version header, YYYYMM format — bump periodically per LinkedIn's versioning docs

export class LinkedInPublisher implements ContentPublisher {
  readonly platform = 'linkedin'
  private db: SupabaseClient

  constructor(db: SupabaseClient) {
    this.db = db
  }

  async publish(draft: DraftForPublish): Promise<PublishResult> {
    const { data: integration, error: intError } = await this.db
      .from('amos_integrations')
      .select('status, credentials_ref')
      .eq('provider', 'linkedin')
      .maybeSingle()

    if (intError || !integration || integration.status !== 'connected' || !integration.credentials_ref) {
      return { ok: false, status: 'failed', error: 'LinkedIn is not connected — set it up in AMOS System Health → API Manager (needs an organization access token with w_organization_social, stored in Vault) before scheduling LinkedIn posts to auto-publish.' }
    }

    const { data: decryptedSecret, error: secretError } = await this.db
      .rpc('amos_get_vault_secret', { secret_name: integration.credentials_ref })
    if (secretError || !decryptedSecret) {
      return { ok: false, status: 'failed', error: 'LinkedIn credentials_ref is set but the Vault secret could not be read — check it was stored correctly.' }
    }

    // "<organizationUrn>:<accessToken>" — the URN itself contains
    // colons (urn:li:organization:12345), so split on the LAST colon
    // via this pattern rather than a naive split(':', 2).
    const raw = decryptedSecret as string
    const orgUrnMatch = raw.match(/^(urn:li:organization:[^:]+):(.+)$/)
    if (!orgUrnMatch) {
      return { ok: false, status: 'failed', error: 'LinkedIn credentials are malformed (expected "urn:li:organization:{id}:{accessToken}") — reconnect in API Manager.' }
    }
    const [, organizationUrn, accessToken] = orgUrnMatch

    if (!draft.body) {
      return { ok: false, status: 'failed', error: 'Draft has no body text to publish.' }
    }

    try {
      const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'Linkedin-Version': LINKEDIN_API_VERSION,
        },
        body: JSON.stringify({
          author: organizationUrn,
          commentary: draft.body,
          visibility: 'PUBLIC',
          distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        }),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const message = errBody?.message || `LinkedIn API error ${res.status}`
        return { ok: false, status: 'failed', error: message, rawResponse: errBody }
      }

      // Success returns 201 with no body — the post's URN is in the
      // x-restli-id response header, not JSON.
      const postUrn = res.headers.get('x-restli-id') || undefined
      const externalUrl = postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : undefined

      return { ok: true, status: 'published', externalPostId: postUrn, externalUrl, rawResponse: { status: res.status } }
    } catch (error) {
      return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error) }
    }
  }
}
