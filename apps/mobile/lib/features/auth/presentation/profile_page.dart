import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../../../core/i18n/locale_cubit.dart';
import '../../../core/i18n/strings.dart';
import '../../face/data/face_service.dart';
import '../../face/presentation/face_capture_page.dart';
import 'cubit/auth_cubit.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Chiqish'),
        content: const Text('Hisobdan chiqmoqchimisiz?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Bekor')),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppTheme.danger,
              minimumSize: const Size(0, 44),
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Chiqish'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await context.read<AuthCubit>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthCubit c) => c.state.user);
    final lang = context.watch<LocaleCubit>().state;
    return Scaffold(
      appBar: AppBar(title: Text(lang.tr('nav.profile'))),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: CircleAvatar(
              radius: 44,
              backgroundColor: AppTheme.brand.withValues(alpha: 0.12),
              child: Text(
                user?.initials ?? '?',
                style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: AppTheme.brand),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              user?.fullName ?? '—',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 4),
          Center(
            child: Text(
              'Undiruvchi',
              style: TextStyle(color: Theme.of(context).colorScheme.outline),
            ),
          ),
          const SizedBox(height: 28),
          Card(
            child: Column(
              children: [
                _InfoTile(icon: Iconsax.user, label: 'Login', value: user?.login ?? '—'),
                const Divider(height: 1),
                _InfoTile(icon: Iconsax.call, label: lang.tr('profile.phone'), value: user?.phone ?? '—'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Iconsax.global, size: 20, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(width: 12),
                  Text(lang.tr('profile.language')),
                  const Spacer(),
                  SegmentedButton<AppLang>(
                    segments: const [
                      ButtonSegment(value: AppLang.uz, label: Text("O‘zbek")),
                      ButtonSegment(value: AppLang.ru, label: Text('Русский')),
                    ],
                    selected: {lang},
                    onSelectionChanged: (s) => context.read<LocaleCubit>().set(s.first),
                    showSelectedIcon: false,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _FaceCard(workerId: user?.id ?? ''),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _confirmLogout(context),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.danger,
              side: const BorderSide(color: AppTheme.danger),
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Iconsax.logout, size: 20),
            label: Text(lang.tr('profile.logout')),
          ),
        ],
      ),
    );
  }
}

/// Face check-in enrollment: shows whether a face is enrolled and opens the enroll capture.
class _FaceCard extends StatefulWidget {
  const _FaceCard({required this.workerId});

  final String workerId;

  @override
  State<_FaceCard> createState() => _FaceCardState();
}

class _FaceCardState extends State<_FaceCard> {
  bool? _enrolled;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final e = await sl<FaceService>().isEnrolled();
    if (mounted) setState(() => _enrolled = e);
  }

  Future<void> _enroll() async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => FaceCapturePage(mode: FaceMode.enroll, workerId: widget.workerId)),
    );
    if (ok == true && mounted) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Yuz saqlandi')));
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final enrolled = _enrolled ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Iconsax.scan, size: 22, color: enrolled ? AppTheme.success : Theme.of(context).colorScheme.outline),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Yuz-tasdiq', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text(
                    enrolled ? 'Ro‘yxatdan o‘tgan' : 'Ro‘yxatdan o‘tmagan',
                    style: TextStyle(fontSize: 12, color: enrolled ? AppTheme.success : Theme.of(context).colorScheme.outline),
                  ),
                ],
              ),
            ),
            TextButton(onPressed: _enroll, child: Text(enrolled ? 'Qayta' : 'Ro‘yxatga olish')),
          ],
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, size: 20, color: Theme.of(context).colorScheme.outline),
      title: Text(label, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.outline)),
      subtitle: Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
    );
  }
}
