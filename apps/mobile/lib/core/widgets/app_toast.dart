import 'package:fluttertoast/fluttertoast.dart';
import 'package:flutter/material.dart';

/// Small wrapper over Fluttertoast so the whole app shows messages the same way.
class AppToast {
  static void error(String message) => _show(message, const Color(0xFFDC2626));
  static void success(String message) => _show(message, const Color(0xFF16A34A));
  static void info(String message) => _show(message, const Color(0xFF334155));

  static void _show(String message, Color background) {
    Fluttertoast.cancel();
    Fluttertoast.showToast(
      msg: message,
      toastLength: Toast.LENGTH_LONG,
      gravity: ToastGravity.BOTTOM,
      backgroundColor: background,
      textColor: Colors.white,
      fontSize: 14,
    );
  }
}
