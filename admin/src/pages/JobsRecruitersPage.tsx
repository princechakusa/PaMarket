// Batch 1: Jobs is a Marketplace category workspace, not a separate query
// architecture — this reuses ListingsModerationPage's own component/service
// entirely, pinned to category "jobs" (which also surfaces an Applications
// panel in the detail view for that category).
import { ListingsModerationPage } from './ListingsModerationPage';

export function JobsRecruitersPage() {
  return <ListingsModerationPage fixedCategory="jobs" />;
}
