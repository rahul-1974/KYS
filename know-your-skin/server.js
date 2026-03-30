const path = require('path');
const express = require('express');
const app = require('./api/index');

// Serve static files from project root (index.html lives here)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Know Your Skin — Sevyn8`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Haut.AI:    ${process.env.HAUT_AI_EMAIL ? '✓ Live' : '✗ Demo mode'}`);
  console.log(`  Weather:    ${process.env.TOMORROW_IO_KEY ? '✓ Live' : '✗ Demo mode'}`);
  console.log(`  Pollution:  ${process.env.IQAIR_KEY ? '✓ Live' : '✗ Demo mode'}\n`);
});
