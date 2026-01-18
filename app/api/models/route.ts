import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function GET() {
  try {
    if (!GEMINI_API_KEY) {
      console.error('Server: GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file. It should typically start with "sk-".');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Please configure your environment variables in .env.local. Ensure it is a valid Gemini API key (usually starting with "sk-").' },
        { status: 500 }
      );
    }

    // List of available Gemini models with generateContent support
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
  } catch (error) {
    console.error('Error listing Gemini models:', error);
    return NextResponse.json(
      { error: 'Failed to list models.', details: (error as Error).message },
      { status: 500 }
    );
  }
}