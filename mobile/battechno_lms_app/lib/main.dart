import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Avoid blocking the first frame / splash on network font downloads
  // (common hang on emulators and restricted networks).
  GoogleFonts.config.allowRuntimeFetching = false;
  runApp(const ProviderScope(child: BattechnoLmsApp()));
}
