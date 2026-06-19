const app = require('./server-saas');

module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`SONARA Industries listening on ${port}`));
}
