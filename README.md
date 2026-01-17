# Canvas Brainstorm - Next.js

A canvas brainstorming application, built with Next.js 14 and TypeScript.

## Features

- 🎨 Interactive canvas for brainstorming
- 📝 Create notes by clicking on the canvas
- 🔗 Connect notes together
- 🎨 Color-coded notes (yellow, blue, pink, green, orange)
- 🔍 Zoom in/out on canvas
- 💾 Export canvas to JSON

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Run the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
chatgpt-canvas-nextjs/
├── app/
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Main page component
├── components/
│   ├── CanvasBlock.tsx     # Individual canvas block
│   ├── CanvasPanel.tsx     # Main canvas area
│   ├── MainToolbar.tsx     # Top toolbar
│   ├── NewBlockInput.tsx   # Input for creating new blocks
│   ├── StatusBar.tsx       # Status bar (time, battery, etc.)
│   └── Toast.tsx           # Toast notifications
├── lib/
│   └── types.ts        # TypeScript type definitions
├── styles/
│   └── globals.css     # Global styles
├── package.json
├── tsconfig.json
└── next.config.js
```

## Usage

### Adding Notes to Canvas

1. **Click to add**: Select the "T" tool and click anywhere on the canvas to create a new note

### Connecting Notes

1. Select the "🔗" tool
2. Hover over a note to see connection points
3. Drag from one connection point to another

### Editing Notes

- Hover over a note and click the ✏ button to edit
- Click the 🗑 button to delete

### Exporting

Click the "💾 Save" button to export your canvas as a JSON file.

## Built With

- [Next.js 14](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [React 18](https://reactjs.org/) - UI library

## License

MIT