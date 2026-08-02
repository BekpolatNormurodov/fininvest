import 'package:flutter/material.dart';

import '../config/server_config.dart';
import '../di/injector.dart';

/// Lets the user point the app at a different backend (e.g. the office LAN IP) without a rebuild.
Future<void> showServerDialog(BuildContext context) async {
  final config = sl<ServerConfig>();
  final controller = TextEditingController(text: config.baseUrl);

  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: const Text('Server manzili'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Backend API manzili (masalan http://192.168.1.10:3000/api).',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(hintText: 'http://…:3000/api'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await config.reset();
              applyServerBaseUrl(config.baseUrl);
              if (dialogContext.mounted) Navigator.pop(dialogContext);
            },
            child: const Text('Standart'),
          ),
          FilledButton(
            onPressed: () async {
              final url = controller.text.trim();
              if (url.isNotEmpty) {
                await config.setBaseUrl(url);
                applyServerBaseUrl(url);
              }
              if (dialogContext.mounted) Navigator.pop(dialogContext);
            },
            child: const Text('Saqlash'),
          ),
        ],
      );
    },
  );
}
