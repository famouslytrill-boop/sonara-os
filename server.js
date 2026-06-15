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
      <h1>SONARA Industries</h1>
      <p>Express service is online.</p>
      <nav>
        <a href="/contact">Contact</a>
        <a href="/pricing">Pricing</a>
        <a href="/legal/terms">Terms</a>
      </nav>
    </main>
  </body>
</html>`);
});

app.get("/contact", (req, res) => {
  return res.status(200).type("html").send(page("Contact", "Contact SONARA Industries."));
});

app.get("/pricing", (req, res) => {
  return res.status(200).type("html").send(page("Pricing", "Review SONARA Industries launch options."));
});

app.get("/legal/terms", (req, res) => {
  return res.status(200).type("html").send(page("Terms", "SONARA Industries terms of service."));
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

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | SONARA Industries</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
    </main>
  </body>
</html>`;
}
