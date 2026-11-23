import type {
  ThinkActionApproveResult,
  ThinkActionRecordDTO,
  ThinkActionRejectResult,
  ThinkContextSource,
  ThinkConversationDetail,
  ThinkConversationSummary,
  ThinkQuotaStatus,
  ThinkSendMessageResult,
} from '../types/think';

export class ThinkApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
  quota?: ThinkQuotaStatus;
  details?: Array<{ path: string; message: string }>;
  action?: ThinkActionRecordDTO;

  constructor(params: {
    message: string;
    status: number;
    code?: string;
    retryAfterSeconds?: number;
    quota?: ThinkQuotaStatus;
    details?: Array<{ path: string; message: string }>;
    action?: ThinkActionRecordDTO;
  }) {
    super(params.message);
    this.name = 'ThinkApiError';
    this.status = params.status;
    this.code = params.code;
    this.retryAfterSeconds = params.retryAfterSeconds;
    this.quota = params.quota;
    this.details = params.details;
    this.action = params.action;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createInvalidResponseError(status = 502): ThinkApiError {
  return new ThinkApiError({
    message: 'Received an unexpected or empty response from THINK. Please retry.',
    status: status >= 400 ? status : 502,
    code: 'INVALID_RESPONSE',
  });
}

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errObj = isPlainObject(payload) ? payload : null;
    const message =
      errObj && typeof errObj.error === 'string'
        ? errObj.error
        : `Request failed with status ${response.status}`;

    throw new ThinkApiError({
      message,
      status: response.status,
      code: errObj && typeof errObj.code === 'string' ? errObj.code : undefined,
      retryAfterSeconds:
        errObj && typeof errObj.retryAfterSeconds === 'number'
          ? errObj.retryAfterSeconds
          : undefined,
      quota: errObj && isPlainObject(errObj.quota) ? (errObj.quota as unknown as ThinkQuotaStatus) : undefined,
      details:
        errObj && Array.isArray(errObj.details)
          ? (errObj.details as Array<{ path: string; message: string }>)
          : undefined,
      action:
        errObj && isPlainObject(errObj.action)
          ? (errObj.action as unknown as ThinkActionRecordDTO)
          : undefined,
    });
  }

  if (!isPlainObject(payload)) {
    throw createInvalidResponseError(response.status);
  }

  return payload as T;
}

export async function fetchThinkConversations(token: string): Promise<{
  conversations: ThinkConversationSummary[];
  quota: ThinkQuotaStatus;
}> {
  const data = await requestJson<{
    conversations: ThinkConversationSummary[];
    quota: ThinkQuotaStatus;
  }>('/api/think/conversations', token, { method: 'GET' });
  if (!Array.isArray(data.conversations) || !isPlainObject(data.quota)) {
    throw createInvalidResponseError();
  }
  return data;
}

export async function createThinkConversationRequest(
  token: string,
  input?: { title?: string; contextSource?: ThinkContextSource }
): Promise<ThinkConversationSummary> {
  const data = await requestJson<{ conversation: ThinkConversationSummary }>(
    '/api/think/conversations',
    token,
    {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    }
  );
  if (!isPlainObject(data.conversation) || typeof data.conversation.id !== 'number') {
    throw createInvalidResponseError();
  }
  return data.conversation;
}

export async function fetchThinkConversationDetail(
  token: string,
  conversationId: number
): Promise<ThinkConversationDetail & { quota: ThinkQuotaStatus }> {
  const data = await requestJson<ThinkConversationDetail & { quota: ThinkQuotaStatus }>(
    `/api/think/conversations/${conversationId}`,
    token,
    { method: 'GET' }
  );
  if (
    !isPlainObject(data.conversation) ||
    !Array.isArray(data.messages) ||
    !isPlainObject(data.quota)
  ) {
    throw createInvalidResponseError();
  }
  return data;
}

export async function updateThinkConversationContextRequest(
  token: string,
  conversationId: number,
  contextSource: ThinkContextSource
): Promise<ThinkConversationSummary> {
  const data = await requestJson<{ conversation: ThinkConversationSummary }>(
    `/api/think/conversations/${conversationId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ contextSource }),
    }
  );
  if (!isPlainObject(data.conversation) || typeof data.conversation.id !== 'number') {
    throw createInvalidResponseError();
  }
  return data.conversation;
}

export async function deleteThinkConversationRequest(
  token: string,
  conversationId: number
): Promise<{ deleted: boolean; id: number }> {
  const data = await requestJson<{ deleted: boolean; id: number }>(
    `/api/think/conversations/${conversationId}`,
    token,
    { method: 'DELETE' }
  );
  if (typeof data.deleted !== 'boolean' || typeof data.id !== 'number') {
    throw createInvalidResponseError();
  }
  return data;
}

export async function sendThinkMessageRequest(
  token: string,
  conversationId: number,
  content: string
): Promise<ThinkSendMessageResult> {
  const data = await requestJson<ThinkSendMessageResult>(
    `/api/think/conversations/${conversationId}/messages`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  if (
    !isPlainObject(data.conversation) ||
    typeof data.conversation.id !== 'number' ||
    !isPlainObject(data.userMessage) ||
    typeof data.userMessage.id !== 'number' ||
    !isPlainObject(data.assistantMessage) ||
    typeof data.assistantMessage.id !== 'number' ||
    !isPlainObject(data.quota)
  ) {
    throw createInvalidResponseError();
  }
  return data;
}

export async function approveThinkActionRequest(
  token: string,
  actionId: number,
  editedPayload?: Record<string, unknown>
): Promise<ThinkActionApproveResult> {
  const data = await requestJson<ThinkActionApproveResult>(
    `/api/think/actions/${actionId}/approve`,
    token,
    {
      method: 'POST',
      body: JSON.stringify(editedPayload !== undefined ? { editedPayload } : {}),
    }
  );
  if (!isPlainObject(data.action) || typeof data.action.id !== 'number') {
    throw createInvalidResponseError();
  }
  return data;
}

export async function rejectThinkActionRequest(
  token: string,
  actionId: number
): Promise<ThinkActionRejectResult> {
  const data = await requestJson<ThinkActionRejectResult>(
    `/api/think/actions/${actionId}/reject`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
  if (!isPlainObject(data.action) || typeof data.action.id !== 'number') {
    throw createInvalidResponseError();
  }
  return data;
}
