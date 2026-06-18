import {
  sendSupportNotification,
  type SupportEmailSender,
  type SupportEmailResult
} from "./support-email.ts";
import {
  createMemorySupportQueueAdapter,
  saveSupportIntake,
  type SupportQueueAdapter,
  type SupportStorageRequest,
  type SupportStorageResult
} from "./support-storage.ts";

export type SupportRequestSubmissionResult = Readonly<{
  accepted: boolean;
  stored: boolean;
  referenceId: string;
  userMessage: string;
  storage: SupportStorageResult;
  email?: SupportEmailResult;
}>;

export type SupportRequestSubmissionOptions = Readonly<{
  queue?: SupportQueueAdapter;
  emailSender?: SupportEmailSender;
}>;

export const defaultSupportQueue = createMemorySupportQueueAdapter();

export async function submitSupportRequest(
  request: SupportStorageRequest,
  options: SupportRequestSubmissionOptions = {}
): Promise<SupportRequestSubmissionResult> {
  const queue = options.queue ?? defaultSupportQueue;
  const storage = await saveSupportIntake(request, queue);
  const referenceId = storage.referenceId ?? request.correlationId;

  if (!storage.stored) {
    return Object.freeze({
      accepted: false,
      stored: false,
      referenceId,
      userMessage: storage.message,
      storage
    });
  }

  const email = await sendSupportNotification(
    {
      correlationId: referenceId,
      subject: `${request.category} request ${referenceId}`,
      category: request.category,
      replyTo: request.email,
      summary: request.message
    },
    options.emailSender
  );

  await queue.updateEmailStatus(
    referenceId,
    email.delivered ? "email_sent" : "email_failed",
    email.sanitizedError ?? (email.delivered ? undefined : email.message)
  );

  return Object.freeze({
    accepted: true,
    stored: true,
    referenceId,
    userMessage: `Your request was received. Reference ID: ${referenceId}.`,
    storage,
    email
  });
}

export async function retryFailedSupportEmails(
  queue: SupportQueueAdapter = defaultSupportQueue,
  sender?: SupportEmailSender
) {
  const records = await queue.list();
  const failed = records.filter((record) => record.emailStatus === "email_failed");
  const results: SupportRequestSubmissionResult[] = [];
  for (const record of failed) {
    results.push(
      await submitSupportRequest(
        {
          correlationId: record.referenceId,
          category: record.category,
          consentAccepted: true,
          email: record.email,
          message: record.messagePreview
        },
        { queue, emailSender: sender }
      )
    );
  }
  return Object.freeze(results);
}
