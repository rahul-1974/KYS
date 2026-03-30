# Know Your Skin

AI-powered skin analysis for The Body Shop India.  
Built by [Sevyn8](https://sevyn8.com).

---

## What It Does

1. Customer takes a guided selfie in the browser (no app install)
2. Haut.AI analyzes skin type, hydration, acne, pigmentation, pores, lines
3. Tomorrow.io + IQAir fetch real-time weather and pollution for their city
4. Recommendation engine matches Body Shop products to their specific skin + environment
5. 3-month seasonal forecast shows how their routine should change

---

## Project Structure

```
know-your-skin/
├── api/
│   └── index.js          # Express API (runs as Vercel serverless function)
├── public/
│   └── index.html         # Frontend (camera, results, recommendations)
├── server.js              # Local dev server
├── vercel.json            # Vercel routing config
├── package.json
├── .env.example
└── .gitignore
```

---

## Step-by-Step: Local Development

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/know-your-skin.git
cd know-your-skin
npm install
```

### 2. Add your API keys

```bash
cp .env.example .env
```

Open `.env` and paste your keys:

```
TOMORROW_IO_KEY=paste-your-tomorrow-io-key-here
IQAIR_KEY=paste-your-iqair-key-here
```

(Haut.AI keys are optional — without them, skin analysis uses demo data.
Weather and pollution will be live.)

### 3. Run locally

```bash
npm start
```

Open `http://localhost:3000` on your phone or browser.

---

## Step-by-Step: Deploy to Vercel

### 1. Push to GitHub

```bash
cd know-your-skin
git init
git add .
git commit -m "Know Your Skin v1"
git remote add origin https://github.com/YOUR_USERNAME/know-your-skin.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub sign-in is easiest)
2. Click **"Add New..."** → **"Project"**
3. Select your `know-your-skin` repository
4. Vercel auto-detects the project — click **"Deploy"**
5. Wait ~30 seconds. Your app is now live at `know-your-skin-xxxxx.vercel.app`

### 3. Add Environment Variables

This is where you paste your API keys:

1. In Vercel, go to your project → **Settings** → **Environment Variables**
2. Add each variable one by one:

| Name | Value | Environment |
|------|-------|-------------|
| `TOMORROW_IO_KEY` | your-tomorrow-io-key | Production, Preview, Development |
| `IQAIR_KEY` | your-iqair-key | Production, Preview, Development |
| `HAUT_AI_EMAIL` | your-haut-ai-email | Production, Preview, Development |
| `HAUT_AI_PASSWORD` | your-haut-ai-password | Production, Preview, Development |
| `HAUT_AI_COMPANY_ID` | your-company-uuid | Production, Preview, Development |
| `HAUT_AI_DATASET_ID` | your-dataset-uuid | Production, Preview, Development |

3. Click **"Save"** after each one
4. Go to **Deployments** → click the **"..."** menu on the latest deployment → **"Redeploy"**
5. Your app now uses live API data

### 4. Add Custom Domain

1. In Vercel, go to your project → **Settings** → **Domains**
2. Type `knowyourskin.sevyn8.com` (or whatever you prefer) → click **Add**
3. Vercel shows you a DNS record to add. Go to your domain registrar:
   - Add a **CNAME** record: `knowyourskin` → `cname.vercel-dns.com`
4. Wait 1-5 minutes for DNS propagation
5. SSL certificate is automatic — your site is now live at `https://knowyourskin.sevyn8.com`

### 5. Create a Short URL (Optional)

If you prefer a Bitly link for the demo meeting:

1. Go to [bitly.com](https://bitly.com)
2. Paste your Vercel URL
3. Customize the back-half: `bit.ly/knowyourskin`

---

## API Endpoints

All endpoints live under `/api/`:

| Endpoint | Method | What It Does |
|----------|--------|-------------|
| `/api/analyze-skin` | POST | Send `{ image_base64 }` → Haut.AI → skin profile |
| `/api/environment` | GET | `?lat=28.6&lon=77.2` → live weather + AQI + 3-month forecast |
| `/api/recommend` | POST | Skin profile + environment → Body Shop product routine |
| `/api/skin-advisory` | POST | Skin + environment → plain-language skin advisory |

---

## What's Live vs Demo

| API | With Key | Without Key |
|-----|----------|-------------|
| **Tomorrow.io** | Real-time temperature, UV, humidity, dew point | Hardcoded Delhi summer data |
| **IQAir** | Real-time AQI, PM2.5, city name | Hardcoded Delhi AQI 186 |
| **Haut.AI** | Real skin analysis from selfie | Demo: Combination skin, pigmentation concern |

Weather + pollution go live immediately with your keys.  
Haut.AI goes live once you have credentials from their sales team.

---

## Haut.AI Setup (When Ready)

1. Log in to [saas.haut.ai](https://saas.haut.ai)
2. Copy your **Company ID** from the dashboard
3. Create a **Dataset** → copy the Dataset ID
4. Attach **Face Metrics 2.0** application to the dataset
5. (Optional) Attach **Face Skin Analysis 3.0** for enhanced metrics
6. Add all 4 credentials to Vercel environment variables
7. Redeploy

### Image Requirements for Haut.AI
- Minimum 2500×2500px (the guided selfie captures at 2560px)
- Face must occupy 85%+ of the frame
- Frontal, eyes open, neutral expression, no glasses

---

## Important Notes

- **Vercel free tier** has a 10-second function timeout. Haut.AI polling
  can take up to 30 seconds. If you're on the free tier and Haut.AI times
  out, the app gracefully falls back to demo data. Upgrading to Vercel Pro
  ($20/month) gives you a 60-second timeout which handles Haut.AI reliably.
  Weather + pollution always work fine on free tier.

- **No Claude/Anthropic references** anywhere in the codebase or frontend.
  The app looks 100% like a Sevyn8 product.

- **CORS is enabled** so the API works from any origin during development.

---

Built by Sevyn8 — AI at Edge Solutions for Retail
