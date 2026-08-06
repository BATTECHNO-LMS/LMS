import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/storage/offline_cache.dart';
import '../../../core/storage/offline_cache_provider.dart';
import '../../auth/providers/auth_controller.dart';
import '../domain/student_course_models.dart';

class StudentCoursesRepository {
  StudentCoursesRepository(this._client, this._cache);

  final ApiClient _client;
  final OfflineCache? _cache;

  static const _listNamespace = 'student_courses_list';
  static const _detailNamespacePrefix = 'student_course_detail_';

  Future<StudentCoursesListData> loadList({
    required String userId,
    String? search,
    String? level,
    String? category,
    bool allowCache = true,
  }) async {
    try {
      final data = await _client.getJson(
        _client.endpoints.studentCourses,
        query: {
          if (search != null && search.isNotEmpty) 'search': search,
          if (level != null && level.isNotEmpty) 'level': level,
          if (category != null && category.isNotEmpty) 'category': category,
        },
      );
      final courses = _parseCourses(data);
      await _cache?.writeJson(
        userId: userId,
        namespace: _listNamespace,
        payload: {'courses': courses.map(_courseToCacheMap).toList()},
      );
      return StudentCoursesListData(courses: courses);
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: _listNamespace);
      if (cached == null) rethrow;
      final list = cached.data['courses'];
      final courses = list is List
          ? list
                .whereType<Map>()
                .map((e) => StudentCourse.fromMap(Map<String, dynamic>.from(e)))
                .toList()
          : <StudentCourse>[];
      return StudentCoursesListData(
        courses: courses,
        fromCache: true,
        cachedAt: cached.savedAt,
      );
    }
  }

  Future<StudentCourseDetail> loadDetail({
    required String userId,
    required String courseId,
    bool allowCache = true,
  }) async {
    final namespace = '$_detailNamespacePrefix$courseId';
    try {
      final data = await _client.getJson(
        _client.endpoints.studentCourse(courseId),
      );
      final detail = StudentCourseDetail.fromMap(data);
      await _cache?.writeJson(
        userId: userId,
        namespace: namespace,
        payload: data,
      );
      return detail;
    } catch (_) {
      if (!allowCache || _cache == null) rethrow;
      final cached = _cache.readJson(userId: userId, namespace: namespace);
      if (cached == null) rethrow;
      return StudentCourseDetail.fromMap(cached.data);
    }
  }

  Future<void> startCourse(String courseId) async {
    await _client.postJson(_client.endpoints.studentCourseStart(courseId));
  }

  Future<int> completeLesson({
    required String courseId,
    required String lessonId,
  }) async {
    final data = await _client.postJson(
      _client.endpoints.studentCourseLessonComplete(courseId, lessonId),
    );
    final percent = data['progress_percent'];
    if (percent is int) return percent;
    if (percent is num) return percent.toInt();
    return 0;
  }

  List<StudentCourse> _parseCourses(Map<String, dynamic> data) {
    final raw = data['courses'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => StudentCourse.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Map<String, dynamic> _courseToCacheMap(StudentCourse c) => {
    'id': c.id,
    'title': c.title,
    'slug': c.slug,
    'short_description': c.shortDescription,
    'description': c.description,
    'level': c.level,
    'category': c.category,
    'cover_image_url': c.coverImageUrl,
    'estimated_duration_minutes': c.estimatedDurationMinutes,
    'lessons_count': c.lessonsCount,
    'completed_lessons_count': c.completedLessonsCount,
    'progress_percent': c.progressPercent,
    'enrollment_status': switch (c.enrollmentStatus) {
      StudentCourseEnrollmentStatus.active => 'active',
      StudentCourseEnrollmentStatus.completed => 'completed',
      StudentCourseEnrollmentStatus.notStarted => null,
      StudentCourseEnrollmentStatus.unknown => 'unknown',
      null => null,
    },
    'started_at': c.startedAt,
  };
}

final studentCoursesRepositoryProvider = Provider<StudentCoursesRepository>((
  ref,
) {
  final cache = ref.watch(offlineCacheProvider).valueOrNull;
  return StudentCoursesRepository(ref.watch(apiClientProvider), cache);
});
