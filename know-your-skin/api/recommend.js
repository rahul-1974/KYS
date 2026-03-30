const { recommend } = require('./_lib');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { skinType, concerns, hydration, oiliness, weather, pollution } = req.body || {};
  res.json({ recommendations: recommend(skinType, concerns, hydration, oiliness, weather, pollution) });
};
