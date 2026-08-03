/// Minimal two-language (Uzbek / Russian) string table for the app surfaces. Unknown keys fall back
/// to the key itself, so a missing translation is visible but never crashes.
enum AppLang { uz, ru }

class S {
  const S._();

  static const Map<String, Map<AppLang, String>> _table = {
    'nav.collections': {AppLang.uz: 'Undiruvlar', AppLang.ru: 'Взыскания'},
    'nav.stats': {AppLang.uz: 'Statistika', AppLang.ru: 'Статистика'},
    'nav.map': {AppLang.uz: 'Xarita', AppLang.ru: 'Карта'},
    'nav.notifications': {AppLang.uz: 'Bildirishnoma', AppLang.ru: 'Уведомления'},
    'nav.profile': {AppLang.uz: 'Profil', AppLang.ru: 'Профиль'},

    'collections.tabAll': {AppLang.uz: 'Umumiy (filial)', AppLang.ru: 'Все (филиал)'},
    'collections.tabMine': {AppLang.uz: 'Menga biriktirilgan', AppLang.ru: 'Мои'},
    'collections.empty': {AppLang.uz: 'Undiruv yo‘q', AppLang.ru: 'Нет взысканий'},

    'field.debt': {AppLang.uz: 'Qarzdorlik', AppLang.ru: 'Задолженность'},
    'field.collected': {AppLang.uz: 'Undirilgan', AppLang.ru: 'Взыскано'},
    'field.remaining': {AppLang.uz: 'Qoldiq', AppLang.ru: 'Остаток'},
    'field.penalty': {AppLang.uz: 'Penya', AppLang.ru: 'Пеня'},
    'field.fine': {AppLang.uz: 'Shtraf', AppLang.ru: 'Штраф'},
    'field.months': {AppLang.uz: 'To‘lanmagan oylar', AppLang.ru: 'Неоплаченные месяцы'},
    'field.collector': {AppLang.uz: 'Undiruvchi', AppLang.ru: 'Взыскатель'},
    'field.branch': {AppLang.uz: 'Filial', AppLang.ru: 'Филиал'},
    'field.total': {AppLang.uz: 'Jami', AppLang.ru: 'Итого'},
    'field.comment': {AppLang.uz: 'Izoh', AppLang.ru: 'Комментарий'},
    'field.amount': {AppLang.uz: 'Summa', AppLang.ru: 'Сумма'},

    'stats.title': {AppLang.uz: 'Statistika', AppLang.ru: 'Статистика'},
    'stats.active': {AppLang.uz: 'Faol undiruvlar', AppLang.ru: 'Активные'},
    'stats.byStatus': {AppLang.uz: 'Holat bo‘yicha', AppLang.ru: 'По статусу'},

    'visit.title': {AppLang.uz: 'Tashriflar', AppLang.ru: 'Визиты'},
    'visit.add': {AppLang.uz: 'Tashrif qo‘shish', AppLang.ru: 'Добавить визит'},
    'visit.letter': {AppLang.uz: 'Xat turi', AppLang.ru: 'Тип письма'},
    'visit.location': {AppLang.uz: 'Joylashuv', AppLang.ru: 'Локация'},
    'visit.getLocation': {AppLang.uz: 'Joriy joylashuv', AppLang.ru: 'Текущая локация'},
    'visit.photo': {AppLang.uz: 'Rasm', AppLang.ru: 'Фото'},
    'visit.save': {AppLang.uz: 'Saqlash', AppLang.ru: 'Сохранить'},
    'visit.none': {AppLang.uz: 'Hali tashrif yo‘q', AppLang.ru: 'Визитов пока нет'},
    'visit.map': {AppLang.uz: 'Xarita', AppLang.ru: 'Карта'},

    'notif.empty': {AppLang.uz: 'Bildirishnoma yo‘q', AppLang.ru: 'Нет уведомлений'},
    'notif.readAll': {AppLang.uz: 'Barchasini o‘qildi', AppLang.ru: 'Прочитать все'},

    'profile.language': {AppLang.uz: 'Til', AppLang.ru: 'Язык'},
    'profile.logout': {AppLang.uz: 'Chiqish', AppLang.ru: 'Выход'},
    'profile.phone': {AppLang.uz: 'Telefon', AppLang.ru: 'Телефон'},

    'common.retry': {AppLang.uz: 'Qayta urinish', AppLang.ru: 'Повторить'},
    'common.cancel': {AppLang.uz: 'Bekor', AppLang.ru: 'Отмена'},

    'work.start': {AppLang.uz: 'Ishni boshlash', AppLang.ru: 'Начать смену'},
    'work.end': {AppLang.uz: 'Ishni tugatish', AppLang.ru: 'Завершить'},
    'work.onShift': {AppLang.uz: 'Ishdasiz', AppLang.ru: 'На смене'},
    'work.off': {AppLang.uz: 'Ish boshlanmagan', AppLang.ru: 'Смена не начата'},
  };

  static String t(AppLang lang, String key) => _table[key]?[lang] ?? key;
}
