import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { ContentPublisher } from './types.ts'
import { ManualPublisher } from './manual.ts'
import { FacebookPublisher } from './facebook.ts'
import { InstagramPublisher } from './instagram.ts'
import { LinkedInPublisher } from './linkedin.ts'
import { TikTokPublisher } from './tiktok.ts'
import { XPublisher } from './x.ts'

// Factory, not a static map — real adapters (FacebookPublisher onward)
// need a service-role DB client to read their Vault-stored credentials
// via amos_integrations, so each dispatcher run builds a fresh registry
// bound to its own `db` instance rather than sharing module-level
// singletons across invocations.
export function buildPublisherRegistry(db: SupabaseClient): Record<string, ContentPublisher> {
  return {
    manual: new ManualPublisher(),
    facebook: new FacebookPublisher(db),
    instagram: new InstagramPublisher(),
    linkedin: new LinkedInPublisher(),
    tiktok: new TikTokPublisher(),
    x: new XPublisher(),
  }
}
