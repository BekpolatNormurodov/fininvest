import '../../../core/network/api_exception.dart';
import 'collections_api.dart';
import 'models/collection_detail.dart';
import 'models/collection_list_item.dart';

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
}
