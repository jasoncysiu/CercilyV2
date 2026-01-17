import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { Message } from '@/lib/types';

// Ensure the API key is available
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

    const { messages, modelName } = await req.json(); // Destructure modelName
    console.log('Server: Received messages from client:', messages);
    console.log('Server: Using model:', modelName);

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }
    if (!modelName) {
      return NextResponse.json({ error: 'No model name provided.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: modelName }); // Use the provided modelName

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
        maxOutputTokens: 8192, // Increased maxOutputTokens as per your suggestion
      },
    });

    console.log('Server: Sending last user message to Gemini:', lastUserMessageContent);
    
    const result = await chat.sendMessage(lastUserMessageContent);
    console.log('Server: Raw result from Gemini:', JSON.stringify(result, null, 2));

    const geminiResponse = result.response; // This is the object containing candidates

    // Use the .text() method provided by the SDK to get the aggregated text
    const text = geminiResponse.text(); 
    
    console.log('Server: Extracted text from Gemini response using .text():', text);

    if (!text || text.trim() === '') {
      console.warn('Server: Gemini response text is empty or whitespace-only after calling .text(). This indicates the AI model did not generate content.');
      return NextResponse.json({ content: 'The AI model did not generate any content. Please check your API key and model configuration.' });
    }
    
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