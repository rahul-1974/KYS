const { getWeather, getPollution, buildForecast, skinImpact, demoEnv } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });

  try {
    const [weather, pollution] = await Promise.all([
      getWeather(parseFloat(lat), parseFloat(lon)),
      getPollution(parseFloat(lat), parseFloat(lon)),
    ]);
    const forecast = buildForecast(parseFloat(lat), parseFloat(lon));
    res.json({ weather, pollution, forecast, skinImpact: skinImpact(weather, pollution) });
  } catch (err) {
    console.error('environment error:', err.message);
    res.json(demoEnv());
  }
};
