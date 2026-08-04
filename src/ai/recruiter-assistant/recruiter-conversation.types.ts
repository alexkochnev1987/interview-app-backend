export type RecruiterConversationFlow =
  | 'idle'
  | 'assign_hr'
  | 'create_question'
  | 'create_interview';

export interface RecruiterConversationState {
  flow: RecruiterConversationFlow;
  slots: Record<string, string>;
}
