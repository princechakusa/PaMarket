import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const _cats = [
  {'id': 'all', 'label': 'All', 'icon': Icons.apps},
  {'id': 'buy-sell', 'label': 'Buy & Sell', 'icon': Icons.shopping_bag_outlined},
  {'id': 'jobs', 'label': 'Jobs', 'icon': Icons.work_outline},
  {'id': 'rentals', 'label': 'Rentals', 'icon': Icons.home_outlined},
  {'id': 'cars', 'label': 'Cars', 'icon': Icons.directions_car_outlined},
  {'id': 'services', 'label': 'Services', 'icon': Icons.build_outlined},
  {'id': 'agriculture', 'label': 'Agriculture', 'icon': Icons.grass_outlined},
];

class CategoryBar extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const CategoryBar({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final cat = _cats[i];
          final id = cat['id'] as String;
          final label = cat['label'] as String;
          final icon = cat['icon'] as IconData;
          final isSelected = selected == id;

          return GestureDetector(
            onTap: () => onChanged(id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primaryBlue : AppColors.card,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color:
                      isSelected ? AppColors.primaryBlue : AppColors.border,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    icon,
                    size: 14,
                    color: isSelected ? Colors.white : AppColors.textSecondary,
                  ),
                  const SizedBox(width: 5),
                  Text(
                    label,
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color:
                          isSelected ? Colors.white : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
