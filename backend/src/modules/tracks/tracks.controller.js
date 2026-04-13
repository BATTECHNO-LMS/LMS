const tracksService = require('./tracks.service');
const { success, created } = require('../../utils/apiResponse');

async function list(req, res, next) {
  try {
    const data = await tracksService.listTracks(req.validated.query);
    return success(res, data, { message: 'Tracks retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function getById(req, res, next) {
  try {
    const data = await tracksService.getTrackById(req.validated.params.id);
    return success(res, data, { message: 'Track retrieved' });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const data = await tracksService.createTrack(req.validated.body);
    return created(res, data, { message: 'Track created' });
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const data = await tracksService.updateTrack(req.validated.params.id, req.validated.body);
    return success(res, data, { message: 'Track updated' });
  } catch (e) {
    return next(e);
  }
}

module.exports = { list, getById, create, update };
