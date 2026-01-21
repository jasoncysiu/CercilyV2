# Notion Database Design for Cercily Backend (POC)

This document outlines the database schema for using Notion as a temporary backend.

---

## Overview

**Total Databases: 3**

| Database | Purpose |
|----------|---------|
| Users | User accounts and API keys |
| Projects | Project containers |
| Chats | Chat data with canvas state |

---

## Database 1: Users

Stores user account information.

| Field | Notion Type | Description |
|-------|-------------|-------------|
| Name | Title | Display name |
| Email | Email | User's email (unique identifier) |
| API Key | Text | Hashed API key for authentication |
| Created At | Date | Account creation timestamp |

**Example Row:**
```
Name: "Jason"
Email: jason@example.com
API Key: "ck_abc123..."
Created At: 2025-01-21
```

---

## Database 2: Projects

Groups related chats together.

| Field | Notion Type | Description |
|-------|-------------|-------------|
| Title | Title | Project name |
| Owner | Relation → Users | Link to user who owns this project |
| Created At | Date | Project creation timestamp |
| Updated At | Date | Last modified timestamp |

**Example Row:**
```
Title: "Research Project"
Owner: → Jason
Created At: 2025-01-21
Updated At: 2025-01-21
```

---

## Database 3: Chats

Stores chat conversations and canvas state. This is the main data table.

| Field | Notion Type | Description |
|-------|-------------|-------------|
| Title | Title | Chat name |
| Preview | Text | Short preview snippet (first ~50 chars) |
| Project | Relation → Projects | Parent project |
| Messages | Text (Long) | JSON array of messages |
| Blocks | Text (Long) | JSON array of canvas blocks |
| Connections | Text (Long) | JSON array of block connections |
| Highlights | Text (Long) | JSON array of text highlights |
| Created At | Date | Chat creation timestamp |
| Updated At | Date | Last modified timestamp |

---

## JSON Field Schemas

### Messages Field
```json
[
  {
    "id": "msg_1",
    "role": "user",
    "content": "Hello, can you help me?"
  },
  {
    "id": "msg_2",
    "role": "assistant",
    "content": "Of course! What do you need?"
  }
]
```

### Blocks Field
```json
[
  {
    "id": "block_1",
    "text": "Key insight from conversation",
    "color": "yellow",
    "x": 100,
    "y": 200,
    "width": 200,
    "height": 100,
    "messageId": "msg_2",
    "startOffset": 0,
    "endOffset": 10
  }
]
```

### Connections Field
```json
[
  {
    "from": "block_1",
    "fromPos": "right",
    "to": "block_2",
    "toPos": "left",
    "color": "blue"
  }
]
```

### Highlights Field
```json
[
  {
    "id": "hl_1",
    "messageId": "msg_2",
    "text": "Of course",
    "color": "yellow",
    "startOffset": 0,
    "endOffset": 9
  }
]
```

---

## Notion API Integration Notes

### Required Environment Variables
```env
NOTION_API_KEY=secret_xxx
NOTION_USERS_DB_ID=xxx
NOTION_PROJECTS_DB_ID=xxx
NOTION_CHATS_DB_ID=xxx
```

### Rate Limits
- Notion API: 3 requests/second
- For POC with small user group, this is sufficient

### Text Field Limit
- Notion text properties: **2000 characters max**
- For longer conversations, use **page content** instead of properties
- Alternative: Store JSON in the page body as a code block

### Recommended Approach for Large Data
If messages/blocks exceed 2000 chars, store in page content:

```
Page Properties: title, preview, project, timestamps
Page Content (body):
  - ## Messages
    ```json
    [...full messages array...]
    ```
  - ## Canvas State
    ```json
    { blocks: [...], connections: [...], highlights: [...] }
    ```
```

---

## Quick Setup Checklist

1. Create Notion integration at https://www.notion.so/my-integrations
2. Create 3 databases with fields above
3. Share each database with your integration
4. Copy database IDs from URLs
5. Add env variables to your project

---

## Data Flow

```
Frontend                    API Route                 Notion
   |                           |                        |
   |-- Save Chat ------------->|                        |
   |                           |-- Update Page -------->|
   |                           |<-- Page Data ----------|
   |<-- Success ---------------|                        |
   |                           |                        |
   |-- Load Chats ------------>|                        |
   |                           |-- Query Database ----->|
   |                           |<-- Pages Array --------|
   |<-- Chats Data ------------|                        |
```
