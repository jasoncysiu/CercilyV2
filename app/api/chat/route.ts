import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { Message } from '@/lib/types';

// Ensure the API key is available
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // Initialize the model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' }); // Changed model name here

    // Format messages for Gemini API
    // Gemini expects alternating user/model roles.
    // The first message must be from 'user'.
    const history = messages.map((msg: Message) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Start a chat session with the history
    const chat = model.startChat({
      history: history.slice(0, -1), // All messages except the last one (which is the current user input)
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    // Send the latest user message
    const lastUserMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return NextResponse.json({ error: 'Failed to get response from AI.' }, { status: 500 });
  }
}