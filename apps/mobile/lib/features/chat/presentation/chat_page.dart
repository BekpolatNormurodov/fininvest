import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import 'package:image_picker/image_picker.dart';

import '../../../app/theme.dart';
import '../../../core/di/injector.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/widgets/state_views.dart';
import '../data/chat_api.dart';
import '../data/chat_repository.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key, required this.channel});

  final ChatChannel channel;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _repo = sl<ChatRepository>();
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage> _messages = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 10), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final list = await _repo.messages(widget.channel);
      if (!mounted) return;
      setState(() { _messages = list; _loading = false; _error = null; });
      _toBottom();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; if (!silent) _error = e.message; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  Future<void> _send({File? file}) async {
    final text = _controller.text.trim();
    if (text.isEmpty && file == null) return;
    setState(() => _sending = true);
    try {
      await _repo.send(widget.channel, text: text, files: file != null ? [file] : const []);
      _controller.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _attach() async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 70, maxWidth: 1600);
    if (x != null) await _send(file: File(x.path));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.channel.title)),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                    ? ErrorView(message: _error!, onRetry: _load)
                    : _messages.isEmpty
                        ? const EmptyView(message: 'Xabar yo‘q', icon: Iconsax.messages_2)
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              controller: _scroll,
                              padding: const EdgeInsets.all(12),
                              itemCount: _messages.length,
                              itemBuilder: (context, i) => _Bubble(message: _messages[i]),
                            ),
                          ),
          ),
          _InputBar(controller: _controller, sending: _sending, onSend: () => _send(), onAttach: _attach),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;
    final scheme = Theme.of(context).colorScheme;
    final bg = mine ? AppTheme.brand : scheme.surfaceContainerHighest;
    final fg = mine ? Colors.white : scheme.onSurface;
    final time = () {
      final d = DateTime.tryParse(message.createdAt)?.toLocal();
      if (d == null) return '';
      String two(int n) => n.toString().padLeft(2, '0');
      return '${two(d.hour)}:${two(d.minute)}';
    }();

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(mine ? 14 : 4),
            bottomRight: Radius.circular(mine ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!mine)
              Text(message.senderName, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: mine ? Colors.white70 : AppTheme.brand)),
            if (message.text != null && message.text!.isNotEmpty)
              Text(message.text!, style: TextStyle(color: fg)),
            for (final a in message.attachments)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Iconsax.document, size: 14, color: fg.withValues(alpha: 0.8)),
                    const SizedBox(width: 4),
                    Flexible(child: Text(a.fileName, style: TextStyle(fontSize: 12, color: fg.withValues(alpha: 0.9)), overflow: TextOverflow.ellipsis)),
                  ],
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(time, style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.7))),
            ),
          ],
        ),
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({required this.controller, required this.sending, required this.onSend, required this.onAttach});

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
        child: Row(
          children: [
            IconButton(onPressed: sending ? null : onAttach, icon: const Icon(Iconsax.gallery_add)),
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => onSend(),
                decoration: const InputDecoration(hintText: 'Xabar yozing…'),
              ),
            ),
            const SizedBox(width: 4),
            FilledButton(
              onPressed: sending ? null : onSend,
              style: FilledButton.styleFrom(shape: const CircleBorder(), minimumSize: const Size(48, 48), padding: EdgeInsets.zero),
              child: sending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Iconsax.send_1, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}
