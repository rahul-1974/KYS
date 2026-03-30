const { analyzeSkin, demoSkin } = require('./_lib');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const result = await analyzeSkin(req.body?.image_base64);
    res.json(result);
  } catch (err) {
    console.error('analyze-skin error:', err.message);
    res.json(demoSkin());
  }
};
