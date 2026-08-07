import { RecruiterAssistantAwaitingInput } from './dto/recruiter-assistant.dto';

export type RecruiterConversationFlow =
  | 'idle'
  | 'assign_hr'
  | 'create_question'
  | 'create_interview';

export interface RecruiterConversationState {
  flow: RecruiterConversationFlow;
  slots: Record<string, string>;
  awaitingInput?: RecruiterAssistantAwaitingInput;
}
