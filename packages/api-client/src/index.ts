import axios, { AxiosInstance } from 'axios';
import type {
  AppConfigDto,
  AuditLogDto,
  AuthUser,
  BranchDto,
  CaseParticipantDto,
  CaseSectionPayload,
  CaseUnread,
  CreditCaseDto,
  CreditCaseListItem,
  DirectoryUser,
  ImportParseResult,
  LoginResponse,
  MessageDto,
  NotificationItem,
  PassportScanResult,
  TexScanResult,
  ReMflContractDto,
  Role,
  StatsResponse,
  StepDeadlineSetting,
  TransitionPayload,
  UpsertCasePayload,
  SellerDto,
  SellerInput,
  CollectionDto,
  CollectionListItem,
  CollectionStats,
  CreateCollectionInput,
  UpdateCollectionInput,
  CollectorListItem,
  CreateCollectorInput,
  UpdateCollectorInput,
  CreateVisitInput,
  NotificationDto,
  ScheduleRow,
  WorkSessionDto,
  LiveLocationDto,
} from '@credit-core/shared';

/** Query params for the undiruv (collection) list + statistics. */
export type CollectionListParams = {
  status?: string;
  collectorId?: string;
  branchId?: string;
  from?: string;
  to?: string;
};

const TOKEN_KEY = 'cc_token';

/**
 * API origin, with its scheme aligned to how the page was loaded: an http:// page calls the
 * http API, an https:// page calls the https API. nginx serves the backend on both :80 and
 * :443, so this avoids mixed-content errors either way. VITE_API_URL may be absolute
 * (https://api.creditcore.uz), protocol-relative (//api.creditcore.uz), or a dev localhost URL.
 */
