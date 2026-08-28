import { RecruiterAssistantAwaitingInput } from './dto/recruiter-assistant.dto';
import {
  RecruiterConversationFlow,
  RecruiterConversationState,
} from './recruiter-conversation.types';

type SlotAwaitingInput = Exclude<
  RecruiterAssistantAwaitingInput,
  'confirmAddDespiteSimilar' | 'confirmRegisteredCandidate'
>;

const SLOT_KEYS: Record<SlotAwaitingInput, string> = {
  hr: 'hrName',
  interview: 'interviewRef',
  questionName: 'questionName',
  candidateName: 'candidateName',
  candidateChoice: 'candidateChoice',
  position: 'position',
  templateChoice: 'templateChoice',
};

export function isSlotAwaitingInput(
  awaitingInput: RecruiterAssistantAwaitingInput,
): awaitingInput is SlotAwaitingInput {
  return (
    awaitingInput !== 'confirmAddDespiteSimilar' &&
    awaitingInput !== 'confirmRegisteredCandidate'
  );
}

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

export function slotKeyFor(awaitingInput: SlotAwaitingInput): string {
  return SLOT_KEYS[awaitingInput];
}

export function captureAwaitingSlot(
  state: RecruiterConversationState,
  message: string,
): RecruiterConversationState {
  if (!state.awaitingInput || !isSlotAwaitingInput(state.awaitingInput)) {
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
