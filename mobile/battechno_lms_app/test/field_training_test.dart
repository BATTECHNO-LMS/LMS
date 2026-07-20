import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:battechno_lms_app/app/localization/l10n/app_localizations.dart';
import 'package:battechno_lms_app/app/config/app_config.dart';
import 'package:battechno_lms_app/core/api/api_client.dart';
import 'package:battechno_lms_app/core/api/api_endpoints.dart';
import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/features/auth/domain/auth_user.dart';
import 'package:battechno_lms_app/features/field_training/data/field_training_repository.dart';
import 'package:battechno_lms_app/features/field_training/domain/field_training_models.dart';
import 'package:battechno_lms_app/features/field_training/presentation/field_training_detail_screen.dart';
import 'package:battechno_lms_app/features/field_training/presentation/widgets/field_training_widgets.dart';
import 'package:battechno_lms_app/core/widgets/bat_widgets.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('TaskSubmissionValidator', () {
    test('rejects empty submission without url or file', () {
      expect(
        TaskSubmissionValidator.validate(
          notes: '',
          projectUrl: '',
          requiresAi: false,
          hasFile: false,
        ),
        isNotNull,
      );
    });

    test('accepts valid project url', () {
      expect(
        TaskSubmissionValidator.validate(
          notes: 'ملاحظات',
          projectUrl: 'https://example.com/project',
          requiresAi: false,
          hasFile: false,
        ),
        isNull,
      );
    });

    test('blocks AI-required tasks on mobile', () {
      expect(
        TaskSubmissionValidator.validate(
          notes: 'answer',
          projectUrl: 'https://example.com',
          requiresAi: true,
          hasFile: false,
        ),
        contains('الذكاء الاصطناعي'),
      );
    });
  });

  group('Field training detail screen', () {
    testWidgets('shows loading skeleton initially', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fieldTrainingRepositoryProvider.overrideWith(
              (ref) => _SlowFieldTrainingRepository(),
            ),
          ],
          child: _localizedApp(
            const FieldTrainingDetailScreen(opportunityId: 'opp-1'),
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(LoadingSkeleton), findsOneWidget);
    });

    testWidgets('renders success state with tasks', (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 2400));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fieldTrainingRepositoryProvider.overrideWith(
              (ref) => _FakeFieldTrainingRepository(
                bundle: FieldTrainingDetailBundle(
                  opportunity: {
                    'title': 'تدريب صيفي',
                    'my_training_status': 'in_training',
                    'requires_pre_assessment': false,
                    'requires_post_assessment': false,
                    'university': {'name': 'جامعة تجريبية'},
                    'specialty': {'name_ar': 'علوم الحاسب'},
                  },
                  progress: {
                    'metrics': {'tasks_count': 2, 'tasks_submitted': 1},
                    'next_action': {'label_ar': 'أكمل المهمة التالية'},
                  },
                  tasks: [
                    {
                      'id': 'task-1',
                      'title': 'تقرير أسبوعي',
                      'due_date': '2026-08-01',
                    },
                  ],
                ),
              ),
            ),
          ],
          child: _localizedApp(
            const FieldTrainingDetailScreen(opportunityId: 'opp-1'),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('تدريب صيفي'), findsOneWidget);
      expect(find.text('تقرير أسبوعي'), findsOneWidget);
      expect(find.text('أكمل المهمة التالية'), findsWidgets);
    });
  });

  group('Task list section', () {
    testWidgets('shows empty tasks state', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: _localizedApp(
            Builder(
              builder: (context) {
                return Scaffold(
                  body: TaskListSection(tasks: const [], onTaskTap: (_) {}),
                );
              },
            ),
          ),
        ),
      );

      expect(find.text('لا توجد مهام مطلوبة حاليًا'), findsOneWidget);
    });
  });

  group('Student routes', () {
    testWidgets('authenticated student can reach field training route', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fieldTrainingRepositoryProvider.overrideWith(
              (ref) => _FakeFieldTrainingRepository(
                bundle: FieldTrainingDetailBundle(
                  opportunity: {'title': 'فرصة تجريبية'},
                  tasks: const [],
                ),
              ),
            ),
          ],
          child: MaterialApp.router(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            locale: const Locale('ar'),
            routerConfig: GoRouter(
              initialLocation: '/student/field-training/demo',
              routes: [
                GoRoute(
                  path: '/student/field-training/:id',
                  builder: (_, state) => FieldTrainingDetailScreen(
                    opportunityId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.text('فرصة تجريبية'), findsOneWidget);
    });
  });

  group('Auth routing roles', () {
    test('program_admin remains unsupported for mobile shell', () {
      const user = AuthUser(
        id: '1',
        email: 'admin@test.com',
        fullName: 'Admin',
        status: 'active',
        roles: [LmsRoles.programAdmin],
        primaryRole: LmsRoles.programAdmin,
        permissions: [],
        isGlobal: false,
      );
      expect(user.isSupported, isFalse);
    });
  });
}

Widget _localizedApp(Widget child) {
  return MaterialApp(
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('ar'),
    home: child,
  );
}

ApiClient _inertApiClient() {
  final config = AppConfig.fromEnvironment();
  return ApiClient(
    config: config,
    endpoints: ApiEndpoints(config),
    readToken: () async => null,
    onUnauthorized: () async {},
  );
}

class _FakeFieldTrainingRepository extends FieldTrainingRepository {
  _FakeFieldTrainingRepository({required this.bundle})
    : super(_inertApiClient());

  final FieldTrainingDetailBundle bundle;

  @override
  Future<FieldTrainingDetailBundle> loadDetail(String opportunityId) async {
    return bundle;
  }
}

class _SlowFieldTrainingRepository extends FieldTrainingRepository {
  _SlowFieldTrainingRepository() : super(_inertApiClient());

  @override
  Future<FieldTrainingDetailBundle> loadDetail(String opportunityId) {
    return Completer<FieldTrainingDetailBundle>().future;
  }
}
