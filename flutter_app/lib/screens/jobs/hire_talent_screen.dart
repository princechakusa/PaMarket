import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_modal.dart';
import '../../services/auth_service.dart';

const _kJobCats = [
  'All', 'Accounting & Finance', 'Admin & Office', 'Agriculture',
  'Construction', 'Education & Training', 'Engineering',
  'Healthcare', 'Hospitality & Tourism', 'ICT & Technology',
  'Legal', 'Media & Creative', 'NGO & Social Work',
  'Sales & Marketing', 'Security', 'Transport & Logistics',
];

const _kExpOptions = ['Any', 'Entry Level', '3-5 Years', '5+ Years', '10+ Years'];

const _kCities = [
  'All Cities', 'Harare', 'Bulawayo', 'Mutare', 'Gweru',
  'Masvingo', 'Chinhoyi', 'Kwekwe', 'Kadoma',
];

class HireTalentScreen extends StatefulWidget {
  const HireTalentScreen({super.key});

  @override
  State<HireTalentScreen> createState() => _HireTalentScreenState();
}

class _HireTalentScreenState extends State<HireTalentScreen> {
  final _searchCtrl = TextEditingController();
  List<Map<String, dynamic>> _all = [];
  List<Map<String, dynamic>> _filtered = [];
  bool _loading = true;
  String _sector = 'All';
  String _city = 'All Cities';
  String _exp = 'Any';

  @override
  void initState() {
    super.initState();
    _load();
    _searchCtrl.addListener(_filter);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await Supabase.instance.client
          .from('profiles')
          .select('id,name,avatar,verified,job_title,skills,sector,exp,city,open_to_work,bio')
          .eq('open_to_work', true)
          .limit(200);
      final list = (data as List).cast<Map<String, dynamic>>();
      if (mounted) setState(() { _all = list; _filtered = list; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _filter() {
    final q = _searchCtrl.text.toLowerCase();
    setState(() {
      _filtered = _all.where((p) {
        final name = (p['name'] ?? '').toString().toLowerCase();
        final title = (p['job_title'] ?? '').toString().toLowerCase();
        final skills = (p['skills'] ?? '').toString().toLowerCase();
        final sector = (p['sector'] ?? '').toString();
        final city = (p['city'] ?? '').toString();
        final exp = (p['exp'] ?? '').toString();
        final matchQ = q.isEmpty || name.contains(q) || title.contains(q) || skills.contains(q);
        final matchSector = _sector == 'All' || sector == _sector;
        final matchCity = _city == 'All Cities' || city == _city;
        final matchExp = _exp == 'Any' || exp == _exp;
        return matchQ && matchSector && matchCity && matchExp;
      }).toList();
    });
  }

  void _setSector(String s) {
    setState(() => _sector = s);
    _filter();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // ── Blue topbar + search ──────────────────────────────────────────
          Container(
            color: AppColors.primaryBlue,
            child: SafeArea(
              bottom: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 8, 16, 0),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
                          onPressed: () => context.pop(),
                        ),
                        const Expanded(
                          child: Text('Hire Talent',
                              style: TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white)),
                        ),
                        if (AuthService.isSignedIn)
                          TextButton(
                            onPressed: () => context.push('/post-listing'),
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.white.withValues(alpha: 0.15),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              textStyle: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700),
                            ),
                            child: const Text('+ Post Job'),
                          ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.13),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: TextField(
                        controller: _searchCtrl,
                        style: const TextStyle(fontFamily: 'Inter', color: Colors.white, fontSize: 14),
                        decoration: const InputDecoration(
                          hintText: 'Search by name, skill, title…',
                          hintStyle: TextStyle(color: Colors.white54, fontFamily: 'Inter', fontSize: 14),
                          prefixIcon: Icon(Icons.search, color: Colors.white54, size: 20),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 13),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                    child: Text(
                      '${_filtered.length} candidate${_filtered.length != 1 ? 's' : ''}',
                      style: const TextStyle(fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white60),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Sector chips ────────────────────────────────────────────────
          Container(
            color: AppColors.card,
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: _kJobCats.map((s) {
                  final sel = s == _sector;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => _setSector(s),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                        decoration: BoxDecoration(
                          color: sel ? AppColors.primaryBlue : AppColors.background,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: sel ? AppColors.primaryBlue : AppColors.border, width: 1.5),
                        ),
                        child: Text(s,
                            style: TextStyle(
                              fontFamily: 'Inter', fontSize: 12, fontWeight: FontWeight.w700,
                              color: sel ? Colors.white : AppColors.textPrimary,
                            )),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // ── City + Experience filters ────────────────────────────────────
          Container(
            color: AppColors.card,
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
            child: Row(
              children: [
                _DropFilter(
                  label: 'City',
                  value: _city,
                  items: _kCities,
                  onChanged: (v) { setState(() => _city = v); _filter(); },
                ),
                const SizedBox(width: 10),
                _DropFilter(
                  label: 'Experience',
                  value: _exp,
                  items: _kExpOptions,
                  onChanged: (v) { setState(() => _exp = v); _filter(); },
                ),
              ],
            ),
          ),

          const Divider(height: 1, color: AppColors.border),

          // ── Candidate list ───────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _filtered.isEmpty
                    ? _EmptyTalent(onPost: () {
                        if (!AuthService.isSignedIn) {
                          showAuthModal(context, 'Sign in to post a job');
                        } else {
                          context.push('/post-listing');
                        }
                      })
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 80),
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _CandidateCard(profile: _filtered[i]),
                      ),
          ),
        ],
      ),
    );
  }
}

