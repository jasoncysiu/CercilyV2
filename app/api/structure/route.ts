import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
    try {
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
        }

        const { items } = await req.json();
        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid items provided' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
      I have a list of information items extracted from a conversation.
      Please organize these items into a single, well-structured Markdown table.
      The table should have logical headers (e.g., "Category", "Key Point", "Description") based on the content.
      
      Items:
      ${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}
      
      Return ONLY the Markdown table. Do not include any extra text.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ table: text });
    } catch (error) {
        console.error('Error in structure API:', error);
        return NextResponse.json({ error: 'Failed to structure items' }, { status: 500 });
    }
}
