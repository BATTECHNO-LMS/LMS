const attendanceService = require('./attendance.service');
const { success } = require('../../utils/apiResponse');

async function updateRecord(req, res, next) {
  try {
    const data = await attendanceService.updateAttendanceRecord(req.validated.params.id, req.validated.body, req.user);
    return success(res, data, { message: 'Attendance record updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { updateRecord };
