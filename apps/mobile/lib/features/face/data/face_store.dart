import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/face_template.dart';

/// Encrypted local store for the enrolled [FaceTemplate] (platform keystore/keychain).
class FaceStore {
  FaceStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _key = 'face_template_v1';

  Future<FaceTemplate?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final decoded = json.decode(raw);
      if (decoded is Map<String, dynamic>) return FaceTemplate.fromJson(decoded);
    } catch (_) {
      /* corrupt/legacy — treat as not enrolled */
    }
    return null;
  }

  Future<void> write(FaceTemplate template) => _storage.write(key: _key, value: json.encode(template.toJson()));

  Future<bool> hasTemplate() async => (await read()) != null;

  Future<void> clear() => _storage.delete(key: _key);
}
