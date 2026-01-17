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
    console.log('Server: Received messages from client:', messages);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Extract the last user message and the preceding history
    const lastUserMessageContent = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map((msg: Message) => ({
      role: msg.role === 'user' ? 'user' : 'model', // Gemini expects 'user' or 'model'
      parts: [{ text: msg.content }],
    }));
    console.log('Server: Formatted history for Gemini:', history);

    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    console.log('Server: Sending last user message to Gemini:', lastUserMessageContent);
    
    const result = await chat.sendMessage(lastUserMessageContent);
    console.log('Server: Raw result from Gemini:', JSON.stringify(result, null, 2));

    const geminiResponse = result.response; // This is the object containing candidates
    
    // Check if response is valid and has candidates
    if (!geminiResponse || !geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      console.error('Server: Gemini response object is invalid or missing candidates.');
      return NextResponse.json({ error: 'Invalid response from AI model: No candidates.' }, { status: 500 });
    }

    const firstCandidate = geminiResponse.candidates[0];

    // Check if the candidate has content and parts
    if (!firstCandidate.content || !firstCandidate.content.parts || firstCandidate.content.parts.length === 0) {
      console.warn('Server: Gemini candidate content is empty or missing parts.');
      return NextResponse.json({ content: 'No response from AI.' });
    }

    const text = firstCandidate.content.parts[0].text;

    if (!text) {
      console.warn('Server: Extracted text from Gemini response is empty.');
      return NextResponse.json({ content: 'No response from AI.' });
    }
    
    console.log('Server: Extracted text from Gemini response:', text);

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Server: Error calling Gemini API:', error);
    // Provide more details in the error response
    return NextResponse.json(
      { error: 'Failed to get response from AI.', details: (error as Error).message, stack: (error as Error).stack },
      { status: 500 }
    );
  }
}