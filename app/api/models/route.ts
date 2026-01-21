import { NextResponse } from 'next/server';

export async function GET() {
  // Static list of available Gemini models
  // API key validation happens at chat time, not here
  const modelNames = [
    {
      name: 'models/gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      description: 'Latest Gemini model with advanced capabilities',
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent'],
    },
    {
      name: 'models/gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      description: 'Fast and efficient Gemini model',
      inputTokenLimit: 1000000,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent'],
    },
  ];

  return NextResponse.json(modelNames);
}
