import 'package:dio/dio.dart';

import 'models/collection_detail.dart';
import 'models/collection_list_item.dart';

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
}
