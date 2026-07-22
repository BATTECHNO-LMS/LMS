import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/secure_token_storage.dart';
import '../data/auth_repository.dart';
import '../domain/auth_user.dart';

enum AuthStatus {
  unknown,
  unauthenticated,
  authenticated,
  pendingApproval,
  inactive,
  unsupportedRole,
}

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.isLoading = false,
    this.errorMessage,
  });

  const AuthState.unknown() : this(status: AuthStatus.unknown);

  final AuthStatus status;
  final AuthUser? user;
  final bool isLoading;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool? isLoading,
    String? errorMessage,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
    );
  }
}

class AuthController extends Notifier<AuthState> {
  late SecureTokenStorage _storage;
  bool _bootstrapStarted = false;

  AuthRepository get _authRepository => ref.read(authRepositoryProvider);

  @override
  AuthState build() {
    _storage = ref.read(secureTokenStorageProvider);
    return const AuthState.unknown();
  }

  Future<void> bootstrap() async {
    if (_bootstrapStarted) return;
    _bootstrapStarted = true;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final token = await _storage.readToken();
      if (token == null || token.isEmpty) {
        state = const AuthState(status: AuthStatus.unauthenticated);
        return;
      }
      await _hydrateFromProfile();
    } catch (_) {
      // Never leave splash on AuthStatus.unknown — fail open to login.
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: 'networkError',
      );
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final token = await _authRepository.login(
        email: email,
        password: password,
      );
      await _storage.writeToken(token);
      await _hydrateFromProfile();
    } on ApiException catch (e) {
      state = _mapAuthError(e);
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        status: AuthStatus.unauthenticated,
        errorMessage: 'loginFailed',
      );
    }
  }

  Future<void> _hydrateFromProfile() async {
    try {
      final user = await _authRepository.fetchCurrentUser();
      if (user.hasProgramAdmin || !user.isSupported) {
        await _storage.clearToken();
        state = AuthState(status: AuthStatus.unsupportedRole, isLoading: false);
        return;
      }
      if (!user.isActive) {
        await _storage.clearToken();
        state = AuthState(
          status: user.status == 'inactive'
              ? AuthStatus.pendingApproval
              : AuthStatus.inactive,
          isLoading: false,
        );
        return;
      }
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
        isLoading: false,
      );
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _storage.clearToken();
      }
      state = _mapAuthError(e);
    }
  }

  AuthState _mapAuthError(ApiException e) {
    if (e.isEmailNotVerified) {
      return AuthState(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: 'emailNotVerified',
      );
    }
    if (e.isAccountPending) {
      return AuthState(status: AuthStatus.pendingApproval, isLoading: false);
    }
    if (e.isAccountInactive) {
      return AuthState(status: AuthStatus.inactive, isLoading: false);
    }
    if (e.isNetwork) {
      return AuthState(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: 'networkError',
      );
    }
    return AuthState(
      status: AuthStatus.unauthenticated,
      isLoading: false,
      errorMessage: e.message,
    );
  }

  Future<void> logout() async {
    await _authRepository.logout();
    await _storage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> handleUnauthorized() async {
    await _storage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Forces login routing when splash bootstrap times out or storage hangs.
  /// Does not clear a stored token (next launch can retry hydration).
  void markBootstrapTimedOut() {
    if (state.status == AuthStatus.unknown || state.isLoading) {
      state = const AuthState(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        errorMessage: 'networkError',
      );
    }
  }

  /// Re-fetches `GET /auth/me` and updates state in place.
  ///
  /// Security (IDENTITY-001 / lost-privilege handling): the backend is
  /// authoritative for `role` and `isGlobal`. This is used to detect a
  /// server-side privilege change (e.g. `super_admin` role or `isGlobal`
  /// revoked) while the app is open, without requiring a full re-login.
  /// On failure the current session is preserved unless the server reports
  /// the account is no longer usable (handled the same way as login).
  Future<AuthUser?> refreshCurrentUser() async {
    if (state.status != AuthStatus.authenticated) return state.user;
    try {
      final user = await _authRepository.fetchCurrentUser();
      if (user.hasProgramAdmin || !user.isSupported) {
        await _storage.clearToken();
        state = AuthState(status: AuthStatus.unsupportedRole, isLoading: false);
        return null;
      }
      if (!user.isActive) {
        await _storage.clearToken();
        state = AuthState(
          status: user.status == 'inactive'
              ? AuthStatus.pendingApproval
              : AuthStatus.inactive,
          isLoading: false,
        );
        return null;
      }
      state = state.copyWith(user: user, status: AuthStatus.authenticated);
      return user;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _storage.clearAll();
        state = const AuthState(status: AuthStatus.unauthenticated);
        return null;
      }
      // Network or transient failure — keep the current session/user.
      return state.user;
    } catch (_) {
      return state.user;
    }
  }

  Future<String?> readToken() => _storage.readToken();
}

final secureTokenStorageProvider = Provider<SecureTokenStorage>(
  (ref) => SecureTokenStorage(),
);

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

final apiClientProvider = Provider<ApiClient>((ref) {
  final config = ref.watch(appConfigProvider);
  final storage = ref.watch(secureTokenStorageProvider);
  return ApiClient(
    config: config,
    endpoints: ApiEndpoints(config),
    readToken: storage.readToken,
    onUnauthorized: () async {
      await storage.clearAll();
      ref.read(authControllerProvider.notifier).handleUnauthorized();
    },
  );
});
