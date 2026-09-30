const express = require("express");

const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
    }
    main {
      text-align: center;
    }
    a {
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <main>
    <h1>Welcome</h1>
    <p>The API is running.</p>
    <p><a href="/api">GET /api</a></p>
  </main>
</body>
</html>`);
});

app.get("/api", (req, res) => {
  res.json({
    msg: "success",
    status: "OK",
    data: {},
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
