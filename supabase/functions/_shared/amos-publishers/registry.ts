import type { ContentPublisher } from './types.ts'
import { ManualPublisher } from './manual.ts'
import { FacebookPublisher } from './facebook.ts'
import { InstagramPublisher } from './instagram.ts'
import { LinkedInPublisher } from './linkedin.ts'
import { TikTokPublisher } from './tiktok.ts'
import { XPublisher } from './x.ts'

// Keyed by the REAL target platform (amos_schedule.platform), not by
// publish method. The dispatcher in Module 3 always uses PUBLISHERS.manual
// regardless of what this map would otherwise resolve to — see
// amos-publish-dispatcher/index.ts's comment on that decision. This
// registry exists now so a future module's change is exactly "implement
// FacebookPublisher.publish() for real" plus "resolve PUBLISHERS[platform]
// instead of hardcoding 'manual'" — two small, isolated edits, not a
// redesign.
export const PUBLISHERS: Record<string, ContentPublisher> = {
  manual: new ManualPublisher(),
  facebook: new FacebookPublisher(),
  instagram: new InstagramPublisher(),
  linkedin: new LinkedInPublisher(),
  tiktok: new TikTokPublisher(),
  x: new XPublisher(),
}
