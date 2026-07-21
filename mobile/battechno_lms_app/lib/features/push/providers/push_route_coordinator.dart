import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../notifications/domain/notification_models.dart';

/// Resolves a push message's `action_url` to a mobile `go_router` path using
/// the same allowlisted mapping as the in-app notifications inbox
/// (`NotificationNavigator.mobileRouteFromActionUrl`) — a push payload can
/// never trigger navigation to an arbitrary/unmapped route.
///
/// Terminated/background taps arrive before the router (and often before
/// auth) is ready, so the resolved route is held here until
/// [consumePendingRoute] is called once the app is authenticated and the
/// router can act on it.
class PushRouteCoordinator extends Notifier<String?> {
  @override
  String? build() => null;

  /// Resolves [actionUrl] and stores it as pending. Returns the resolved
  /// route (or `null` if unmapped) for callers that want to react
  /// immediately (e.g. a foreground tap that can navigate right away).
  String? handleActionUrl(String? actionUrl) {
    final route = NotificationNavigator.mobileRouteFromActionUrl(actionUrl);
    state = route;
    return route;
  }

  /// Returns and clears the pending route (single-consume — avoids
  /// re-navigating on every rebuild).
  String? consumePendingRoute() {
    final route = state;
    state = null;
    return route;
  }

  /// Discards any pending navigation — called on logout / account switch so
  /// a previous account's deep link never fires after a new sign-in.
  void clear() {
    state = null;
  }
}

final pushRouteCoordinatorProvider =
    NotifierProvider<PushRouteCoordinator, String?>(PushRouteCoordinator.new);
