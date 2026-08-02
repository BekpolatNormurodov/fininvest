import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'strings.dart';

/// Holds the chosen UI language, persisted across launches. Defaults to Uzbek.
class LocaleCubit extends Cubit<AppLang> {
  LocaleCubit(this._prefs) : super(_read(_prefs));

  final SharedPreferences _prefs;
  static const _key = 'app_lang';

  static AppLang _read(SharedPreferences prefs) =>
      prefs.getString(_key) == 'ru' ? AppLang.ru : AppLang.uz;

  Future<void> set(AppLang lang) async {
    await _prefs.setString(_key, lang.name);
    emit(lang);
  }

  void toggle() => set(state == AppLang.uz ? AppLang.ru : AppLang.uz);
}

/// Sugar for `S.t` bound to the current locale, used from widgets via a BuildContext extension.
extension LocaleReader on AppLang {
  String tr(String key) => S.t(this, key);
}
