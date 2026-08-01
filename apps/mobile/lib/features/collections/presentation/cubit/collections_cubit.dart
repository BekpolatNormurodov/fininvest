import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/collections_repository.dart';
import '../../data/models/collection_list_item.dart';

enum CollectionsStatus { initial, loading, loaded, error }

class CollectionsState extends Equatable {
  const CollectionsState({
    this.status = CollectionsStatus.initial,
    this.items = const [],
    this.error,
  });

  final CollectionsStatus status;
  final List<CollectionListItem> items;
  final String? error;

  /// The collections assigned to [collectorId] — the «Menga biriktirilgan» tab.
  List<CollectionListItem> assignedTo(String collectorId) =>
      items.where((c) => c.collectorId == collectorId).toList();

  CollectionsState copyWith({
    CollectionsStatus? status,
    List<CollectionListItem>? items,
    String? error,
  }) {
    return CollectionsState(
      status: status ?? this.status,
      items: items ?? this.items,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, items, error];
}

class CollectionsCubit extends Cubit<CollectionsState> {
  CollectionsCubit(this._repository) : super(const CollectionsState());

  final CollectionsRepository _repository;

  Future<void> load() async {
    emit(state.copyWith(status: CollectionsStatus.loading, error: null));
    try {
      final items = await _repository.list();
      emit(state.copyWith(status: CollectionsStatus.loaded, items: items));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CollectionsStatus.error, error: e.message));
    } catch (_) {
      emit(state.copyWith(status: CollectionsStatus.error, error: 'Ma’lumotni yuklab bo‘lmadi.'));
    }
  }
}
