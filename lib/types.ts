export type AnswerType = 'text' | 'image'

export interface Prompt {
  id: string
  text: string
  answerType: AnswerType
  thinking: boolean
  submittedAt: number
  askerUserId: string
}

export interface Answer {
  promptId: string
  content: string
  answeredAt: number
}

export type Tab = 'human' | 'larp'

export interface RestoredState {
  credits: number
  pendingPrompt: { id: string; text: string; answerType: AnswerType } | null
  assignedPrompt: Prompt | null
  isLarping: boolean
  pendingAnswer: (Answer & { promptText: string }) | null
}

export interface ServerToClientEvents {
  credits_update: (credits: number) => void
  online_count: (data: { total: number; human: number; ai: number }) => void
  prompt_assigned: (prompt: Prompt) => void
  answer_received: (answer: Answer & { promptText: string }) => void
  restore_state: (state: RestoredState) => void
  error: (msg: string) => void
}

export interface ClientToServerEvents {
  identify: (userId: string) => void
  submit_prompt: (data: { text: string; answerType: AnswerType; thinking: boolean }) => void
  cancel_prompt: () => void
  submit_answer: (data: { promptId: string; content: string }) => void
  skip_prompt: () => void
  start_larp: () => void
  vote: (data: { promptId: string; vote: 'up' | 'down' }) => void
}
