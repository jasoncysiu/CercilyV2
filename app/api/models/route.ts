import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function GET() {
  try {
    const models = await genAI.listModels();
    const modelNames = models.map(model => ({
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit,
      supportedGenerationMethods: model.supportedGenerationMethods,
    }));
    
    return NextResponse.json(modelNames);
  } catch (error) {
    console.error('Error listing Gemini models:', error);
    return NextResponse.json(
      { error: 'Failed to list models.', details: (error as Error).message },
      { status: 500 }
    );
  }
}