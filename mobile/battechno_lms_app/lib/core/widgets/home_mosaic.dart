import 'package:flutter/material.dart';

import '../../app/theme/bat_colors.dart';
import 'home_hero_background.dart';

/// Visual tone for mosaic home tiles — Battechno navy/gold system only.
enum HomeMosaicTone { primary, secondary, accent, soft, cream, danger }

/// Relative tile height in the staggered home grid.
enum HomeMosaicSize { short, medium, tall }

class HomeMosaicTileData {
  const HomeMosaicTileData({
    required this.label,
    required this.icon,
    required this.onTap,
    this.tone = HomeMosaicTone.soft,
    this.size = HomeMosaicSize.medium,
    this.subtitle,
    this.enabled = true,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final HomeMosaicTone tone;
  final HomeMosaicSize size;
  final String? subtitle;
  final bool enabled;
}

class _ToneStyle {
  const _ToneStyle({
    required this.background,
    required this.foreground,
    required this.iconWell,
    required this.iconColor,
  });

  final Color background;
  final Color foreground;
  final Color iconWell;
  final Color iconColor;
}

_ToneStyle _styleFor(HomeMosaicTone tone) {
  switch (tone) {
    case HomeMosaicTone.primary:
      return const _ToneStyle(
        background: BatColors.primary,
        foreground: Colors.white,
        iconWell: Color(0x33FFFFFF),
        iconColor: Colors.white,
      );
    case HomeMosaicTone.secondary:
      return const _ToneStyle(
        background: BatColors.secondary,
        foreground: Colors.white,
        iconWell: Color(0x33FFFFFF),
        iconColor: BatColors.accent,
      );
    case HomeMosaicTone.accent:
      return const _ToneStyle(
        background: BatColors.accent,
        foreground: BatColors.secondary,
        iconWell: Color(0x33132D4A),
        iconColor: BatColors.primary,
      );
    case HomeMosaicTone.soft:
      return const _ToneStyle(
        background: BatColors.primarySoft,
        foreground: BatColors.primary,
        iconWell: Colors.white,
        iconColor: BatColors.primary,
      );
    case HomeMosaicTone.cream:
      return const _ToneStyle(
        background: BatColors.cream,
        foreground: BatColors.heading,
        iconWell: Colors.white,
        iconColor: BatColors.accentHover,
      );
    case HomeMosaicTone.danger:
      return const _ToneStyle(
        background: BatColors.danger,
        foreground: Colors.white,
        iconWell: Color(0x33FFFFFF),
        iconColor: Colors.white,
      );
  }
}

double _heightFor(HomeMosaicSize size) {
  switch (size) {
    case HomeMosaicSize.short:
      return 96;
    case HomeMosaicSize.medium:
      return 128;
    case HomeMosaicSize.tall:
      return 168;
  }
}

/// Minimal home header matching the welcome layout:
/// [Avatar → profile] · greeting + name · [Notifications].
class HomeMosaicHeader extends StatelessWidget {
  const HomeMosaicHeader({
    super.key,
    required this.greeting,
    required this.fullName,
    this.subtitle,
    this.onProfileTap,
    this.profileActionLabel,
    this.onNotificationsTap,
    this.unreadCount = 0,
    this.notificationsTooltip,
  });

  final String greeting;
  final String fullName;
  final String? subtitle;
  final VoidCallback? onProfileTap;

  /// Kept for call-site compatibility; profile opens via the avatar.
  final String? profileActionLabel;
  final VoidCallback? onNotificationsTap;
  final int unreadCount;
  final String? notificationsTooltip;

  @override
  Widget build(BuildContext context) {
    final initial = fullName.trim().isNotEmpty
        ? fullName.trim().characters.first.toUpperCase()
        : '?';

    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
      child: Row(
        children: [
          Material(
            color: Colors.transparent,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onProfileTap,
              child: Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: BatColors.primary,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  initial,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  greeting,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: BatColors.muted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: BatColors.heading,
                    height: 1.2,
                  ),
                ),
                if (subtitle != null && subtitle!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                  ),
                ],
              ],
            ),
          ),
          if (onNotificationsTap != null)
            Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onNotificationsTap,
                child: Tooltip(
                  message: notificationsTooltip ?? '',
                  child: Ink(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: BatColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        const Icon(
                          Icons.notifications_outlined,
                          color: Colors.white,
                          size: 22,
                        ),
                        if (unreadCount > 0)
                          Positioned(
                            top: 11,
                            right: 13,
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: BatColors.success,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class HomeMosaicTile extends StatelessWidget {
  const HomeMosaicTile({super.key, required this.data});

  final HomeMosaicTileData data;

  @override
  Widget build(BuildContext context) {
    final style = _styleFor(data.tone);
    final enabled = data.enabled && data.onTap != null;

    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: Material(
        color: style.background,
        borderRadius: BorderRadius.circular(28),
        child: InkWell(
          onTap: enabled ? data.onTap : null,
          borderRadius: BorderRadius.circular(28),
          child: SizedBox(
            height: _heightFor(data.size),
            width: double.infinity,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: style.iconWell,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(data.icon, color: style.iconColor, size: 22),
                  ),
                  const Spacer(),
                  Text(
                    data.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: style.foreground,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (data.subtitle != null && data.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      data.subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: style.foreground.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Two-column staggered mosaic matching the bento reference:
/// Col A: tall → short → medium…
/// Col B: short → tall → medium…
///
/// Tile list order must be: A0, B0, A1, B1, A2, B2, …
/// Col A stays on the visual left (even in RTL) to match the reference.
class HomeMosaicGrid extends StatelessWidget {
  const HomeMosaicGrid({super.key, required this.tiles});

  final List<HomeMosaicTileData> tiles;

  @override
  Widget build(BuildContext context) {
    final colA = <HomeMosaicTileData>[];
    final colB = <HomeMosaicTileData>[];
    for (var i = 0; i < tiles.length; i++) {
      if (i.isEven) {
        colA.add(tiles[i]);
      } else {
        colB.add(tiles[i]);
      }
    }

    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final gap = const SizedBox(width: 12);
    final a = Expanded(child: _column(colA));
    final b = Expanded(child: _column(colB));

    // Keep column A on the visual left like the reference mock.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: isRtl ? [b, gap, a] : [a, gap, b],
    );
  }

  Widget _column(List<HomeMosaicTileData> items) {
    return Column(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          HomeMosaicTile(data: items[i]),
          if (i != items.length - 1) const SizedBox(height: 12),
        ],
      ],
    );
  }
}

/// Shared scrollable home scaffold: header + mosaic + optional footer widgets.
class HomeMosaicScaffold extends StatelessWidget {
  const HomeMosaicScaffold({
    super.key,
    required this.header,
    required this.tiles,
    this.banner,
    this.footer,
    this.onRefresh,
  });

  final Widget header;
  final List<HomeMosaicTileData> tiles;
  final Widget? banner;
  final List<Widget>? footer;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        header,
        if (banner != null) ...[const SizedBox(height: 12), banner!],
        const SizedBox(height: 20),
        HomeMosaicGrid(tiles: tiles),
        if (footer != null) ...[const SizedBox(height: 20), ...footer!],
      ],
    );

    final scrollable = onRefresh == null
        ? list
        : RefreshIndicator(onRefresh: onRefresh!, child: list);

    return Stack(
      fit: StackFit.expand,
      children: [const HomeHeroBackground(), scrollable],
    );
  }
}
