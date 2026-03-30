const { buildAdvisory } = require('./_lib');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { skinType, concerns, weather, pollution, forecast } = req.body || {};
  res.json({ advisory: buildAdvisory(skinType, concerns, weather, pollution, forecast) });
};
