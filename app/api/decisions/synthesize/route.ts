import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { Block, Connection, SynthesisResult, BlockColor } from '@/lib/types';

interface CanvasData {
  projectId: string;
  projectName: string;
  nodes: {
    id: string;
    content: string;
    color: BlockColor;
  }[];
  connections: {
    fromId: string;
    toId: string;
    fromContent: string;
    toContent: string;
  }[];
}

const SYNTHESIS_PROMPT = `You are analyzing a user's thinking canvas to help them commit to a decision.

PROJECT: {{projectName}}

NODES ON CANVAS:
{{nodes}}

CONNECTIONS BETWEEN NODES:
{{connections}}

Based on this canvas, generate a decision summary. Analyze the content and relationships to understand what the user is trying to decide.

Your response must be VALID JSON with this exact structure:
{
  "question": "The main decision question the user is facing (one clear question)",
  "options": [
    {
      "name": "Option name",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"]
    }
  ],
  "leaning": "What option they seem to be leaning toward based on their notes",
  "keyReasoning": [
    {
      "point": "A key insight or reasoning point from their nodes",
      "nodeId": "the-node-id-this-came-from"
    }
  ],
  "unresolved": ["Question or concern they haven't fully addressed"]
}

Guidelines:
1. DECISION QUESTION: Infer the core decision from their notes. Make it a clear, answerable question.
2. OPTIONS: Identify 2-4 distinct options they've explored. Extract pros/cons from their notes.
3. LEANING: Based on tone and emphasis in their notes, what do they seem to favor?
4. KEY REASONING: Quote or paraphrase 3-5 most important points. Include the nodeId for each.
5. UNRESOLVED: Identify 1-3 questions or concerns they haven't addressed.

If the canvas doesn't clearly represent a decision (e.g., it's just notes or brainstorming), still try to identify:
- What they're thinking about (turn into a question format)
- Different aspects or angles they've considered (as options)
- Key insights from their notes

Respond ONLY with valid JSON. No explanations before or after.`;

function formatNodesForPrompt(nodes: CanvasData['nodes']): string {
  return nodes.map(n => `- [${n.color.toUpperCase()}] (id: ${n.id}) ${n.content}`).join('\n');
}

function formatConnectionsForPrompt(connections: CanvasData['connections']): string {
  if (connections.length === 0) return 'No explicit connections between nodes.';
  return connections.map(c => `- "${c.fromContent.substring(0, 50)}..." → "${c.toContent.substring(0, 50)}..."`).join('\n');
}

export async function POST(req: Request) {
  try {
    const { canvasData, apiKey, modelName } = await req.json() as {
      canvasData: CanvasData;
      apiKey?: string;
      modelName?: string;
    };

    // Use provided API key or fall back to environment variable
    const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'No API key provided. Please add your Gemini API key in Settings.' },
        { status: 400 }
      );
    }

    if (!canvasData || !canvasData.nodes || canvasData.nodes.length < 3) {
      return NextResponse.json(
        { error: 'Canvas must have at least 3 nodes to synthesize a decision.' },
        { status: 400 }
      );
    }

    let genAI: GoogleGenerativeAI;
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    } catch (initError) {
      console.error('Error initializing GoogleGenerativeAI:', initError);
      return NextResponse.json(
        { error: 'Failed to initialize AI client. Check your API key validity.', details: (initError as Error).message },
        { status: 500 }
      );
    }

    const selectedModel = modelName || 'models/gemini-2.0-flash';
    const model = genAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    });

    // Build the prompt
    const prompt = SYNTHESIS_PROMPT
      .replace('{{projectName}}', canvasData.projectName)
      .replace('{{nodes}}', formatNodesForPrompt(canvasData.nodes))
      .replace('{{connections}}', formatConnectionsForPrompt(canvasData.connections));

    console.log('Synthesis prompt:', prompt);

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Raw AI response:', text);

    // Parse the JSON response
    let synthesis: SynthesisResult;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      synthesis = JSON.parse(jsonMatch[0]);

      // Add node colors to keyReasoning
      synthesis.keyReasoning = synthesis.keyReasoning.map(r => {
        const node = canvasData.nodes.find(n => n.id === r.nodeId);
        return {
          ...r,
          nodeColor: node?.color,
        };
      });

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw text was:', text);

      // Return a fallback synthesis based on the canvas data
      synthesis = {
        question: `What should I decide about ${canvasData.projectName}?`,
        options: [],
        leaning: '',
        keyReasoning: canvasData.nodes.slice(0, 5).map(n => ({
          point: n.content.substring(0, 100),
          nodeId: n.id,
          nodeColor: n.color,
        })),
        unresolved: ['AI was unable to fully analyze your canvas. Please review manually.'],
      };
    }

    return NextResponse.json({ synthesis });
  } catch (error) {
    console.error('Error in decision synthesis:', error);
    return NextResponse.json(
      { error: 'Failed to synthesize decision.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
