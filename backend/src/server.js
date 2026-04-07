const app = require('./app');
const { env } = require('./shared/config');

const port = env.PORT;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`BATTECHNO-LMS API listening on port ${port}`);
});
