import 'package:flutter/material.dart';

import '../../app/theme/bat_colors.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      child: isLoading
          ? const SizedBox(
              height: 22,
              width: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Text(label),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(onPressed: onPressed, child: Text(label));
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    required this.label,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.autofillHints,
    this.onFieldSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      validator: validator,
      autofillHints: autofillHints,
      onFieldSubmitted: onFieldSubmitted,
      decoration: InputDecoration(labelText: label),
    );
  }
}

class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.validator,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _obscure,
      validator: widget.validator,
      textInputAction: widget.textInputAction,
      onFieldSubmitted: widget.onFieldSubmitted,
      autofillHints: const [AutofillHints.password],
      decoration: InputDecoration(
        labelText: widget.label,
        suffixIcon: IconButton(
          icon: Icon(
            _obscure
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
          ),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    );
  }
}

class OtpInput extends StatelessWidget {
  const OtpInput({
    super.key,
    required this.controller,
    required this.label,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.number,
      maxLength: 6,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.headlineSmall,
      validator: validator,
      decoration: InputDecoration(labelText: label, counterText: ''),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.subtitle, this.icon});

  final String title;
  final String? subtitle;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon ?? Icons.school_outlined,
              size: 56,
              color: BatColors.primaryLight,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: BatColors.muted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.wifi_off_rounded,
              size: 56,
              color: BatColors.warning,
            ),
            const SizedBox(height: 16),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onRetry,
              child: Text(MaterialLocalizations.of(context).okButtonLabel),
            ),
          ],
        ),
      ),
    );
  }
}

class RetryView extends ErrorState {
  const RetryView({
    super.key,
    required super.title,
    required super.message,
    required super.onRetry,
  });
}

class LoadingSkeleton extends StatelessWidget {
  const LoadingSkeleton({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        lines,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: index == 0 ? 120 : 56,
            decoration: BoxDecoration(
              color: BatColors.surfaceHeader,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(BatRadii.md),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BatColors.accentSoft,
        borderRadius: BorderRadius.circular(BatRadii.lg),
        border: Border.all(color: BatColors.accent.withValues(alpha: 0.35)),
      ),
      child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
    );
  }
}

class AcademicSectionHeader extends StatelessWidget {
  const AcademicSectionHeader({super.key, required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: BatColors.heading,
            ),
          ),
        ),
        if (action != null) action!,
      ],
    );
  }
}

