import { NextResponse } from 'next/server';
import { getChats, createChat } from '@/lib/notion';

export async function GET() {
  try {
    const chats = await getChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { projectId, title } = await request.json();
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }
    const result = await createChat(projectId, title || 'New Chat');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
