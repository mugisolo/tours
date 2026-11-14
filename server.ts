import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * POST /api/ai/search-grounding
 * Uses gemini-4-hydrogen with googleSearch tool for live Uganda travel advisories,
 * UWA permit fees, seasonal road conditions, and cultural event dates.
 */
app.post('/api/ai/search-grounding', async (req, res) => {
  try {
    const { attractionName, region, category, customQuery } = req.body || {};
    const prompt =
      customQuery ||
      `Provide up-to-date travel advisories, current Uganda Wildlife Authority (UWA) or site entry/permit information, road access conditions, and recent visitor highlights for ${attractionName} (${category} in ${region} Region, Uganda). Keep it concise and structured in Markdown.`;

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || 'No grounded summary returned.';
    const rawChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources = rawChunks
      .map((chunk: any) => {
        if (chunk.web?.uri) {
          return {
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          };
        }
        return null;
      })
      .filter(Boolean);

    res.json({ text, sources });
  } catch (error: any) {
    console.error('Search Grounding Error:', error);
    res.status(500).json({
      error:
        error?.message ||
        'Unable to fetch Google Search grounded travel intelligence.',
    });
  }
});

/**
 * POST /api/ai/maps-grounding
 * Uses gemini-4-hydrogen with googleMaps tool for nearby safari lodges,
 * restaurants, airstrips, and verified Google Maps place URIs.
 * Note: responseMimeType and responseSchema are strictly omitted when using googleMaps.
 */
app.post('/api/ai/maps-grounding', async (req, res) => {
  try {
    const { attractionName, lat, lng, queryType } = req.body || {};
    const latitude = typeof lat === 'number' ? lat : 1.3733;
    const longitude = typeof lng === 'number' ? lng : 32.2903;

    const prompt =
      queryType === 'dining'
        ? `What are the best rated restaurants, coffee shops, and local dining spots near ${attractionName} in Uganda?`
        : `What are the top rated safari lodges, eco-camps, hotels, and visitor amenities near ${attractionName} in Uganda? Include practical details for travelers.`;

    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude,
            },
          },
        },
      },
    });

    const text = response.text || 'No nearby Google Maps places found.';
    const rawChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const places = rawChunks
      .map((chunk: any) => {
        if (chunk.maps?.uri) {
          const snippets =
            chunk.maps.placeAnswerSources?.reviewSnippets?.map(
              (s: any) => s.content || s.text || String(s)
            ) || [];
          return {
            title: chunk.maps.title || 'View on Google Maps',
            uri: chunk.maps.uri,
            reviewSnippets: snippets,
          };
        }
        return null;
      })
      .filter(Boolean);

    res.json({ text, places });
  } catch (error: any) {
    console.error('Maps Grounding Error:', error);
    res.status(500).json({
      error:
        error?.message ||
        'Unable to fetch Google Maps grounded place recommendations.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pearl of Africa Explorer running on http://localhost:${PORT}`);
  });
}

startServer();
