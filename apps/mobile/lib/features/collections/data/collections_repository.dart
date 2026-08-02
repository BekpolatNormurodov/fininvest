import 'dart:io';

import '../../../core/network/api_exception.dart';
import 'collections_api.dart';
import 'models/collection_detail.dart';
import 'models/collection_list_item.dart';
import 'models/collection_stats.dart';

class CollectionsRepository {
  CollectionsRepository(this._api);

  final CollectionsApi _api;

  Future<List<CollectionListItem>> list() async {
    try {
      return await _api.list();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<CollectionDetail> detail(String id) async {
    try {
      return await _api.detail(id);
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<CollectionStats> stats() async {
    try {
      return await _api.stats();
    } catch (error) {
      throw mapDioError(error);
    }
  }

  Future<CollectionDetail> createVisit(
    String collectionId, {
    required double amount,
    required String letterType,
    String? comment,
    double? lat,
    double? lng,
    List<File> photos = const [],
  }) async {
    try {
      return await _api.createVisit(
        collectionId,
        amount: amount,
        letterType: letterType,
        comment: comment,
        lat: lat,
        lng: lng,
        photos: photos,
      );
    } catch (error) {
      throw mapDioError(error);
    }
  }
}
