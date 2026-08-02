import 'dart:io';

import '../../../core/network/api_exception.dart';
import 'chat_api.dart';

/// A chat channel: either one application's thread, or the general broadcast.
class ChatChannel {
  const ChatChannel.forCase(this.caseId, this.title) : isGeneral = false;
  const ChatChannel.general(this.title) : caseId = null, isGeneral = true;

  final String? caseId;
  final String title;
  final bool isGeneral;
}

class ChatRepository {
  ChatRepository(this._api);

  final ChatApi _api;

  Future<List<ChatMessage>> messages(ChatChannel c) async {
    try {
      return c.isGeneral ? await _api.general() : await _api.caseMessages(c.caseId!);
    } catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> send(ChatChannel c, {String? text, List<File> files = const []}) async {
    try {
      if (c.isGeneral) {
        await _api.sendGeneral(text: text, files: files);
      } else {
        await _api.sendCase(c.caseId!, text: text, files: files);
      }
    } catch (e) {
      throw mapDioError(e);
    }
  }
}
