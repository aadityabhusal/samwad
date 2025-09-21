# Samwad

**Learn languages through natural AI conversations**

Samwad is an installable progressive web app that helps you practice speaking new languages through voice conversations with an AI tutor. Practice anytime, anywhere without fear of making mistakes or being judged.

## Project Overview

This application leverages Google's Gemini Live API to create interactive language learning sessions where users can practice speaking with an AI instructor. The AI provides real-time feedback, scores your responses, and adapts to your proficiency level, making language learning more engaging and effective.

## Features

- **Voice-Based Learning** - Practice speaking through natural voice conversations
- **AI Instructor** - Intelligent tutoring with personalized feedback and scoring
- **Multi-Language Support** - Learn English, Hindi, or Mandarin
- **Difficulty Levels** - Six proficiency levels from A1 (Beginner) to C2 (Advanced+)
- **Session Management** - Save and review past practice sessions
- **Adaptive Learning** - AI breaks down complex answers and provides targeted hints
- **PWA Support** - Install as a mobile app with offline capabilities and wake lock functionality
- **Dark Mode** - Beautiful UI with light/dark theme support
- **Real-time Audio** - Live audio streaming with visual feedback

## Tech Stack

### Frontend

React, TypeScript, Vite, Tailwind CSS, Zustand, Shadcn/Radix

### AI and Audio

Google Gemini Live API, Web Audio API, Audio Worklets

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/aadityabhusal/samwad.git
cd samwad
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Development Server

```bash
pnpm dev
```

### 5. Build for Production

```bash
pnpm build
```

## Usage

1. **Enter API Key** - Get your Google Gemini API from [Google AI Studio](https://aistudio.google.com/apikey) and add it in the settings drawer panel
2. **Set Up Your Profile** - Choose your native language, target language, and difficulty level
3. **Start a Session** - Create a new practice session and start speaking with the AI tutor
4. **Get Feedback** - Receive scores and improvement suggestions
5. **Track Progress** - Review past sessions and monitor your improvement

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── sections/       # Page sections (header, conversation, etc.)
│   └── ui/             # Base UI components
├── lib/               # Core utilities and hooks
│   ├── audio/          # Audio processing modules
│   ├── hooks/          # Custom React hooks
│   ├── types/          # Custom types
│   ├── data/           # UI Data for the app
│   ├── utils/          # Custom utilities
│   └── store.ts        # State management
├── index.css          # Main CSS file with themes and custom styles
└── main.tsx           # Application entry point
```

## License

This project is open source and available under the [MIT License](LICENSE).

---