function resolveApiBaseUrl(): string {
  const raw =
    (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ??
    'http://localhost:3000';
  // Outside a browser (SSR/tests) there's no page scheme to follow — use the value as-is.
  if (typeof window === 'undefined' || !window.location?.protocol) return raw;
  const pageProtocol = window.location.protocol; // 'http:' | 'https:'
  if (raw.startsWith('//')) return pageProtocol + raw; // //host -> http(s)://host
  return raw.replace(/^https?:/i, pageProtocol); // swap an absolute URL's scheme to match the page
}

export const apiBaseUrl: string = resolveApiBaseUrl();

/**
 * Maps any thrown request error to a user-facing message.
 * Distinguishes a dead/unreachable server (no HTTP response) from real HTTP
 * errors, so callers never show "wrong password" when the backend is simply down.
 */
export function getErrorMessage(err: unknown, opts?: { unauthorized?: string }): string {
  if (axios.isAxiosError(err)) {
    // No response object → network failure (server down, CORS, offline, timeout).
    if (!err.response) {
      if (err.code === 'ECONNABORTED') return 'Server javob bermadi (timeout). Birozdan keyin urinib ko‘ring.';
      return 'Serverga ulanib bo‘lmadi. Server ishlamayapti yoki internet aloqasi yo‘q.';
    }
    const status = err.response.status;
    if (status === 401) return opts?.unauthorized ?? 'Avtorizatsiya muddati tugadi. Qaytadan kiring.';
    if (status === 403) return 'Ruxsat yo‘q.';
    const serverMsg = (err.response.data as { message?: string | string[] })?.message;
    if (serverMsg) return Array.isArray(serverMsg) ? serverMsg.join(', ') : serverMsg;
    if (status >= 500) return 'Serverda xatolik yuz berdi. Birozdan keyin urinib ko‘ring.';
    return 'So‘rovni bajarib bo‘lmadi.';
  }
  return (err as Error)?.message || 'Noma’lum xatolik yuz berdi.';
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const http: AxiosInstance = axios.create({ baseURL: `${apiBaseUrl}/api` });
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type DocBadge = { label: string; tone: 'pending' | 'approved' | 'rejected' };
export type CaseDocumentMeta = { key: string; title: string; lang: 'uz' | 'ru'; category: 'main' | 'notary' | 'accountant'; stage: 'review' | 'approved'; available: boolean; badge: DocBadge | null };
export type Conversation = { kind: 'saved' | 'dm' | 'case'; key: string; title: string; lastText: string | null; lastAt: string | null; unread: number };

export const api = {
  async login(login: string, password: string): Promise<LoginResponse> {
    const { data } = await http.post<LoginResponse>('/auth/login', { login, password });
    return data;
  },
  async me(): Promise<AuthUser> {
    const { data } = await http.get<AuthUser>('/auth/me');
    return data;
  },
  async updateProfile(payload: { fullName?: string; phone?: string }): Promise<AuthUser> {
    const { data } = await http.put<AuthUser>('/auth/me', payload);
    return data;
  },
  async uploadMyAvatar(file: File): Promise<AuthUser> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await http.post<AuthUser>('/auth/me/avatar', fd);
    return data;
  },
  async branches(): Promise<BranchDto[]> {
    const { data } = await http.get<BranchDto[]>('/branches');
    return data;
  },
  async cases(inbox = false): Promise<CreditCaseListItem[]> {
    const { data } = await http.get<CreditCaseListItem[]>('/cases', { params: { inbox: inbox ? 1 : 0 } });
    return data;
  },
  async case(id: string): Promise<CreditCaseDto> {
    const { data } = await http.get<CreditCaseDto>(`/cases/${id}`);
    return data;
  },
  async searchCases(q: string): Promise<CreditCaseListItem[]> {
    const { data } = await http.get<CreditCaseListItem[]>('/cases/search', { params: { q } });
    return data;
  },
  /** Qayta MFL: search existing clients by name / PINFL / phone / passport number. */
  async searchReMfl(term: string): Promise<ReMflContractDto[]> {
    const { data } = await http.get<ReMflContractDto[]>('/cases/re-mfl/search', { params: { term } });
    return data;
  },
  /** Qayta MFL: create a new draft linked to the chosen source contract. */
  async createReMfl(sourceCaseId: string): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>('/cases/re-mfl', { sourceCaseId });
    return data;
  },
  async sellersCatalog(): Promise<SellerDto[]> {
    const { data } = await http.get<SellerDto[]>('/sellers/catalog');
    return data;
  },
  async createSeller(payload: SellerInput): Promise<SellerDto> {
    const { data } = await http.post<SellerDto>('/sellers', payload);
    return data;
  },
  async createCase(payload: UpsertCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>('/cases', payload);
    return data;
  },
  async updateCase(id: string, payload: UpsertCasePayload): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}`, payload);
    return data;
  },
  /** Delete a DRAFT case (operator: own draft only; admin: any draft). Reason is required. */
  async deleteCase(id: string, reason: string): Promise<void> {
    await http.delete(`/cases/${id}`, { data: { reason } });
  },
  /** Archived (soft-deleted) drafts, role-scoped and searchable. */
  async archivedCases(q = ''): Promise<CreditCaseListItem[]> {
    const { data } = await http.get<CreditCaseListItem[]>('/cases/archived', { params: q ? { q } : {} });
    return data;
  },
  /** Restore an archived draft back to the active list. */
  async restoreCase(id: string): Promise<void> {
    await http.post(`/cases/${id}/restore`);
  },
  async saveCaseSection(id: string, payload: CaseSectionPayload): Promise<CreditCaseDto> {
    const { data } = await http.patch<CreditCaseDto>(`/cases/${id}/section`, payload);
    return data;
  },
  async setCaseRate(id: string, interestRate: number, reason: string): Promise<CreditCaseDto> {
    const { data } = await http.patch<CreditCaseDto>(`/cases/${id}/rate`, { interestRate, reason });
    return data;
  },
  /** Director sets the property-backed (avto) vs insurance-backed (polis) split. */
  async setCaseSplit(id: string, amountAuto: number, amountPolis: number, reason?: string): Promise<CreditCaseDto> {
    const { data } = await http.patch<CreditCaseDto>(`/cases/${id}/split`, { amountAuto, amountPolis, reason });
    return data;
  },
  async transition(id: string, payload: TransitionPayload): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>(`/cases/${id}/transition`, payload);
    return data;
  },
  /*
    Director signing — three calls, because the director signs *bytes* and the server has to know
    exactly which bytes it handed out. Without the prepare/commit split a client could sign
    anything at all and we would file it against the case.
  */
  /** The INN the signing key must carry — only the firm's own key may sign. */
  async signKeyRequirement(id: string): Promise<{ orgName: string | null; inn: string | null }> {
    const { data } = await http.get(`/cases/${id}/sign/key-requirement`);
    return data;
  },
  /** Render and freeze the document set; returns the manifest to sign and the challenge it belongs to. */
  async signPrepare(id: string): Promise<{ challengeId: string; manifestBase64: string; docCount: number }> {
    const { data } = await http.post(`/cases/${id}/sign/prepare`, {});
    return data;
  },
  /** Hand back the PKCS#7. The server re-hashes the frozen files before it accepts anything. */
  async signCommit(
    id: string,
    body: { challengeId: string; pkcs7: string; signerInfo: { alias: string; name: string; disk: string } },
  ): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>(`/cases/${id}/sign/commit`, body);
    return data;
  },
  /**
   * Report that E-IMZO refused. Everything it rejects — a wrong password, a closed dialog, a
   * denied domain — happens in the browser and would otherwise leave no trace at all: a director
   * saying "it will not sign" and a server log with no record of them ever trying.
   */
  async signError(id: string, body: { challengeId: string | null; stage: string; error: string }): Promise<void> {
    await http.post(`/cases/${id}/sign/error`, body);
  },
  async setKatmPrice(id: string, katmPrice: number): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}/katm-price`, { katmPrice });
    return data;
  },
  /** Save beneficiary bank requisites for the disbursement application ("Пул ўтказиш аризаси"). */
  async saveDisbursement(id: string, body: {
    holderName?: string | null;
    cardNumber?: string | null;
    accountNumber?: string | null;
    bankMfo?: string | null;
    holderInn?: string | null;
    bankName?: string | null;
  }): Promise<CreditCaseDto> {
    const { data } = await http.put<CreditCaseDto>(`/cases/${id}/disbursement`, body);
    return data;
  },
  async pauseCase(id: string, days?: number): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>(`/cases/${id}/pause`, days != null ? { days } : {});
    return data;
  },
  async resumeCase(id: string): Promise<CreditCaseDto> {
    const { data } = await http.post<CreditCaseDto>(`/cases/${id}/resume`);
    return data;
  },
  async exportAllCases(): Promise<Blob> {
    const { data } = await http.get('/cases/export/excel', { responseType: 'blob' });
    return data as Blob;
  },
  async parseExcel(file: File): Promise<ImportParseResult> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await http.post<ImportParseResult>('/import/real-estate/parse', fd);
    return data;
  },
  async uploadDocument(
    caseId: string,
    type: string,
    file: File,
    opts?: { collateralId?: string; title?: string; description?: string },
  ) {
    const fd = new FormData();
    fd.append('file', file);
    if (opts?.title) fd.append('title', opts.title);
    if (opts?.description) fd.append('description', opts.description);
    await http.post('/documents/upload', fd, {
      params: { caseId, type, collateralId: opts?.collateralId || undefined },
    });
  },
  async katmStatus() {
    const { data } = await http.get('/katm/status');
    return data as { available: boolean; message: string; reports: string[] };
  },
  /** Scan a passport image → MRZ fields + check-digit confidence (stateless). */
  async scanPassport(file: File): Promise<PassportScanResult> {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await http.post<PassportScanResult>('/passport/scan', fd);
    return data;
  },
  /** Scan an ID card (front + back) → merged fields + confidence (stateless). */
  async scanIdCard(front: File, back: File): Promise<PassportScanResult> {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    const { data } = await http.post<PassportScanResult>('/passport/scan-id', fd);
    return data;
  },
  /** Scan a tex passport (vehicle certificate) front + back → AUTO collateral fields (stateless). */
  async scanTex(front: File, back: File): Promise<TexScanResult> {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    const { data } = await http.post<TexScanResult>('/passport/scan-tex', fd);
    return data;
  },
  documentUrl(id: string): string {
    return `${apiBaseUrl}/api/documents/${id}/download`;
  },
  async generatePdf(id: string): Promise<Blob> {
    const { data } = await http.post(`/output/${id}/pdf/valuation-act`, {}, { responseType: 'blob' });
    return data as Blob;
  },
  async exportExcel(id: string): Promise<Blob> {
    const { data } = await http.get(`/output/${id}/excel`, { responseType: 'blob' });
    return data as Blob;
  },
  async exportScheduleExcel(id: string): Promise<Blob> {
    const { data } = await http.get(`/cases/${id}/documents/grafik/xlsx`, { responseType: 'blob' });
    return data as Blob;
  },

  // ── Documents (authenticated download/view — fixes 401 from <a href>) ──
  async downloadDocument(id: string): Promise<Blob> {
    const { data } = await http.get(`/documents/${id}/download`, { responseType: 'blob' });
    return data as Blob;
  },
  async deleteDocument(id: string): Promise<void> {
    await http.delete(`/documents/${id}`);
  },
  async replaceDocument(id: string, file: File): Promise<void> {
    const fd = new FormData();
    fd.append('file', file);
    await http.put(`/documents/${id}/file`, fd);
  },

  // ── Generated documents (SP-6) — list + render to PDF (bearer-auth blob) ──
  async listCaseDocuments(caseId: string): Promise<CaseDocumentMeta[]> {
    const { data } = await http.get<CaseDocumentMeta[]>(`/cases/${caseId}/documents`);
    return data;
  },
  async caseDocumentBlob(caseId: string, key: string): Promise<Blob> {
    const { data } = await http.get(`/cases/${caseId}/documents/${key}/pdf`, { responseType: 'blob' });
    return data as Blob;
  },

  // ── Analytics / monitoring ──
  async stats(range?: { from?: string; to?: string; branchId?: string; region?: string }): Promise<StatsResponse> {
    const { data } = await http.get<StatsResponse>('/stats', {
      params: { from: range?.from, to: range?.to, branchId: range?.branchId || undefined, region: range?.region || undefined },
    });
    return data;
  },

  // ── Admin: branches & users ──
  async createBranch(payload: { name: string; symbol: string; region?: string; moderatorIds?: string[] }): Promise<BranchDto> {
    const { data } = await http.post<BranchDto>('/branches', payload);
    return data;
  },
  async updateBranch(id: string, payload: { name: string; symbol: string; region?: string; moderatorIds?: string[] }): Promise<BranchDto> {
    const { data } = await http.put<BranchDto>(`/branches/${id}`, payload);
    return data;
  },
  async users(): Promise<any[]> {
    const { data } = await http.get('/users');
    return data as any[];
  },
  async createUser(payload: { fullName: string; login: string; password: string; role: Role; phone?: string; branchId?: string; moderatedBranchIds?: string[] }) {
    const { data } = await http.post('/users', payload);
    return data;
  },
  async updateUser(id: string, payload: { fullName?: string; role?: Role; phone?: string; branchId?: string; moderatedBranchIds?: string[]; isActive?: boolean; password?: string }) {
    const { data } = await http.put(`/users/${id}`, payload);
    return data;
  },
  async uploadUserAvatar(id: string, file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await http.post(`/users/${id}/avatar`, fd);
    return data;
  },

  // ── Chat / messages ──
  async messages(caseId: string): Promise<MessageDto[]> {
    const { data } = await http.get<MessageDto[]>(`/cases/${caseId}/messages`);
    return data;
  },
  async sendMessage(caseId: string, payload: { text?: string; toRole?: Role; toUserId?: string; files?: File[] }) {
    const fd = new FormData();
    if (payload.text) fd.append('text', payload.text);
    if (payload.toRole) fd.append('toRole', payload.toRole);
    if (payload.toUserId) fd.append('toUserId', payload.toUserId);
    (payload.files ?? []).slice(0, 3).forEach((f) => fd.append('files', f));
    await http.post(`/cases/${caseId}/messages`, fd);
  },
  async unreadCount(): Promise<number> {
    const { data } = await http.get<{ count: number }>('/messages/unread');
    return data.count;
  },
  async unreadByCase(): Promise<CaseUnread[]> {
    const { data } = await http.get<CaseUnread[]>('/messages/unread-by-case');
    return data;
  },
  async editMessage(caseId: string, msgId: string, text: string): Promise<void> {
    await http.patch(`/cases/${caseId}/messages/${msgId}`, { text });
  },
  async deleteMessage(caseId: string, msgId: string): Promise<void> {
    await http.delete(`/cases/${caseId}/messages/${msgId}`);
  },
  async notifications(): Promise<NotificationItem[]> {
    const { data } = await http.get<NotificationItem[]>('/messages/feed');
    return data;
  },
  async directory(role?: Role, q?: string): Promise<DirectoryUser[]> {
    const { data } = await http.get<DirectoryUser[]>('/directory', { params: { role, q } });
    return data;
  },
  async caseParticipants(id: string): Promise<CaseParticipantDto[]> {
    const { data } = await http.get<CaseParticipantDto[]>(`/cases/${id}/participants`);
    return data;
  },

  // ── Unified inbox: DM + Saved threads (case-independent) ──
  async conversations(): Promise<Conversation[]> {
    const { data } = await http.get<Conversation[]>('/conversations');
    return data;
  },
  async dmMessages(userId: string): Promise<MessageDto[]> {
    const { data } = await http.get<MessageDto[]>(`/dm/${userId}/messages`);
    return data;
  },
  async sendDm(userId: string, text: string, files?: File[]): Promise<void> {
    const fd = new FormData();
    if (text) fd.append('text', text);
    (files ?? []).slice(0, 3).forEach((f) => fd.append('files', f));
    await http.post(`/dm/${userId}/messages`, fd);
  },
  async savedMessages(): Promise<MessageDto[]> {
    const { data } = await http.get<MessageDto[]>('/saved/messages');
    return data;
  },
  async sendSaved(text: string, files?: File[]): Promise<void> {
    const fd = new FormData();
    if (text) fd.append('text', text);
    (files ?? []).slice(0, 3).forEach((f) => fd.append('files', f));
    await http.post('/saved/messages', fd);
  },
  async saveToSaved(msgId: string): Promise<void> {
    await http.post(`/messages/${msgId}/save-to-saved`);
  },

  // ── Admin: SLA deadline settings (business days per step) ──
  async getDeadlineSettings(): Promise<StepDeadlineSetting[]> {
    const { data } = await http.get<StepDeadlineSetting[]>('/settings/deadlines');
    return data;
  },
  async updateDeadlineSettings(items: StepDeadlineSetting[]): Promise<StepDeadlineSetting[]> {
    const { data } = await http.put<StepDeadlineSetting[]>('/settings/deadlines', { items });
    return data;
  },
  async getConfig(): Promise<AppConfigDto> {
    const { data } = await http.get<AppConfigDto>('/settings/config');
    return data;
  },
  async updateConfig(payload: AppConfigDto): Promise<AppConfigDto> {
    const { data } = await http.put<AppConfigDto>('/settings/config', payload);
    return data;
  },
  async getAuditLog(params: { caseId?: string; actorId?: string; action?: string } = {}): Promise<AuditLogDto[]> {
    const { data } = await http.get<AuditLogDto[]>('/audit', { params });
    return data;
  },

  // ── Undiruv (debt collection) — SP-1 ────────────────────────────────────────
  async collections(params: CollectionListParams = {}): Promise<CollectionListItem[]> {
    const { data } = await http.get<CollectionListItem[]>('/collections', { params });
    return data;
  },
  async collectionStats(params: CollectionListParams = {}): Promise<CollectionStats> {
    const { data } = await http.get<CollectionStats>('/collections/stats', { params });
    return data;
  },
  async collection(id: string): Promise<CollectionDto> {
    const { data } = await http.get<CollectionDto>(`/collections/${id}`);
    return data;
  },
  async collectionForCase(caseId: string): Promise<CollectionDto | null> {
    const { data } = await http.get<CollectionDto | null>(`/collections/by-case/${caseId}`);
    // A case with no collection returns 200 with an empty body; axios surfaces that as "" (an
    // empty string), which is truthy enough to slip past `collection?.…` guards downstream and
    // crash the undiruv form. Normalise any empty/falsy body to null.
    return data || null;
  },
  /** The case's payment schedule (grafik) — the undiruv form reads it to pre-fill each month. */
  async caseSchedule(caseId: string): Promise<ScheduleRow[]> {
    const { data } = await http.get<ScheduleRow[]>(`/cases/${caseId}/schedule`);
    return data;
  },
  async createCollection(payload: CreateCollectionInput): Promise<CollectionDto> {
    const { data } = await http.post<CollectionDto>('/collections', payload);
    return data;
  },
  async updateCollection(id: string, payload: UpdateCollectionInput): Promise<CollectionDto> {
    const { data } = await http.patch<CollectionDto>(`/collections/${id}`, payload);
    return data;
  },
  async deleteCollection(id: string): Promise<void> {
    await http.delete(`/collections/${id}`);
  },
  /** Open a visit's photo/video (bearer-authenticated) in a new tab. */
  async viewVisitMedia(mediaId: string): Promise<void> {
    const { data } = await http.get<Blob>(`/collections/visits/media/${mediaId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  async createVisit(collectionId: string, payload: CreateVisitInput, media: File[] = []): Promise<CollectionDto> {
    const fd = new FormData();
    fd.append('amount', String(payload.amount));
    fd.append('letterType', payload.letterType);
    if (payload.comment) fd.append('comment', payload.comment);
    if (payload.lat != null) fd.append('lat', String(payload.lat));
    if (payload.lng != null) fd.append('lng', String(payload.lng));
    for (const file of media) fd.append('media', file);
    const { data } = await http.post<CollectionDto>(`/collections/${collectionId}/visits`, fd);
    return data;
  },

  // collector accounts (admin) ──────────────────────────────────────────────
  async collectors(): Promise<CollectorListItem[]> {
    const { data } = await http.get<CollectorListItem[]>('/collectors');
    return data;
  },
  async createCollector(payload: CreateCollectorInput): Promise<CollectorListItem> {
    const { data } = await http.post<CollectorListItem>('/collectors', payload);
    return data;
  },
  async updateCollector(id: string, payload: UpdateCollectorInput): Promise<CollectorListItem> {
    const { data } = await http.patch<CollectorListItem>(`/collectors/${id}`, payload);
    return data;
  },
  async deleteCollector(id: string): Promise<void> {
    await http.delete(`/collectors/${id}`);
  },

  // bell notifications (new Notification model, distinct from the message feed) ──
  async myNotifications(unread = false): Promise<NotificationDto[]> {
    const { data } = await http.get<NotificationDto[]>('/notifications', { params: unread ? { unread: 1 } : {} });
    return data;
  },
  async notificationUnreadCount(): Promise<number> {
    const { data } = await http.get<{ count: number }>('/notifications/unread-count');
    return data.count;
  },
  async markNotificationRead(id: string): Promise<void> {
    await http.post(`/notifications/${id}/read`);
  },
  async markAllNotificationsRead(): Promise<void> {
    await http.post('/notifications/read-all');
  },

  // work shifts (SP-4) ──────────────────────────────────────────────────────
  async workStart(lat?: number, lng?: number): Promise<WorkSessionDto> {
    const { data } = await http.post<WorkSessionDto>('/work/start', { lat, lng });
    return data;
  },
  async workEnd(lat?: number, lng?: number): Promise<WorkSessionDto | null> {
    const { data } = await http.post<WorkSessionDto | null>('/work/end', { lat, lng });
    return data || null; // a null result comes back as an empty body → "" via axios; normalise it
  },
  async workPing(lat: number, lng: number): Promise<void> {
    await http.post('/work/ping', { lat, lng });
  },
  async workCurrent(): Promise<WorkSessionDto | null> {
    const { data } = await http.get<WorkSessionDto | null>('/work/current');
    return data || null; // "not on shift" comes back as an empty body → "" via axios; normalise it
  },
  async workSessions(params: { collectorId?: string; from?: string; to?: string } = {}): Promise<WorkSessionDto[]> {
    const { data } = await http.get<WorkSessionDto[]>('/work/sessions', { params });
    return data;
  },
  async workLive(): Promise<LiveLocationDto[]> {
    const { data } = await http.get<LiveLocationDto[]>('/work/live');
    return data;
  },
};

/**
 * Open a document inline in a new browser tab (renders PDFs/images natively).
 * Uses a tokenized URL with inline disposition so the browser displays rather
 * than downloads. Falls back to an authenticated blob download if blocked.
 */
export async function viewDocument(id: string, fileName: string) {
  const token = getToken();
  const url = `${apiBaseUrl}/api/documents/${id}/download?inline=1&token=${encodeURIComponent(token ?? '')}`;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) downloadBlob(await api.downloadDocument(id), fileName);
}

/** Tokenized avatar URL usable directly as an <img src>. */
export function userAvatarUrl(id: string): string {
  const token = getToken();
  return `${apiBaseUrl}/api/users/${id}/avatar?token=${encodeURIComponent(token ?? '')}`;
}

/** Tokenized inline document URL usable directly as an <img src> (images) or href (PDF). */
export function documentInlineUrl(id: string): string {
  const token = getToken();
  return `${apiBaseUrl}/api/documents/${id}/download?inline=1&token=${encodeURIComponent(token ?? '')}`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
