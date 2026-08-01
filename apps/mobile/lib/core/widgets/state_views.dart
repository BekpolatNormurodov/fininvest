import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';

/// Centered spinner for pending states.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

/// Full-screen error with a retry affordance.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Iconsax.warning_2, size: 44, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Iconsax.refresh, size: 18),
                label: const Text('Qayta urinish'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Empty-list placeholder.
class EmptyView extends StatelessWidget {
  const EmptyView({super.key, required this.message, this.icon = Iconsax.document});

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 44, color: Theme.of(context).colorScheme.outline),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(color: Theme.of(context).colorScheme.outline)),
        ],
      ),
    );
  }
}
