import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { Message } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { messages, modelName, apiKey, projectContext } = await req.json();

    // Use provided API key or fall back to environment variable
    const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'No API key provided. Please add your Gemini API key in Settings.' },
        { status: 400 }
      );
    }

    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (initError) {
      console.error('Server: Error initializing GoogleGenerativeAI:', initError);
      return NextResponse.json(
        { error: 'Failed to initialize AI client. Check your API key validity.', details: (initError as Error).message },
        { status: 500 }
      );
    }
    console.log('Server: Received messages from client:', messages);
    console.log('Server: Using model:', modelName);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }
    if (!modelName) {
      return NextResponse.json({ error: 'No model name provided.' }, { status: 400 });
    }

    // Build system instruction with optional project context
    let systemInstruction = "You are a helpful assistant. Provide all responses in strictly PLAIN TEXT only. Do NOT use any Markdown formatting, such as bold (**), italics (*), headers (#), or lists (- or *). Use only normal characters and line breaks. If you need to emphasize something, just use plain words.";

    if (projectContext) {
      systemInstruction += `\n\nProject Context (use this as background information for all responses):\n${projectContext}`;
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
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