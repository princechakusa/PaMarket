class Profile {
  final String id;
  final String name;
  final String? phone;
  final String? avatar;
  final bool verified;
  final double walletUsd;
  final String language;
  final String? email;
  final String? bio;
  final String? city;
  final String? jobTitle;
  final String? skills;
  final String? sector;
  final String? exp;
  final bool openToWork;
  final bool verificationPending;
  final String role;
  final String status;
  final String? banReason;
  final DateTime? banUntil;
  final DateTime createdAt;

  const Profile({
    required this.id,
    required this.name,
    this.phone,
    this.avatar,
    required this.verified,
    required this.walletUsd,
    required this.language,
    this.email,
    this.bio,
    this.city,
    this.jobTitle,
    this.skills,
    this.sector,
    this.exp,
    required this.openToWork,
    required this.verificationPending,
    required this.role,
    required this.status,
    this.banReason,
    this.banUntil,
    required this.createdAt,
  });

  bool get isAdmin => role == 'admin';
  bool get isModerator => role == 'moderator' || role == 'admin';
  bool get isBanned => status == 'banned';

  factory Profile.fromMap(Map<String, dynamic> map) => Profile(
        id: map['id'] as String,
        name: map['name'] as String? ?? 'User',
        phone: map['phone'] as String?,
        avatar: map['avatar'] as String?,
        verified: map['verified'] as bool? ?? false,
        walletUsd: (map['wallet_usd'] as num?)?.toDouble() ?? 0,
        language: map['language'] as String? ?? 'English',
        email: map['email'] as String?,
        bio: map['bio'] as String?,
        city: map['city'] as String?,
        jobTitle: map['job_title'] as String?,
        skills: map['skills'] as String?,
        sector: map['sector'] as String?,
        exp: map['exp'] as String?,
        openToWork: map['open_to_work'] as bool? ?? false,
        verificationPending: map['verification_pending'] as bool? ?? false,
        role: map['role'] as String? ?? 'user',
        status: map['status'] as String? ?? 'active',
        banReason: map['ban_reason'] as String?,
        banUntil: map['ban_until'] != null
            ? DateTime.parse(map['ban_until'] as String)
            : null,
        createdAt: DateTime.parse(
            map['created_at'] as String? ?? DateTime.now().toIso8601String()),
      );

  Map<String, dynamic> toMap() => {
        'name': name,
        'phone': phone,
        'avatar': avatar,
        'bio': bio,
        'city': city,
        'job_title': jobTitle,
        'skills': skills,
        'sector': sector,
        'exp': exp,
        'open_to_work': openToWork,
        'language': language,
      };
}
