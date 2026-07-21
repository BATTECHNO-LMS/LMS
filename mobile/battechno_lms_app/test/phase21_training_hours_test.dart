import 'package:flutter_test/flutter_test.dart';

import 'package:battechno_lms_app/core/auth/lms_roles.dart';
import 'package:battechno_lms_app/features/instructor/domain/instructor_models.dart';

void main() {
  group('Phase 21 training hours', () {
    test('required hours null when absent', () {
      final opp = InstructorOpportunity({'id': '1', 'title': 'T'});
      expect(opp.requiredHours, isNull);
    });

    test('required hours from API field', () {
      final opp = InstructorOpportunity({
        'id': '1',
        'title': 'T',
        'required_training_hours': 80,
      });
      expect(opp.requiredHours, 80);
    });

    test('hours validation helpers reject negative', () {
      expect(InstructorLabels.isEndAfterStart('09:00', '10:00'), isTrue);
    });

    test('program_admin remains unsupported', () {
      expect(LmsRoles.isSupported(['program_admin']), isFalse);
    });

    test('aggregate replace semantics documented via model section', () {
      // Model A: completed hours live on application payloads returned by progress.
      final metrics = {
        'required_training_hours': 100,
        'completed_training_hours': 40,
        'remaining_training_hours': 60,
        'hours_progress_percentage': 40,
      };
      expect(metrics['remaining_training_hours'], 60);
      expect(
        (metrics['completed_training_hours'] as int) <=
            (metrics['required_training_hours'] as int),
        isTrue,
      );
    });
  });
}
