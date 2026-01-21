import { ChatData, Project } from './types';

const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!;
const CHATS_DB_ID = process.env.NOTION_CHATS_DB_ID!;

const headers = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

// Helper to safely extract text from Notion rich text (handles chunked data)
function extractText(richText: any[]): string {
  return richText?.map((t: any) => t.plain_text).join('') || '';
}

// Helper to chunk text into 2000-char segments for Notion rich_text (max 100 chunks)
function chunkText(text: string, chunkSize = 2000, maxChunks = 100): { text: { content: string } }[] {
  const chunks: { text: { content: string } }[] = [];
  const maxLength = chunkSize * maxChunks;
  const truncated = text.slice(0, maxLength);

  for (let i = 0; i < truncated.length; i += chunkSize) {
    chunks.push({ text: { content: truncated.slice(i, i + chunkSize) } });
  }

  return chunks.length > 0 ? chunks : [{ text: { content: '' } }];
}

// Helper to safely parse JSON from text field
function parseJson<T>(text: string, fallback: T): T {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

// ============== PROJECTS ==============

export async function getProjects(): Promise<Record<string, Project>> {
  const response = await fetch(`https://api.notion.com/v1/databases/${PROJECTS_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  const data = await response.json();
  const projects: Record<string, Project> = {};

  for (const page of data.results) {
    const props = page.properties;
    const id = page.id;
    const title = extractText(props.Title?.title) || 'Untitled';
    const context = extractText(props.Context?.rich_text) || '';

    // Get chats for this project
    const chatsResponse = await fetch(`https://api.notion.com/v1/databases/${CHATS_DB_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Project',
          relation: {
            contains: id,
          },
        },
      }),
    });

    const chatsData = await chatsResponse.json();
    const chatIds = chatsData.results.map((chat: any) => chat.id);

    projects[id] = {
      id,
      title,
      chatIds,
      context,
    };
  }

  return projects;
}

export async function createProject(title: string, context?: string): Promise<Project> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: PROJECTS_DB_ID },
      properties: {
        Title: {
          title: [{ text: { content: title } }],
        },
        Context: {
          rich_text: [{ text: { content: context || '' } }],
        },
        'Created At': {
          date: { start: new Date().toISOString() },
        },
        'Updated At': {
          date: { start: new Date().toISOString() },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create project: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    title,
    chatIds: [],
    context: context || '',
  };
}

export async function updateProject(id: string, data: { title?: string; context?: string }): Promise<void> {
  const properties: any = {
    'Updated At': {
      date: { start: new Date().toISOString() },
    },
  };

  if (data.title !== undefined) {
    properties.Title = {
      title: [{ text: { content: data.title } }],
    };
  }

  if (data.context !== undefined) {
    properties.Context = {
      rich_text: [{ text: { content: data.context.slice(0, 2500) } }],
    };
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update project: ${response.statusText}`);
  }
}

export async function deleteProject(id: string): Promise<void> {
  // First, delete all chats in this project
  const chatsResponse = await fetch(`https://api.notion.com/v1/databases/${CHATS_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filter: {
        property: 'Project',
        relation: {
          contains: id,
        },
      },
    }),
  });

  const chatsData = await chatsResponse.json();

  for (const chat of chatsData.results) {
    await fetch(`https://api.notion.com/v1/pages/${chat.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ archived: true }),
    });
  }

  // Then archive the project
  await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ archived: true }),
  });
}

// ============== CHATS ==============

export async function getChats(): Promise<Record<string, ChatData & { id: string; projectId?: string }>> {
  const response = await fetch(`https://api.notion.com/v1/databases/${CHATS_DB_ID}/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chats: ${response.statusText}`);
  }

  const data = await response.json();
  const chats: Record<string, ChatData & { id: string; projectId?: string }> = {};

  for (const page of data.results) {
    const props = page.properties;
    const id = page.id;
    const title = extractText(props.Title?.title) || 'Untitled';
    const preview = extractText(props.Preview?.rich_text) || '';
    const messagesJson = extractText(props.Messages?.rich_text);
    const blocksJson = extractText(props.Blocks?.rich_text);
    const connectionsJson = extractText(props.Connections?.rich_text);
    const highlightsJson = extractText(props.Highlights?.rich_text);
    const projectRelation = props.Project?.relation;
    const projectId = projectRelation?.[0]?.id;

    chats[id] = {
      id,
      projectId,
      title,
      preview,
      messages: parseJson(messagesJson, []),
      blocks: parseJson(blocksJson, []),
      connections: parseJson(connectionsJson, []),
      highlights: parseJson(highlightsJson, []),
    };
  }

  return chats;
}

export async function createChat(
  projectId: string,
  title: string
): Promise<{ id: string; chatData: ChatData }> {
  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parent: { database_id: CHATS_DB_ID },
      properties: {
        Title: {
          title: [{ text: { content: title } }],
        },
        Preview: {
          rich_text: [{ text: { content: 'Empty chat...' } }],
        },
        Project: {
          relation: [{ id: projectId }],
        },
        Messages: {
          rich_text: [{ text: { content: '[]' } }],
        },
        Blocks: {
          rich_text: [{ text: { content: '[]' } }],
        },
        Connections: {
          rich_text: [{ text: { content: '[]' } }],
        },
        Highlights: {
          rich_text: [{ text: { content: '[]' } }],
        },
        'Created At': {
          date: { start: new Date().toISOString() },
        },
        'Updated At': {
          date: { start: new Date().toISOString() },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    chatData: {
      title,
      preview: 'Empty chat...',
      messages: [],
      blocks: [],
      connections: [],
      highlights: [],
    },
  };
}

export async function updateChat(
  id: string,
  data: Partial<ChatData>
): Promise<void> {
  const properties: any = {
    'Updated At': {
      date: { start: new Date().toISOString() },
    },
  };

  if (data.title !== undefined) {
    properties.Title = {
      title: [{ text: { content: data.title } }],
    };
  }

  if (data.preview !== undefined) {
    properties.Preview = {
      rich_text: [{ text: { content: data.preview.slice(0, 2000) } }],
    };
  }

  if (data.messages !== undefined) {
    const messagesStr = JSON.stringify(data.messages);
    // Use chunking to support up to 200,000 characters (100 chunks × 2000 chars)
    properties.Messages = {
      rich_text: chunkText(messagesStr),
    };
  }

  if (data.blocks !== undefined) {
    const blocksStr = JSON.stringify(data.blocks);
    properties.Blocks = {
      rich_text: chunkText(blocksStr),
    };
  }

  if (data.connections !== undefined) {
    const connectionsStr = JSON.stringify(data.connections);
    properties.Connections = {
      rich_text: chunkText(connectionsStr),
    };
  }

  if (data.highlights !== undefined) {
    const highlightsStr = JSON.stringify(data.highlights);
    properties.Highlights = {
      rich_text: chunkText(highlightsStr),
    };
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ properties }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update chat: ${response.statusText}`);
  }
}

export async function deleteChat(id: string): Promise<void> {
  const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ archived: true }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete chat: ${response.statusText}`);
  }
}
