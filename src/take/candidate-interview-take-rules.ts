import {InterviewStatus} from "../interview/interfaces/interview.interface";
import {CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE} from "../interview/interview-management-rules";

export function getCanceledInterviewTakeBlockReason(
    status: InterviewStatus,
): string | null {
    return status === 'canceled' ? CANCELED_INTERVIEW_TAKE_BLOCKED_MESSAGE : null;
}