const express = require("express");
const app = express();

app.get("/", (req, res) => {
  return res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>FamouslyTrill</title>
  </head>
  <body>
    <main>
      <h1>FamouslyTrill</h1>
      <p>Express service is online.</p>
    </main>
  </body>
</html>`);
});

app.get("/api/health", (req, res) => {
  return res.status(200).json({ ok: true });
});

app.use((req, res) => {
  return res.status(404).json({ error: "not_found" });
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Listening on ${port}`);
  });
}

module.exports = app;
