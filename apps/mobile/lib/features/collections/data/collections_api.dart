import 'dart:io';

import 'package:dio/dio.dart';

import 'models/collection_detail.dart';
import 'models/collection_list_item.dart';
import 'models/collection_stats.dart';

/// Raw HTTP for the undiruv endpoints. The list is already scoped by the backend to what this
/// collector may see (assigned to them, or in a branch they cover).
class CollectionsApi {
  CollectionsApi(this._dio);

  final Dio _dio;

  Future<List<CollectionListItem>> list() async {
    final response = await _dio.get<List<dynamic>>('/collections');
    return (response.data ?? [])
        .map((e) => CollectionListItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<CollectionDetail> detail(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/collections/$id');
    return CollectionDetail.fromJson(response.data!);
  }

  Future<CollectionStats> stats() async {
    final response = await _dio.get<Map<String, dynamic>>('/collections/stats');
    return CollectionStats.fromJson(response.data!);
  }

  /// Log a field visit (multipart): amount + letter + optional comment/location/photos.
  Future<CollectionDetail> createVisit(
    String collectionId, {
    required double amount,
    required String letterType,
    String? comment,
    double? lat,
    double? lng,
    List<File> photos = const [],
  }) async {
    final form = FormData.fromMap({
      'amount': amount.toString(),
      'letterType': letterType,
      if (comment != null && comment.isNotEmpty) 'comment': comment,
      if (lat != null) 'lat': lat.toString(),
      if (lng != null) 'lng': lng.toString(),
      'media': [
        for (final p in photos)
          await MultipartFile.fromFile(
            p.path,
            filename: p.path.split(Platform.pathSeparator).last,
          ),
      ],
    });
    final response = await _dio.post<Map<String, dynamic>>('/collections/$collectionId/visits', data: form);
    return CollectionDetail.fromJson(response.data!);
  }
}
