import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { Message } from '@/lib/types';

// Ensure the API key is available
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      console.error('Server: GEMINI_API_KEY environment variable is not set. Please add it to your .env.local file. It should typically start with "sk-".');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Please configure your environment variables in .env.local. Ensure it is a valid Gemini API key (usually starting with "sk-").' },
        { status: 500 }
      );
    }

    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (initError) {
      console.error('Server: Error initializing GoogleGenerativeAI:', initError);
      return NextResponse.json(
        { error: 'Failed to initialize AI client. Check GEMINI_API_KEY validity and format.', details: (initError as Error).message },
        { status: 500 }
      );
    }

    const { messages, modelName } = await req.json();
    console.log('Server: Received messages from client:', messages);
    console.log('Server: Using model:', modelName);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }
    if (!modelName) {
      return NextResponse.json({ error: 'No model name provided.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: "You are a helpful assistant. Provide all responses in strictly PLAIN TEXT only. Do NOT use any Markdown formatting, such as bold (**), italics (*), headers (#), or lists (- or *). Use only normal characters and line breaks. If you need to emphasize something, just use plain words."
    });

    const lastUserMessageContent = messages[messages.length - 1].content;
    const history = messages.slice(0, -1).map((msg: Message) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
    console.log('Server: Formatted history for Gemini:', history);

    const chat = model.startChat({
      history: history,
      generationConfig: {
        // The maxOutputTokens is already set to 8192 as recommended.
        // If you are still encountering MAX_TOKENS errors, please ensure your GEMINI_API_KEY is valid and has appropriate permissions.
        maxOutputTokens: 8192,
      },
    });

    console.log('Server: Sending last user message to Gemini:', lastUserMessageContent);

    const result = await chat.sendMessage(lastUserMessageContent);
    console.log('Server: Raw result from Gemini:', JSON.stringify(result, null, 2));

    const geminiResponse = result.response;

    const text = geminiResponse.text();

    console.log('Server: Extracted text from Gemini response using .text():', text);

    if (!text || text.trim() === '') {
      console.warn('Server: Gemini response text is empty or whitespace-only after calling .text(). This indicates the AI model did not generate content.');
      return NextResponse.json({ content: 'The AI model did not generate any content. This might be due to content filtering, an invalid API key, or other issues. Please check server logs for more details.' });
    }

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Server: Error calling Gemini API:', error);
    return NextResponse.json(
      { error: 'Failed to get response from AI.', details: (error as Error).message, stack: (error as Error).stack },
      { status: 500 }
    );
  }
}