// ── Candidate card ─────────────────────────────────────────────────────────────

class _CandidateCard extends StatelessWidget {
  final Map<String, dynamic> profile;
  const _CandidateCard({required this.profile});

  @override
  Widget build(BuildContext context) {
    final name = profile['name'] ?? 'User';
    final title = profile['job_title'] as String?;
    final city = profile['city'] as String?;
    final sector = profile['sector'] as String?;
    final exp = profile['exp'] as String?;
    final skills = (profile['skills'] as String? ?? '');
    final avatar = profile['avatar'] as String?;
    final verified = profile['verified'] == true;

    final skillList = skills.isNotEmpty
        ? skills.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).take(4).toList()
        : <String>[];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: AppColors.lightBlue,
            backgroundImage: avatar != null ? CachedNetworkImageProvider(avatar) : null,
            child: avatar == null
                ? Text(name.isNotEmpty ? name[0].toUpperCase() : 'U',
                    style: const TextStyle(fontFamily: 'Inter', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primaryBlue))
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(name,
                          style: const TextStyle(fontFamily: 'Inter', fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                          overflow: TextOverflow.ellipsis),
                    ),
                    if (verified)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFF22C55E), borderRadius: BorderRadius.circular(20)),
                        child: const Text('Verified', style: TextStyle(fontFamily: 'Inter', fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                  ],
                ),
                if (title != null && title.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(title, style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.primaryBlue, fontWeight: FontWeight.w600)),
                ],
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (city != null && city.isNotEmpty) ...[
                      const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 2),
                      Text(city, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
                      const SizedBox(width: 8),
                    ],
                    if (exp != null && exp.isNotEmpty) ...[
                      const Icon(Icons.work_outline, size: 12, color: AppColors.textMuted),
                      const SizedBox(width: 2),
                      Text(exp, style: const TextStyle(fontFamily: 'Inter', fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ],
                ),
                if (sector != null && sector.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.lightBlue,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(sector, style: const TextStyle(fontFamily: 'Inter', fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primaryBlue)),
                  ),
                ],
                if (skillList.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: skillList.map((s) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(s, style: const TextStyle(fontFamily: 'Inter', fontSize: 11, color: AppColors.textSecondary)),
                    )).toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Empty state ─────────────────────────────────────────────────────────────────

class _EmptyTalent extends StatelessWidget {
  final VoidCallback onPost;
  const _EmptyTalent({required this.onPost});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72, height: 72,
              decoration: BoxDecoration(color: AppColors.lightBlue, borderRadius: BorderRadius.circular(20)),
              child: const Icon(Icons.people_outline, size: 36, color: AppColors.primaryBlue),
            ),
            const SizedBox(height: 16),
            const Text('No candidates yet', style: TextStyle(fontFamily: 'Inter', fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            const SizedBox(height: 8),
            const Text('Candidates who are open to work will appear here.', style: TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textSecondary), textAlign: TextAlign.center),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: onPost,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Post a Job'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBlue,
                foregroundColor: Colors.white,
                textStyle: const TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Dropdown filter ────────────────────────────────────────────────────────────

class _DropFilter extends StatelessWidget {
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String> onChanged;
  const _DropFilter({required this.label, required this.value, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(fontFamily: 'Inter', fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.textMuted, letterSpacing: 0.5)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.background,
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(9),
          ),
          child: DropdownButton<String>(
            value: value,
            isDense: true,
            underline: const SizedBox(),
            style: const TextStyle(fontFamily: 'Inter', fontSize: 13, color: AppColors.textPrimary),
            items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
            onChanged: (v) { if (v != null) onChanged(v); },
          ),
        ),
      ],
    );
  }
}
