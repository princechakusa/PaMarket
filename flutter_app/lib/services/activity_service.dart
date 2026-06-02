/// Lightweight in-memory activity store.
///
/// The app has no shared_preferences package, so this keeps recent searches
/// and recently-viewed listing ids in memory for the current session only.
/// Other screens can safely record activity without any external dependency.
class ActivityService {
  ActivityService._();

  static const int _maxSearches = 10;
  static const int _maxViewed = 20;

  /// Most-recent-first list of search queries.
  static final List<String> recentSearches = [];

  /// Most-recent-first list of viewed listing ids.
  static final List<String> recentlyViewedIds = [];

  /// Record a search query. Trims whitespace, ignores empty strings, removes
  /// any existing duplicate, inserts at the front, and caps the list to 10.
  static void addSearch(String q) {
    final query = q.trim();
    if (query.isEmpty) return;
    recentSearches.removeWhere((s) => s == query);
    recentSearches.insert(0, query);
    if (recentSearches.length > _maxSearches) {
      recentSearches.removeRange(_maxSearches, recentSearches.length);
    }
  }

  /// Record a viewed listing id. Removes any existing duplicate, inserts at the
  /// front, and caps the list to 20.
  static void addViewed(String listingId) {
    if (listingId.isEmpty) return;
    recentlyViewedIds.removeWhere((id) => id == listingId);
    recentlyViewedIds.insert(0, listingId);
    if (recentlyViewedIds.length > _maxViewed) {
      recentlyViewedIds.removeRange(_maxViewed, recentlyViewedIds.length);
    }
  }

  /// Clear all recorded searches.
  static void clearSearches() {
    recentSearches.clear();
  }
}
