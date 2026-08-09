import type { RAGCitation } from './rag.js'

export type ChatMessageMetadata = {
  citations?: RAGCitation[]
}

export interface ChatMessage {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
  thinking?: string
  isThinking?: boolean
  thinkingDuration?: number
  metadata?: ChatMessageMetadata
}

export interface ChatSession {
  id: string
  title: string
  lastMessage?: string
  timestamp: Date
}
