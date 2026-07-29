'use strict';

module.exports = {
  catalog: require('./notificationEvents.catalog'),
  shared: require('./notificationEngine.shared'),
  recipientResolver: require('./recipientResolver.service'),
  get dispatcher() {
    return require('./notificationDispatcher.service');
  },
  get rulesService() {
    return require('./notificationRules.service');
  },
  get routes() {
    return require('./notificationRules.routes');
  },
  get emitDomainEvent() {
    return require('./notificationDispatcher.service').emitDomainEvent;
  },
  get scheduleJob() {
    return require('./notificationDispatcher.service').scheduleJob;
  },
  get processDueJobs() {
    return require('./notificationDispatcher.service').processDueJobs;
  },
  get invalidateRulesCache() {
    return require('./notificationDispatcher.service').invalidateRulesCache;
  },
};
