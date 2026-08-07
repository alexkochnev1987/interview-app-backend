import { RecruiterAssistantAwaitingInput } from './dto/recruiter-assistant.dto';
import {
  RecruiterConversationFlow,
  RecruiterConversationState,
} from './recruiter-conversation.types';

const SLOT_KEYS: Record<RecruiterAssistantAwaitingInput, string> = {
  hr: 'hrName',
  interview: 'interviewRef',
  questionName: 'questionName',
  candidateName: 'candidateName',
  position: 'position',
  templateChoice: 'templateChoice',
};

export function idleConversationState(): RecruiterConversationState {
  return { flow: 'idle', slots: {} };
}

export function startConversationFlow(
  flow: Exclude<RecruiterConversationFlow, 'idle'>,
  awaitingInput: RecruiterAssistantAwaitingInput,
  initialSlots: Record<string, string> = {},
): RecruiterConversationState {
  return { flow, slots: { ...initialSlots }, awaitingInput };
}

export function slotKeyFor(awaitingInput: RecruiterAssistantAwaitingInput): string {
  return SLOT_KEYS[awaitingInput];
}

export function captureAwaitingSlot(
  state: RecruiterConversationState,
  message: string,
): RecruiterConversationState {
  if (!state.awaitingInput) {
    return state;
  }
  const key = slotKeyFor(state.awaitingInput);
  return {
    ...state,
    slots: { ...state.slots, [key]: message.trim() },
    awaitingInput: undefined,
  };
}

export function finishConversationFlow(): RecruiterConversationState {
  return idleConversationState();
}
