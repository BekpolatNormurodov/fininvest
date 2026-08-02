import 'dart:io';

import 'package:dio/dio.dart';

class ChatAttachment {
  const ChatAttachment({required this.id, required this.fileName});
  final String id;
  final String fileName;

  factory ChatAttachment.fromJson(Map<String, dynamic> j) =>
      ChatAttachment(id: j['id'] as String, fileName: j['fileName'] as String? ?? 'fayl');
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderName,
    required this.senderRole,
    required this.text,
    required this.mine,
    required this.createdAt,
    required this.attachments,
  });

  final String id;
  final String senderName;
  final String senderRole;
  final String? text;
  final bool mine;
  final String createdAt;
  final List<ChatAttachment> attachments;

  factory ChatMessage.fromJson(Map<String, dynamic> j) {
    final docs = (j['documents'] as List<dynamic>? ?? []);
    return ChatMessage(
      id: j['id'] as String,
      senderName: j['senderName'] as String? ?? '',
      senderRole: j['senderRole'] as String? ?? '',
      text: j['text'] as String?,
      mine: j['mine'] as bool? ?? false,
      createdAt: j['createdAt'] as String? ?? '',
      attachments: docs.map((d) => ChatAttachment.fromJson(d as Map<String, dynamic>)).toList(),
    );
  }
}

/// Reuses the existing `/cases/:id/messages` (per-application) and `/messages/general` (broadcast)
/// endpoints — the same threads the web office sees.
class ChatApi {
  ChatApi(this._dio);

  final Dio _dio;

  Future<List<ChatMessage>> caseMessages(String caseId) => _list('/cases/$caseId/messages');
  Future<List<ChatMessage>> general() => _list('/messages/general');

  Future<void> sendCase(String caseId, {String? text, List<File> files = const []}) =>
      _send('/cases/$caseId/messages', text: text, files: files);
  Future<void> sendGeneral({String? text, List<File> files = const []}) =>
      _send('/messages/general', text: text, files: files);

  Future<List<ChatMessage>> _list(String path) async {
    final r = await _dio.get<List<dynamic>>(path);
    return (r.data ?? []).map((e) => ChatMessage.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> _send(String path, {String? text, List<File> files = const []}) async {
    final form = FormData.fromMap({
      if (text != null && text.isNotEmpty) 'text': text,
      'files': [
        for (final f in files) await MultipartFile.fromFile(f.path, filename: f.path.split(Platform.pathSeparator).last),
      ],
    });
    await _dio.post(path, data: form);
  }
}
