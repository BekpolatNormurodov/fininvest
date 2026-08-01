import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:iconsax/iconsax.dart';

import '../../../app/theme.dart';
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
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
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
                _InfoTile(icon: Iconsax.call, label: 'Telefon', value: user?.phone ?? '—'),
              ],
            ),
          ),
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
            label: const Text('Chiqish'),
          ),
        ],
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
