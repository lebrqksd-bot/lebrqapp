// Generate event images using Replicate with a reference auditorium image
// Usage: node scripts/generate-images-replicate.mjs assets/images/auditorium.jpg
// Requires: set REPLICATE_API_TOKEN environment variable

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error('Missing REPLICATE_API_TOKEN. Set it in your environment.');
  process.exit(1);
}

const refImagePath = process.argv[2];
if (!refImagePath) {
  console.error('Please provide the reference image path, e.g. assets/images/auditorium.jpg');
  process.exit(1);
}

const absRef = path.resolve(process.cwd(), refImagePath);
if (!fs.existsSync(absRef)) {
  console.error('Reference image not found:', absRef);
  process.exit(1);
}

// Minimal Replicate client using fetch to avoid extra deps
const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// Map of event IDs to prompts
const items = [
  { id: 't1', filename: 't1.jpg', prompt: 'Birthday celebration on indoor auditorium stage, balloons, cake table at center, warm festoon lighting, wide shot from audience, photorealistic, high quality' },
  { id: 't2', filename: 't2.jpg', prompt: 'Corporate conference on auditorium stage, podium and projector screen with charts, cool white lighting, professional ambiance, photorealistic, high quality' },
  { id: 't3', filename: 't3.jpg', prompt: 'Kids painting workshop on stage with easels and colorful artwork, playful decor, bright colors, photorealistic, high quality' },
  { id: 'r1', filename: 'r1.jpg', prompt: 'Energetic Zumba dance performance on stage, vibrant lights, dynamic motion, neon accents, photorealistic, high quality' },
  { id: 'r2', filename: 'r2.jpg', prompt: 'Calm yoga session on stage with mats, soft spotlights, serene minimalist scene, photorealistic, high quality' },
  { id: 'r3', filename: 'r3.jpg', prompt: 'Chess club on stage with chess boards on tables, focused lighting, elegant academic ambiance, photorealistic, high quality' },
  { id: 'r4', filename: 'r4.jpg', prompt: 'Pottery wheel demonstration on stage, clay, tools, warm lighting, earthy tones, photorealistic, high quality' },
];

const outDir = path.resolve(__dirname, '..', 'assets', 'images', 'generated');
fs.mkdirSync(outDir, { recursive: true });

// You can choose a model that supports image-to-image with a reference. Many SDXL IP-Adapter pipelines exist.
// Example community model slug (subject to change). Replace if you have a preferred one.
const model = 'fofr/ip-adapter-sdxl:2ec8a1d5b3a8c3c6c3a7d9b8f5c839c6a6c1b3ea4b0c68ad2a0f1b5f2b3c9d1a';

async function createPrediction(input) {
  const res = await fetch(REPLICATE_API, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: model,
      input,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate request failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getPrediction(id) {
  const url = `${REPLICATE_API}/${id}`;
  while (true) {
    const res = await fetch(url, {
      headers: { 'Authorization': `Token ${token}` },
    });
    if (!res.ok) throw new Error(`Replicate poll failed: ${res.status}`);
    const data = await res.json();
    if (data.status === 'succeeded') return data;
    if (data.status === 'failed' || data.status === 'canceled') throw new Error(`Prediction ${data.status}`);
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function fileToDataUrl(p) {
  const b = fs.readFileSync(p);
  const base64 = b.toString('base64');
  const ext = path.extname(p).replace('.', '') || 'jpg';
  return `data:image/${ext};base64,${base64}`;
}

async function run() {
  const refDataUrl = await fileToDataUrl(absRef);

  for (const item of items) {
    console.log(`Generating ${item.id}...`);
    // Model inputs vary by pipeline; IP-Adapter style inputs are often named like:
    // image (initial image), image_prompt or style_image, prompt, strength/guidance
    const input = {
      prompt: item.prompt,
      image: refDataUrl, // using your auditorium as the reference
      strength: 0.35, // keep stage structure while allowing subject change
      guidance_scale: 7,
      num_inference_steps: 30,
    };

    const pred = await createPrediction(input);
    const done = await getPrediction(pred.id);
    const outputs = done.output || [];
    if (!outputs.length) {
      console.warn('No outputs for', item.id);
      continue;
    }
    // Save first image
    const url = outputs[0];
    const imgRes = await fetch(url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const outPath = path.join(outDir, item.filename);
    fs.writeFileSync(outPath, buf);
    console.log('Saved', outPath);
  }

  console.log('All done. Update constants to point to generated images if needed.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
