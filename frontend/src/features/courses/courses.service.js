import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

const admin = endpoints.adminCourses;
const student = endpoints.studentCourses;

export async function fetchAdminCoursesList(params = {}) {
  const res = await apiClient.get(admin, { params });
  return unwrapApiData(res);
}

export async function fetchAdminCourse(id) {
  const res = await apiClient.get(`${admin}/${id}`);
  return unwrapApiData(res);
}

export async function uploadCourseCoverImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post(`${admin}/cover`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapApiData(res);
}

export async function createAdminCourse(body) {
  const res = await apiClient.post(admin, body);
  return unwrapApiData(res);
}

export async function updateAdminCourse(id, body) {
  const res = await apiClient.patch(`${admin}/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminCourse(id) {
  const res = await apiClient.post(`${admin}/${id}/publish`);
  return unwrapApiData(res);
}

export async function archiveAdminCourse(id) {
  const res = await apiClient.post(`${admin}/${id}/archive`);
  return unwrapApiData(res);
}

export async function fetchCourseStructure(courseId) {
  const res = await apiClient.get(`${admin}/${courseId}/structure`);
  return unwrapApiData(res);
}

export async function createCourseSection(courseId, body) {
  const res = await apiClient.post(`${admin}/${courseId}/sections`, body);
  return unwrapApiData(res);
}

export async function updateCourseSection(courseId, sectionId, body) {
  const res = await apiClient.patch(`${admin}/${courseId}/sections/${sectionId}`, body);
  return unwrapApiData(res);
}

export async function deleteCourseSection(courseId, sectionId) {
  const res = await apiClient.delete(`${admin}/${courseId}/sections/${sectionId}`);
  return unwrapApiData(res);
}

export async function createCourseLesson(courseId, sectionId, body) {
  const res = await apiClient.post(`${admin}/${courseId}/sections/${sectionId}/lessons`, body);
  return unwrapApiData(res);
}

export async function updateCourseLesson(courseId, lessonId, body) {
  const res = await apiClient.patch(`${admin}/${courseId}/lessons/${lessonId}`, body);
  return unwrapApiData(res);
}

export async function deleteCourseLesson(courseId, lessonId) {
  const res = await apiClient.delete(`${admin}/${courseId}/lessons/${lessonId}`);
  return unwrapApiData(res);
}

export async function reorderCourseLessons(courseId, items) {
  const res = await apiClient.post(`${admin}/${courseId}/lessons/reorder`, { items });
  return unwrapApiData(res);
}

export async function previewYoutubePlaylist(courseId, url) {
  const res = await apiClient.post(`${admin}/${courseId}/youtube-playlist/preview`, { url });
  return unwrapApiData(res);
}

export async function fetchStudentCoursesList(params = {}) {
  const res = await apiClient.get(student, { params });
  return unwrapApiData(res);
}

export async function fetchStudentCourse(id) {
  const res = await apiClient.get(`${student}/${id}`);
  return unwrapApiData(res);
}

export async function startStudentCourse(id) {
  const res = await apiClient.post(`${student}/${id}/start`);
  return unwrapApiData(res);
}

export async function completeStudentLesson(courseId, lessonId) {
  const res = await apiClient.post(`${student}/${courseId}/lessons/${lessonId}/complete`);
  return unwrapApiData(res);
}

export async function fetchStudentCourseProgress(id) {
  const res = await apiClient.get(`${student}/${id}/progress`);
  return unwrapApiData(res);
}

export async function fetchLessonTraining(courseId, lessonId) {
  const res = await apiClient.get(`${student}/${courseId}/lessons/${lessonId}/training`);
  return unwrapApiData(res);
}

export async function startLessonTraining(courseId, lessonId) {
  const res = await apiClient.post(`${student}/${courseId}/lessons/${lessonId}/training/start`);
  return unwrapApiData(res);
}

export async function uploadLessonSubmission(courseId, lessonId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post(
    `${student}/${courseId}/lessons/${lessonId}/training/submission`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return unwrapApiData(res);
}

export async function submitLessonTrainingAnswers(courseId, lessonId, answers) {
  const res = await apiClient.post(
    `${student}/${courseId}/lessons/${lessonId}/training/answers`,
    { answers }
  );
  return unwrapApiData(res);
}

export async function fetchAdminLessonTraining(courseId, lessonId) {
  const res = await apiClient.get(`${admin}/${courseId}/lessons/${lessonId}/training`);
  return unwrapApiData(res);
}

export async function saveAdminLessonTraining(courseId, lessonId, body) {
  const res = await apiClient.put(`${admin}/${courseId}/lessons/${lessonId}/training`, body);
  return unwrapApiData(res);
}