class QuickActionButton extends StatelessWidget {
  const QuickActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BatColors.primarySoft,
      borderRadius: BorderRadius.circular(BatRadii.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(BatRadii.lg),
        child: SizedBox(
          width: 96,
          height: 108,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: BatColors.primary),
                const SizedBox(height: 8),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class UniversityIdentityCard extends StatelessWidget {
  const UniversityIdentityCard({
    super.key,
    required this.university,
    required this.specialty,
  });

  final String university;
  final String specialty;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: BatColors.accentSoft,
                borderRadius: BorderRadius.circular(BatRadii.lg),
              ),
              child: const Icon(
                Icons.account_balance_outlined,
                color: BatColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    university,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (specialty.isNotEmpty)
                    Text(
                      specialty,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: BatColors.muted),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TrainingProgressCard extends StatelessWidget {
  const TrainingProgressCard({
    super.key,
    required this.title,
    required this.statusLabel,
    required this.progress,
    this.completedHours,
    this.requiredHours,
    this.nextAction,
  });

  final String title;
  final String statusLabel;
  final double progress;
  final int? completedHours;
  final int? requiredHours;
  final String? nextAction;

  @override
  Widget build(BuildContext context) {
    final clamped = progress.clamp(0.0, 1.0);
    final hoursLabel = completedHours != null
        ? '$completedHours${requiredHours != null ? ' / $requiredHours' : ''}'
        : null;

    return Material(
      color: BatColors.cream,
      borderRadius: BorderRadius.circular(28),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.hiking,
                    color: BatColors.accentHover,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: BatColors.heading,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: BatColors.primarySoft,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          statusLabel,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: BatColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (hoursLabel != null)
                  Text(
                    hoursLabel,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.accentHover,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: clamped,
                minHeight: 10,
                color: BatColors.accent,
                backgroundColor: Colors.white,
              ),
            ),
            if (nextAction != null && nextAction!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                nextAction!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: BatColors.muted,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shell / secondary-page header:
/// [Back] · page title · [Notifications] — circular actions on soft surface.
class BattechnoAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BattechnoAppBar({
    super.key,
    required this.title,
    this.onBack,
    this.onNotifications,
    this.unreadCount = 0,
    this.notificationsTooltip,
    this.actions,
    this.leading,
  });

  final String title;
  final VoidCallback? onBack;
  final VoidCallback? onNotifications;
  final int unreadCount;
  final String? notificationsTooltip;

  /// Optional override — used when a screen needs custom trailing widgets.
  final List<Widget>? actions;
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    final resolveBack =
        onBack ?? (canPop ? () => Navigator.of(context).maybePop() : null);

    return Material(
      color: BatColors.background,
      elevation: 0,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 64,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Title — always centered
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 56),
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: BatColors.heading,
                    ),
                  ),
                ),
                // Start (right in RTL) = back
                PositionedDirectional(
                  start: 0,
                  child:
                      leading ??
                      (resolveBack != null
                          ? _HeaderCircleButton(
                              background: Colors.white,
                              icon: Icons.chevron_right,
                              iconColor: BatColors.heading,
                              onTap: resolveBack,
                              semanticLabel: MaterialLocalizations.of(
                                context,
                              ).backButtonTooltip,
                            )
                          : const SizedBox(width: 44)),
                ),
                // End (left in RTL) = notifications or custom actions
                PositionedDirectional(
                  end: 0,
                  child: actions != null
                      ? Row(mainAxisSize: MainAxisSize.min, children: actions!)
                      : (onNotifications != null
                            ? Tooltip(
                                message: notificationsTooltip ?? '',
                                child: _HeaderCircleButton(
                                  background: BatColors.primaryLight,
                                  icon: Icons.notifications_outlined,
                                  iconColor: Colors.white,
                                  bordered: true,
                                  onTap: onNotifications!,
                                  badgeCount: unreadCount,
                                ),
                              )
                            : const SizedBox(width: 44)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderCircleButton extends StatelessWidget {
  const _HeaderCircleButton({
    required this.background,
    required this.icon,
    required this.iconColor,
    required this.onTap,
    this.bordered = false,
    this.badgeCount = 0,
    this.semanticLabel,
  });

  final Color background;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;
  final bool bordered;
  final int badgeCount;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    // Keep chevrons from auto-mirroring in RTL so back always points
    // outward on the start edge (→ in Arabic, ← in English).
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final resolvedIcon = icon == Icons.chevron_right
        ? (isRtl ? Icons.chevron_right : Icons.chevron_left)
        : icon;
    final lockDirection = icon == Icons.chevron_right;

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Ink(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: background,
              shape: BoxShape.circle,
              border: bordered
                  ? Border.all(color: Colors.white, width: 1.5)
                  : null,
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  resolvedIcon,
                  color: iconColor,
                  size: 22,
                  textDirection: lockDirection ? TextDirection.ltr : null,
                ),
                if (badgeCount > 0)
                  Positioned(
                    top: 8,
                    right: 10,
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
    );
  }
}

class BatLogoHeader extends StatelessWidget {
  const BatLogoHeader({super.key, this.height = 72});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Image.asset('assets/images/battechno_lms_logo.png', height: height),
        const SizedBox(height: 8),
        Text(
          'BATTECHNO LMS',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w900,
            color: BatColors.heading,
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}

class CampusMotifBackground extends StatelessWidget {
  const CampusMotifBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned(
          top: -40,
          left: -20,
          right: -20,
          child: Container(
            height: 180,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  BatColors.cream,
                  BatColors.background.withValues(alpha: 0),
                ],
              ),
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(48),
              ),
            ),
          ),
        ),
        Positioned(
          top: 24,
          right: 16,
          child: Icon(
            Icons.account_balance,
            size: 88,
            color: BatColors.primary.withValues(alpha: 0.06),
          ),
        ),
        child,
      ],
    );
  }
}
