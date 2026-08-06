import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../app/theme/bat_colors.dart';

/// Landing-hero academic watermark + soft radial washes.
/// Mirrors `frontend/src/landing-backgrounds.css` (`.landing-academic-pattern`
/// and hero radial blobs) for mobile home screens.
class HomeHeroBackground extends StatelessWidget {
  const HomeHeroBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: CustomPaint(
        painter: _HomeHeroBackgroundPainter(),
        child: SizedBox.expand(),
      ),
    );
  }
}

class _HomeHeroBackgroundPainter extends CustomPainter {
  const _HomeHeroBackgroundPainter();

  static const double _tile = 120;

  @override
  void paint(Canvas canvas, Size size) {
    _paintRadialWashes(canvas, size);
    _paintGrid(canvas, size);
    _paintAcademicTiles(canvas, size);
  }

  void _paintRadialWashes(Canvas canvas, Size size) {
    final navy = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.12, size.height * 0.18),
        size.shortestSide * 0.55,
        [
          BatColors.primary.withValues(alpha: 0.035),
          BatColors.primary.withValues(alpha: 0),
        ],
      );
    canvas.drawRect(Offset.zero & size, navy);

    final gold = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.88, size.height * 0.32),
        size.shortestSide * 0.5,
        [
          BatColors.accent.withValues(alpha: 0.06),
          BatColors.accent.withValues(alpha: 0),
        ],
      );
    canvas.drawRect(Offset.zero & size, gold);

    final amber = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.72, size.height * 0.72),
        size.shortestSide * 0.4,
        [
          BatColors.accentHover.withValues(alpha: 0.04),
          BatColors.accentHover.withValues(alpha: 0),
        ],
      );
    canvas.drawRect(Offset.zero & size, amber);
  }

  void _paintGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.015)
      ..strokeWidth = 1;
    const step = 48.0;
    for (var x = 0.0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (var y = 0.0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  void _paintAcademicTiles(Canvas canvas, Size size) {
    // Web effective ≈ fill-opacity 0.045 × layer 0.35 ≈ 0.016.
    final fill = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.016)
      ..style = PaintingStyle.fill;
    final stroke = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.016)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    final cols = (size.width / _tile).ceil() + 1;
    final rows = (size.height / _tile).ceil() + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        canvas.save();
        canvas.translate(col * _tile, row * _tile);
        _drawTileIcons(canvas, fill, stroke);
        canvas.restore();
      }
    }
  }

  /// Icons from the 120×120 SVG tile in `.landing-academic-pattern`.
  void _drawTileIcons(Canvas canvas, Paint fill, Paint stroke) {
    // Shield / crest
    final shield = Path()
      ..moveTo(60, 18)
      ..relativeLineTo(14, 5)
      ..relativeLineTo(0, 18)
      ..relativeCubicTo(0, 12, -6, 22, -14, 26)
      ..relativeCubicTo(-8, -4, -14, -14, -14, -26)
      ..lineTo(46, 23)
      ..close();
    canvas.drawPath(shield, fill);

    // Book / card
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(22, 58, 20, 16),
        const Radius.circular(3),
      ),
      fill,
    );

    // Circle seal
    canvas.drawCircle(const Offset(88, 66), 9, fill);

    // Plus marks (stroke — SVG fill lines have no area)
    canvas.drawLine(const Offset(18, 92), const Offset(42, 92), stroke);
    canvas.drawLine(const Offset(30, 84), const Offset(30, 100), stroke);
    canvas.drawLine(const Offset(78, 88), const Offset(102, 88), stroke);
    canvas.drawLine(const Offset(90, 80), const Offset(90, 96), stroke);

    // Pillar / spine
    canvas.drawRect(const Rect.fromLTWH(54, 78, 12, 20), fill);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
