import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../app/theme/bat_colors.dart';

/// Field-training atmosphere: trail paths, boots/hiker marks, and camp flags —
/// clearly training-themed and distinct from the home academic watermark.
class TrainingPageBackground extends StatelessWidget {
  const TrainingPageBackground({super.key});

  @override
  Widget build(BuildContext context) {
    return const IgnorePointer(
      child: CustomPaint(
        painter: _TrainingPageBackgroundPainter(),
        child: SizedBox.expand(),
      ),
    );
  }
}

class _TrainingPageBackgroundPainter extends CustomPainter {
  const _TrainingPageBackgroundPainter();

  static const double _tile = 140;

  @override
  void paint(Canvas canvas, Size size) {
    _paintWashes(canvas, size);
    _paintDashedTrails(canvas, size);
    _paintTrainingTiles(canvas, size);
  }

  void _paintWashes(Canvas canvas, Size size) {
    final gold = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.9, size.height * 0.08),
        size.shortestSide * 0.5,
        [
          BatColors.accent.withValues(alpha: 0.08),
          BatColors.accent.withValues(alpha: 0),
        ],
      );
    canvas.drawRect(Offset.zero & size, gold);

    final navy = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.1, size.height * 0.7),
        size.shortestSide * 0.7,
        [
          BatColors.primary.withValues(alpha: 0.05),
          BatColors.primary.withValues(alpha: 0),
        ],
      );
    canvas.drawRect(Offset.zero & size, navy);
  }

  /// Soft winding field paths across the page.
  void _paintDashedTrails(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.04)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;

    void dashedPath(Path path) {
      for (final metric in path.computeMetrics()) {
        var distance = 0.0;
        const dash = 8.0;
        const gap = 10.0;
        while (distance < metric.length) {
          final next = (distance + dash).clamp(0.0, metric.length);
          canvas.drawPath(metric.extractPath(distance, next), paint);
          distance = next + gap;
        }
      }
    }

    final pathA = Path()
      ..moveTo(-20, size.height * 0.22)
      ..cubicTo(
        size.width * 0.25,
        size.height * 0.05,
        size.width * 0.55,
        size.height * 0.4,
        size.width + 20,
        size.height * 0.28,
      );
    dashedPath(pathA);

    final pathB = Path()
      ..moveTo(-20, size.height * 0.72)
      ..cubicTo(
        size.width * 0.3,
        size.height * 0.9,
        size.width * 0.65,
        size.height * 0.55,
        size.width + 20,
        size.height * 0.78,
      );
    dashedPath(pathB);
  }

  void _paintTrainingTiles(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.055)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fill = Paint()
      ..color = BatColors.primary.withValues(alpha: 0.04)
      ..style = PaintingStyle.fill;

    final cols = (size.width / _tile).ceil() + 1;
    final rows = (size.height / _tile).ceil() + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        canvas.save();
        canvas.translate(col * _tile, row * _tile);
        switch ((row + col * 2) % 4) {
          case 0:
            _drawHiker(canvas, stroke);
          case 1:
            _drawBackpack(canvas, stroke, fill);
          case 2:
            _drawFlag(canvas, stroke, fill);
          default:
            _drawCompass(canvas, stroke, fill);
        }
        canvas.restore();
      }
    }
  }

  /// Simple stick-figure hiker with staff.
  void _drawHiker(Canvas canvas, Paint stroke) {
    canvas.drawCircle(const Offset(70, 38), 7, stroke);
    canvas.drawLine(const Offset(70, 45), const Offset(70, 72), stroke);
    canvas.drawLine(const Offset(70, 52), const Offset(54, 62), stroke);
    canvas.drawLine(const Offset(70, 52), const Offset(86, 48), stroke);
    canvas.drawLine(const Offset(70, 72), const Offset(58, 92), stroke);
    canvas.drawLine(const Offset(70, 72), const Offset(84, 92), stroke);
    // Walking staff
    canvas.drawLine(const Offset(86, 40), const Offset(92, 96), stroke);
  }

  /// Field backpack.
  void _drawBackpack(Canvas canvas, Paint stroke, Paint fill) {
    final body = RRect.fromRectAndRadius(
      const Rect.fromLTWH(52, 40, 36, 44),
      const Radius.circular(8),
    );
    canvas.drawRRect(body, stroke);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(58, 32, 24, 12),
        const Radius.circular(4),
      ),
      fill,
    );
    canvas.drawLine(const Offset(70, 48), const Offset(70, 76), stroke);
    canvas.drawLine(const Offset(52, 56), const Offset(44, 72), stroke);
    canvas.drawLine(const Offset(88, 56), const Offset(96, 72), stroke);
  }

  /// Checkpoint / route flag.
  void _drawFlag(Canvas canvas, Paint stroke, Paint fill) {
    canvas.drawLine(const Offset(58, 30), const Offset(58, 98), stroke);
    final flag = Path()
      ..moveTo(58, 30)
      ..lineTo(92, 42)
      ..lineTo(58, 54)
      ..close();
    canvas.drawPath(flag, fill);
    canvas.drawPath(flag, stroke);
    canvas.drawCircle(const Offset(58, 98), 3, fill);
  }

  /// Compass rose for field navigation.
  void _drawCompass(Canvas canvas, Paint stroke, Paint fill) {
    canvas.drawCircle(const Offset(70, 64), 22, stroke);
    canvas.drawCircle(const Offset(70, 64), 4, fill);
    // N needle
    final needle = Path()
      ..moveTo(70, 46)
      ..lineTo(76, 64)
      ..lineTo(70, 82)
      ..lineTo(64, 64)
      ..close();
    canvas.drawPath(needle, stroke);
    canvas.drawLine(const Offset(70, 40), const Offset(70, 46), stroke);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
