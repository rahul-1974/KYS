const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================
// CONFIG — reads from Vercel environment variables
// ============================================================
const C = {
  HAUT_EMAIL: process.env.HAUT_AI_EMAIL || '',
  HAUT_PASS: process.env.HAUT_AI_PASSWORD || '',
  HAUT_COMPANY: process.env.HAUT_AI_COMPANY_ID || '',
  HAUT_DATASET: process.env.HAUT_AI_DATASET_ID || '',
  TOMORROW: process.env.TOMORROW_IO_KEY || '',
  IQAIR: process.env.IQAIR_KEY || '',
  HAUT_BASE: 'https://saas.haut.ai/api/v1',
};

// ============================================================
// HAUT.AI — Auth + Analysis Pipeline
// ============================================================
let hautToken = null;
let hautTokenExp = 0;

async function hautAuth() {
  if (hautToken && Date.now() < hautTokenExp) return hautToken;
  const r = await fetch(`${C.HAUT_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: C.HAUT_EMAIL, password: C.HAUT_PASS }),
  });
  const d = await r.json();
  hautToken = d.access_token;
  hautTokenExp = Date.now() + 3500000;
  return hautToken;
}

function hh(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

app.post('/api/analyze-skin', async (req, res) => {
  try {
    if (!C.HAUT_EMAIL) return res.json(demoSkin());

    const token = await hautAuth();
    const headers = hh(token);
    const base = `${C.HAUT_BASE}/companies/${C.HAUT_COMPANY}/datasets/${C.HAUT_DATASET}`;

    // 1. Create subject
    const sub = await (await fetch(`${base}/subjects/`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: `kys_${Date.now()}` }),
    })).json();

    // 2. Create batch
    const batch = await (await fetch(`${base}/subjects/${sub.id}/batches/`, {
      method: 'POST', headers,
    })).json();

    // 3. Upload image
    const imgB64 = req.body.image_base64;
    if (!imgB64) return res.json(demoSkin());

    const img = await (await fetch(`${base}/subjects/${sub.id}/batches/${batch.id}/images/`, {
      method: 'POST', headers,
      body: JSON.stringify({ image: imgB64, image_name: `selfie_${Date.now()}.jpg` }),
    })).json();

    // 4. Poll results (Haut.AI processes in ~3-8s)
    let results = null;
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 2500));
      const rr = await fetch(
        `${base}/subjects/${sub.id}/batches/${batch.id}/images/${img.id}/results/`,
        { headers }
      );
      const rd = await rr.json();
      if (rd && Array.isArray(rd) && rd.length > 0) { results = rd; break; }
    }

    if (!results) return res.json({ ...demoSkin(), source: 'timeout' });

    res.json(parseHautResults(results));
  } catch (err) {
    console.error('Haut.AI error:', err.message);
    res.json(demoSkin());
  }
});

// ============================================================
// HAUT.AI Result Parser
// ============================================================
function parseHautResults(results) {
  const m = {};
  for (const r of results) {
    if (!r.result) continue;
    if (r.result.algorithms) {
      for (const a of r.result.algorithms) m[a.tech_name || a.algorithm_tech_name || ''] = a;
    } else {
      m[r.application_tech_name || r.algorithm_tech_name || ''] = r.result;
    }
  }

  const skinType = xCat(m, 'skin_type') || 'Combination';
  const skinTone = xCat(m, 'skin_tone') || 'Medium';
  const perceivedAge = xVal(m, 'perceived_age') || 28;
  const hydration = xVal(m, 'hydration') || 45;

  const concerns = [
    { name: 'Acne', score: xScore(m, 'acne'), tech: 'acne' },
    { name: 'Pigmentation', score: xScore(m, 'pigmentation'), tech: 'pigmentation' },
    { name: 'Open pores', score: xScore(m, 'pores'), tech: 'pores' },
    { name: 'Redness', score: xScore(m, 'redness'), tech: 'redness' },
    { name: 'Fine lines', score: xScore(m, 'lines'), tech: 'lines' },
    { name: 'Dark circles', score: xScore(m, 'eye_area_condition') || xScore(m, 'dark_circles'), tech: 'dark_circles' },
    { name: 'Uneven texture', score: 100 - (xScore(m, 'uniformness') || 70), tech: 'uniformness' },
  ]
    .filter(c => c.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(c => ({ ...c, severity: c.score > 65 ? 'Severe' : c.score > 40 ? 'Moderate' : 'Mild' }));

  const oilMap = { Oily: 78, Combination: 62, Normal: 45, Dry: 22 };

  return {
    source: 'haut_ai',
    skinType, skinTone,
    perceivedAge: Math.round(perceivedAge),
    hydration: Math.round(hydration),
    oiliness: oilMap[skinType] || 50,
    concerns,
  };
}

function xCat(m, key) {
  for (const [k, v] of Object.entries(m)) {
    if (k.includes(key)) {
      if (v?.main_metric?.value) return v.main_metric.value;
      if (v?.result?.main_metric?.value) return v.result.main_metric.value;
    }
  }
  return null;
}
function xVal(m, key) {
  for (const [k, v] of Object.entries(m)) {
    if (k.includes(key)) {
      if (v?.main_metric?.value !== undefined) return parseFloat(v.main_metric.value);
      if (v?.result?.main_metric?.value !== undefined) return parseFloat(v.result.main_metric.value);
    }
  }
  return null;
}
function xScore(m, key) {
  for (const [k, v] of Object.entries(m)) {
    if (k.includes(key)) {
      if (v?.main_metric?.value !== undefined) return parseFloat(v.main_metric.value) || 0;
      if (v?.sub_metrics) {
        for (const s of v.sub_metrics) {
          if (s.tech_name?.includes('score') || s.tech_name?.includes('severity'))
            return parseFloat(s.value) || 0;
        }
      }
    }
  }
  return 0;
}

// ============================================================
// WEATHER + POLLUTION (Tomorrow.io + IQAir)
// ============================================================
app.get('/api/environment', async (req, res) => {
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
    console.error('Env error:', err.message);
    res.json(demoEnv());
  }
});

async function getWeather(lat, lon) {
  if (!C.TOMORROW) return demoEnv().weather;
  const r = await fetch(`https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${C.TOMORROW}`);
  const d = await r.json();
  const v = d.data?.values || {};
  return {
    temperature: Math.round(v.temperature ?? 34),
    humidity: Math.round(v.humidity ?? 45),
    uvIndex: Math.round(v.uvIndex ?? 8),
    dewPoint: Math.round(v.dewPoint ?? 15),
  };
}

async function getPollution(lat, lon) {
  if (!C.IQAIR) return demoEnv().pollution;
  const r = await fetch(`https://api.airvisual.com/v2/nearest_city?lat=${lat}&lon=${lon}&key=${C.IQAIR}`);
  const d = await r.json();
  const p = d.data?.current?.pollution || {};
  return {
    aqi: p.aqius || 180,
    pm25: p.pm25 || 90,
    mainPollutant: p.mainus || 'p2',
    city: d.data?.city || 'Unknown',
  };
}

function buildForecast(lat, lon) {
  const month = new Date().getMonth();
  const isDelhiZone = lat > 25 && lat < 30 && lon > 75 && lon < 79;
  const isMumbaiZone = lat > 18 && lat < 20 && lon > 72 && lon < 73;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const forecast = [];

  for (let i = 1; i <= 3; i++) {
    const mi = (month + i) % 12;
    const mName = months[mi];
    let temp, humidity, uv, aqi, risk;

    if (isDelhiZone) {
      const dd = [
        { t:15,h:55,u:4,a:250,r:'Extreme pollution + cold dryness' },
        { t:20,h:45,u:5,a:200,r:'Pollution easing + dry skin risk' },
        { t:28,h:35,u:8,a:165,r:'Rising UV + moderate pollution' },
        { t:36,h:25,u:10,a:150,r:'UV damage + dehydration' },
        { t:42,h:20,u:11,a:140,r:'Extreme UV + severe dryness' },
        { t:36,h:65,u:8,a:110,r:'Monsoon humidity + fungal risk' },
        { t:33,h:80,u:6,a:95,r:'High humidity + excess sebum' },
        { t:32,h:82,u:6,a:90,r:'Peak humidity + breakout risk' },
        { t:32,h:65,u:7,a:120,r:'Post-monsoon + pollution rising' },
        { t:30,h:50,u:6,a:280,r:'Diwali pollution spike + dryness onset' },
        { t:22,h:45,u:4,a:350,r:'Severe pollution + barrier damage' },
        { t:16,h:55,u:3,a:300,r:'Winter smog + water loss' },
      ][mi];
      temp=dd.t; humidity=dd.h; uv=dd.u; aqi=dd.a; risk=dd.r;
    } else if (isMumbaiZone) {
      temp=[27,28,30,32,33,31,29,29,30,32,31,29][mi];
      humidity=[60,58,62,68,72,82,88,87,82,72,64,60][mi];
      uv=[7,8,9,10,10,8,6,6,8,8,7,6][mi];
      aqi=[90,85,95,100,95,70,55,50,65,110,120,100][mi];
      risk=['Moderate UV + coastal humidity','Rising UV + salt air','High UV + pre-monsoon dust','Extreme UV + heat','UV peak + dehydration','Monsoon + fungal risk','Peak humidity + breakouts','Humidity + bacterial risk','Post-monsoon transition','Pollution rise + humid','Moderate pollution + dry shift','Mild winter + coastal breeze'][mi];
    } else {
      temp=[25,27,30,33,35,30,28,28,29,29,27,25][mi];
      humidity=[50,45,40,35,40,65,75,78,70,60,50,50][mi];
      uv=[6,7,9,10,10,8,6,6,7,7,6,5][mi];
      aqi=[100,95,110,120,115,80,60,55,75,120,140,120][mi];
      risk='Seasonal change — check local conditions';
    }
    forecast.push({ month:mName, temp:`${temp}°C`, humidity:`${humidity}%`, uv, aqi, risk });
  }
  return forecast;
}

function skinImpact(w, p) {
  const fx = [];
  if (w.uvIndex >= 8) fx.push({ factor:'UV Radiation', level:'High', effect:'Accelerates pigmentation and collagen breakdown. SPF 50+ essential.' });
  else if (w.uvIndex >= 6) fx.push({ factor:'UV Radiation', level:'Moderate', effect:'Daily SPF 30+ recommended.' });
  if (w.humidity < 35) fx.push({ factor:'Low Humidity', level:'High', effect:'Trans-epidermal water loss. Heavier moisturizers needed.' });
  if (w.humidity > 70) fx.push({ factor:'High Humidity', level:'Moderate', effect:'Increases sebum production. Switch to gel-based products.' });
  if (p.aqi > 150) fx.push({ factor:'Air Pollution', level:'Severe', effect:'PM2.5 causes oxidative stress, inflammation, accelerated aging.' });
  else if (p.aqi > 100) fx.push({ factor:'Air Pollution', level:'Moderate', effect:'Anti-pollution serums recommended.' });
  if (w.temperature > 35) fx.push({ factor:'Heat Stress', level:'High', effect:'Disrupts skin pH. Use gentle cleansers.' });
  return fx;
}

// ============================================================
// PRODUCT RECOMMENDATIONS
// ============================================================
app.post('/api/recommend', (req, res) => {
  const { skinType, concerns, hydration, oiliness, weather, pollution } = req.body;
  res.json({ recommendations: recommend(skinType, concerns, hydration, oiliness, weather, pollution) });
});

function recommend(skinType, concerns=[], hydration=50, oiliness=50, weather={}, pollution={}) {
  const catalog = [
    { name:'Tea Tree Skin Clearing Facial Wash', price:845, cat:'cleanser', types:['Oily','Combination'], concerns:['acne','pores'], season:'all', antiPol:false, img:'🧴', desc:'Purifying wash with tea tree oil' },
    { name:'Camomile Silky Cleansing Oil', price:1295, cat:'cleanser', types:['Dry','Normal'], concerns:['dark_circles','lines'], season:'winter', antiPol:true, img:'🧴', desc:'Gentle oil cleanser for sensitive skin' },
    { name:'Vitamin E Gentle Facial Wash', price:795, cat:'cleanser', types:['Dry','Normal','Combination'], concerns:['uniformness','lines'], season:'all', antiPol:false, img:'🧴', desc:'Hydrating daily cleanser' },
    { name:'Vitamin C Glow-Revealing Serum', price:1995, cat:'serum', types:['all'], concerns:['pigmentation','uniformness'], season:'all', antiPol:true, img:'✨', desc:'Brightening serum with vitamin C' },
    { name:'Edelweiss Daily Serum Concentrate', price:2295, cat:'serum', types:['all'], concerns:['lines','pigmentation','redness'], season:'all', antiPol:true, img:'🛡', desc:'Anti-pollution barrier defense' },
    { name:'Tea Tree Anti-Imperfection Daily Solution', price:1195, cat:'serum', types:['Oily','Combination'], concerns:['acne','pores'], season:'all', antiPol:false, img:'💧', desc:'Targeted blemish treatment' },
    { name:'Vitamin E Overnight Serum-in-Oil', price:1795, cat:'serum', types:['Dry','Normal'], concerns:['lines','uniformness'], season:'winter', antiPol:false, img:'🌙', desc:'Intensive overnight repair' },
    { name:'Skin Defence Multi-Protection Lotion SPF50', price:1695, cat:'spf', types:['all'], concerns:['pigmentation','lines','redness'], season:'all', antiPol:true, img:'☀️', desc:'UV + pollution shield' },
    { name:'Vitamin C Glow-Protect Lotion SPF30', price:1495, cat:'spf', types:['all'], concerns:['pigmentation','uniformness'], season:'all', antiPol:false, img:'☀️', desc:'Lightweight daily UV protection' },
    { name:'Vitamin E Moisture Cream', price:1295, cat:'moisturizer', types:['Dry','Normal'], concerns:['lines','uniformness'], season:'winter', antiPol:false, img:'🫧', desc:'Rich daily hydration' },
    { name:'Tea Tree Mattifying Lotion', price:995, cat:'moisturizer', types:['Oily','Combination'], concerns:['acne','pores'], season:'summer', antiPol:false, img:'🫧', desc:'Oil-free lightweight moisture' },
    { name:'Aloe Soothing Day Cream', price:895, cat:'moisturizer', types:['Normal','Combination','Dry'], concerns:['redness','uniformness'], season:'all', antiPol:false, img:'🫧', desc:'Calming hydration' },
    { name:'Tea Tree Anti-Imperfection Night Mask', price:1295, cat:'night', types:['Oily','Combination'], concerns:['acne','pores'], season:'all', antiPol:false, img:'🌙', desc:'Overnight pore refinement' },
    { name:'Vitamin E Night Cream', price:1395, cat:'night', types:['Dry','Normal'], concerns:['lines','uniformness'], season:'all', antiPol:false, img:'🌙', desc:'Rich overnight moisture barrier' },
    { name:'Edelweiss Bouncy Sleeping Mask', price:1995, cat:'night', types:['all'], concerns:['lines','pigmentation'], season:'winter', antiPol:true, img:'🌙', desc:'Overnight anti-pollution recovery' },
    { name:'Vitamin E Eye Cream', price:1195, cat:'eye', types:['all'], concerns:['dark_circles','lines'], season:'all', antiPol:false, img:'👁', desc:'Depuffing and brightening eye care' },
    { name:'Himalayan Charcoal Purifying Clay Mask', price:1495, cat:'mask', types:['Oily','Combination'], concerns:['acne','pores'], season:'all', antiPol:true, img:'🎭', desc:'Deep cleansing detox mask' },
    { name:'British Rose Fresh Plumping Mask', price:1495, cat:'mask', types:['Dry','Normal'], concerns:['uniformness','lines'], season:'all', antiPol:false, img:'🌹', desc:'Hydrating plumping treatment' },
  ];

  const topTechs = concerns.slice(0,3).map(c => c.tech || c.name.toLowerCase().replace(/\s/g,'_'));
  const mo = new Date().getMonth();
  const season = mo>=3&&mo<=5?'summer':mo>=10||mo<=1?'winter':'all';
  const hiPol = pollution?.aqi > 120;
  const hiUV = weather?.uvIndex >= 7;

  const scored = catalog.map(p => {
    let s = 0;
    if (p.types.includes('all') || p.types.includes(skinType)) s += 40; else s -= 20;
    for (const c of topTechs) { if (p.concerns.includes(c)) s += 25; }
    if (hiPol && p.antiPol) { s += 15; if (pollution?.aqi>150) s += 10; }
    if (hiUV && p.cat==='spf') { s += 20; if (p.name.includes('SPF50')) s += 15; }
    if (season===p.season || p.season==='all') s += 10;
    if (season!==p.season && p.season!=='all') s -= 10;
    if (hydration<40 && ['Dry','Normal'].some(t=>p.types.includes(t))) s += 10;
    if (oiliness>65 && ['Oily','Combination'].some(t=>p.types.includes(t))) s += 10;
    const match = Math.min(98, Math.max(72, Math.round((s/195)*100 + 25)));
    return { ...p, score: Math.max(0,s), matchPct: match };
  });

  const routine = [];
  for (const cat of ['cleanser','serum','spf','moisturizer','night']) {
    const best = scored.filter(p=>p.cat===cat).sort((a,b)=>b.score-a.score)[0];
    if (best && best.score > 20) {
      let reason = '';
      for (const c of topTechs) {
        if (best.concerns.includes(c)) {
          reason = `Targets ${concerns.find(x=>(x.tech||x.name.toLowerCase())===c)?.name||c}`;
          break;
        }
      }
      if (!reason && best.antiPol && hiPol) reason = 'Pollution defense for high AQI';
      if (!reason && best.cat==='spf') reason = `Essential for UV index ${weather?.uvIndex||8}+`;
      if (!reason) reason = best.desc;
      routine.push({ name:best.name, price:`₹${best.price.toLocaleString('en-IN')}`, reason, img:best.img, match:best.matchPct, category:best.cat });
    }
  }

  const bonus = scored.filter(p=>['eye','mask'].includes(p.cat)).sort((a,b)=>b.score-a.score)[0];
  if (bonus && bonus.score > 30) {
    routine.push({ name:bonus.name, price:`₹${bonus.price.toLocaleString('en-IN')}`, reason:bonus.desc, img:bonus.img, match:bonus.matchPct, category:bonus.cat });
  }

  return routine.sort((a,b) => b.match - a.match);
}

// ============================================================
// SKIN ADVISORY
// ============================================================
app.post('/api/skin-advisory', (req, res) => {
  const { skinType, concerns, weather, pollution, forecast } = req.body;
  const top = concerns?.[0]?.name || 'general skin health';
  const city = pollution?.city || 'your city';

  let adv = `Your ${(skinType||'combination').toLowerCase()} skin is currently facing `;
  const st = [];
  if (weather?.uvIndex>=7) st.push(`high UV exposure (index ${weather.uvIndex}) which accelerates ${top.toLowerCase()}`);
  if (pollution?.aqi>120) st.push(`elevated air pollution (AQI ${pollution.aqi}) which breaks down your skin barrier`);
  if (weather?.humidity<35) st.push(`low humidity (${weather.humidity}%) causing trans-epidermal water loss`);
  if (weather?.humidity>70) st.push(`high humidity (${weather.humidity}%) increasing sebum production`);
  if (!st.length) st.push('moderate environmental conditions');
  adv += st.join(' and ') + '. ';

  if (forecast?.length >= 3) {
    adv += `Over the next 3 months: ${forecast[0].risk.toLowerCase()} in ${forecast[0].month}, `;
    adv += `${forecast[1].risk.toLowerCase()} in ${forecast[1].month}, `;
    adv += `and ${forecast[2].risk.toLowerCase()} in ${forecast[2].month}. `;
    adv += `Adjust your routine each month as ${city}'s seasons shift.`;
  }

  res.json({ advisory: adv });
});

// ============================================================
// DEMO DATA
// ============================================================
function demoSkin() {
  return {
    source:'demo', skinType:'Combination', skinTone:'Medium',
    perceivedAge:28, hydration:42, oiliness:68,
    concerns: [
      { name:'Pigmentation', score:62, severity:'Moderate', tech:'pigmentation' },
      { name:'Open pores', score:48, severity:'Moderate', tech:'pores' },
      { name:'Uneven texture', score:38, severity:'Mild', tech:'uniformness' },
      { name:'Dark circles', score:35, severity:'Mild', tech:'dark_circles' },
    ],
  };
}

function demoEnv() {
  return {
    weather: { temperature:34, humidity:45, uvIndex:9, dewPoint:15 },
    pollution: { aqi:186, pm25:92, mainPollutant:'p2', city:'New Delhi' },
    forecast: [
      { month:'Apr', temp:'38°C', humidity:'25%', uv:10, aqi:165, risk:'UV damage + dehydration' },
      { month:'May', temp:'42°C', humidity:'20%', uv:11, aqi:148, risk:'Extreme UV + dryness' },
      { month:'Jun', temp:'36°C', humidity:'65%', uv:8, aqi:112, risk:'Humidity surge + fungal risk' },
    ],
    skinImpact: [
      { factor:'UV Radiation', level:'High', effect:'Accelerates pigmentation. SPF 50+ essential.' },
      { factor:'Air Pollution', level:'Severe', effect:'PM2.5 causes oxidative stress and inflammation.' },
      { factor:'Low Humidity', level:'High', effect:'Accelerates trans-epidermal water loss.' },
    ],
  };
}

// Export for Vercel serverless
module.exports = app;
