// Student LMS course models — fields aligned with
// `GET /api/v1/student/courses` and `GET /api/v1/student/courses/:id`.

enum StudentCourseEnrollmentStatus { notStarted, active, completed, unknown }

enum CourseLessonType { video, text, link, file, unknown }

class StudentCourse {
  const StudentCourse({
    required this.id,
    required this.title,
    this.slug,
    this.shortDescription,
    this.description,
    this.level,
    this.category,
    this.coverImageUrl,
    this.estimatedDurationMinutes,
    this.lessonsCount = 0,
    this.completedLessonsCount = 0,
    this.progressPercent = 0,
    this.enrollmentStatus,
    this.startedAt,
  });

  final String id;
  final String title;
  final String? slug;
  final String? shortDescription;
  final String? description;
  final String? level;
  final String? category;
  final String? coverImageUrl;
  final int? estimatedDurationMinutes;
  final int lessonsCount;
  final int completedLessonsCount;
  final int progressPercent;
  final StudentCourseEnrollmentStatus? enrollmentStatus;
  final String? startedAt;

  bool get hasStarted =>
      enrollmentStatus == StudentCourseEnrollmentStatus.active ||
      enrollmentStatus == StudentCourseEnrollmentStatus.completed;

  bool get isCompleted =>
      enrollmentStatus == StudentCourseEnrollmentStatus.completed;

  factory StudentCourse.fromMap(Map<String, dynamic> map) {
    return StudentCourse(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      slug: map['slug']?.toString(),
      shortDescription: map['short_description']?.toString(),
      description: map['description']?.toString(),
      level: map['level']?.toString(),
      category: map['category']?.toString(),
      coverImageUrl: map['cover_image_url']?.toString(),
      estimatedDurationMinutes: _asInt(map['estimated_duration_minutes']),
      lessonsCount: _asInt(map['lessons_count']) ?? 0,
      completedLessonsCount: _asInt(map['completed_lessons_count']) ?? 0,
      progressPercent: _asInt(map['progress_percent']) ?? 0,
      enrollmentStatus: parseEnrollmentStatus(
        map['enrollment_status']?.toString(),
      ),
      startedAt: map['started_at']?.toString(),
    );
  }

  static StudentCourseEnrollmentStatus? parseEnrollmentStatus(String? raw) {
    if (raw == null || raw.isEmpty) {
      return StudentCourseEnrollmentStatus.notStarted;
    }
    switch (raw) {
      case 'active':
      case 'enrolled':
        return StudentCourseEnrollmentStatus.active;
      case 'completed':
        return StudentCourseEnrollmentStatus.completed;
      default:
        return StudentCourseEnrollmentStatus.unknown;
    }
  }
}

class CourseLesson {
  const CourseLesson({
    required this.id,
    required this.title,
    this.sectionId,
    this.description,
    this.type = CourseLessonType.unknown,
    this.videoUrl,
    this.content,
    this.resourceUrl,
    this.durationMinutes,
    this.sortOrder = 0,
    this.isPreview = false,
    this.isRequired = true,
    this.status,
    this.isCompleted = false,
  });

  final String id;
  final String title;
  final String? sectionId;
  final String? description;
  final CourseLessonType type;
  final String? videoUrl;
  final String? content;
  final String? resourceUrl;
  final int? durationMinutes;
  final int sortOrder;
  final bool isPreview;
  final bool isRequired;
  final String? status;
  final bool isCompleted;

  factory CourseLesson.fromMap(Map<String, dynamic> map) {
    return CourseLesson(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      sectionId: map['section_id']?.toString(),
      description: map['description']?.toString(),
      type: parseLessonType(map['type']?.toString()),
      videoUrl: map['video_url']?.toString(),
      content: map['content']?.toString(),
      resourceUrl: map['resource_url']?.toString(),
      durationMinutes: _asInt(map['duration_minutes']),
      sortOrder: _asInt(map['sort_order']) ?? 0,
      isPreview: map['is_preview'] == true,
      isRequired: map['is_required'] != false,
      status: map['status']?.toString(),
      isCompleted: map['is_completed'] == true,
    );
  }

  static CourseLessonType parseLessonType(String? raw) {
    switch (raw) {
      case 'video':
        return CourseLessonType.video;
      case 'text':
        return CourseLessonType.text;
      case 'link':
        return CourseLessonType.link;
      case 'file':
        return CourseLessonType.file;
      default:
        return CourseLessonType.unknown;
    }
  }
}

class CourseSection {
  const CourseSection({
    required this.id,
    required this.title,
    this.sortOrder = 0,
    this.lessons = const [],
  });

  final String id;
  final String title;
  final int sortOrder;
  final List<CourseLesson> lessons;

  factory CourseSection.fromMap(Map<String, dynamic> map) {
    final lessonsRaw = map['lessons'];
    final lessons = lessonsRaw is List
        ? lessonsRaw
              .whereType<Map>()
              .map((e) => CourseLesson.fromMap(Map<String, dynamic>.from(e)))
              .where(
                (l) =>
                    l.status == null ||
                    l.status == 'published' ||
                    l.status!.isEmpty,
              )
              .toList()
        : <CourseLesson>[];
    lessons.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return CourseSection(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? '',
      sortOrder: _asInt(map['sort_order']) ?? 0,
      lessons: lessons,
    );
  }
}

class StudentCourseDetail {
  const StudentCourseDetail({
    required this.course,
    required this.sections,
    required this.progressPercent,
  });

  final StudentCourse course;
  final List<CourseSection> sections;
  final int progressPercent;

  CourseLesson? get nextLesson {
    for (final section in sections) {
      for (final lesson in section.lessons) {
        if (!lesson.isCompleted) return lesson;
      }
    }
    return null;
  }

  int get totalLessons => sections.fold(0, (n, s) => n + s.lessons.length);

  int get completedLessons => sections.fold(
    0,
    (n, s) => n + s.lessons.where((l) => l.isCompleted).length,
  );

  factory StudentCourseDetail.fromMap(Map<String, dynamic> map) {
    final courseMap = map['course'];
    final course = courseMap is Map
        ? StudentCourse.fromMap(Map<String, dynamic>.from(courseMap))
        : StudentCourse.fromMap(map);
    final sectionsRaw = map['sections'];
    final sections = sectionsRaw is List
        ? sectionsRaw
              .whereType<Map>()
              .map((e) => CourseSection.fromMap(Map<String, dynamic>.from(e)))
              .toList()
        : <CourseSection>[];
    sections.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return StudentCourseDetail(
      course: course,
      sections: sections,
      progressPercent:
          _asInt(map['progress_percent']) ?? course.progressPercent,
    );
  }
}

class StudentCoursesListData {
  const StudentCoursesListData({
    required this.courses,
    this.fromCache = false,
    this.cachedAt,
  });

  final List<StudentCourse> courses;
  final bool fromCache;
  final DateTime? cachedAt;
}

int? _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
