import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function GET() {
  try {
    if (!GEMINI_API_KEY) {
      console.error('Server: GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file.');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Please configure your environment variables.' },
        { status: 500 }
      );
    }

    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (initError) {
      console.error('Server: Error initializing GoogleGenerativeAI for models:', initError);
      return NextResponse.json(
        { error: 'Failed to initialize AI client for models. Check GEMINI_API_KEY validity.', details: (initError as Error).message },
        { status: 500 }
      );
    }

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