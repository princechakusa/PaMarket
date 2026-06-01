class SupabaseConfig {
  static const String url = 'https://gxgytumhknmnwspxjzxw.supabase.co';
  static const String anonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z3l0dW1oa25tbndz'
      'cHhqenh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzMwNDUsImV4cCI6MjA5MzY0OTA0NX0'
      '.ddJhWdUy7JVrSfdaSK8a0On3zuwssY2H4DWsxBhgbJs';

  // Storage
  static const String listingsBucket = 'listings';
  static const String avatarsBucket = 'avatars';
  static const String verificationBucket = 'verification';
  static const String chatBucket = 'chat-images';

  // Zimbabwe provinces
  static const List<String> provinces = [
    'Bulawayo',
    'Harare',
    'Manicaland',
    'Mashonaland Central',
    'Mashonaland East',
    'Mashonaland West',
    'Masvingo',
    'Matabeleland North',
    'Matabeleland South',
    'Midlands',
  ];

  // Categories
  static const List<Map<String, String>> categories = [
    {'id': 'buy-sell', 'label': 'Buy & Sell', 'icon': 'shopping_bag'},
    {'id': 'jobs', 'label': 'Jobs', 'icon': 'work'},
    {'id': 'rentals', 'label': 'Rentals', 'icon': 'home'},
    {'id': 'cars', 'label': 'Cars', 'icon': 'directions_car'},
    {'id': 'services', 'label': 'Services', 'icon': 'build'},
    {'id': 'agriculture', 'label': 'Agriculture', 'icon': 'agriculture'},
  ];
}
