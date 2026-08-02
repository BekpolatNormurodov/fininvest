import { CaseStatus, CollectionStatus, DocumentType, LetterType, ProductType, Role } from './enums';

export const LETTER_TYPE_LABEL: Record<LetterType, string> = {
  [LetterType.NONE]: 'Xatsiz',
  [LetterType.WARNING]: 'Ogohlantirish xati',
  [LetterType.EXPLANATION]: 'Tushuntirish xati',
  [LetterType.OTHER]: 'Boshqa',
};

/** Uzbek UI labels (primary language). */
export const ROLE_LABEL: Record<Role, string> = {
  [Role.OPERATOR]: 'Operator',
  [Role.MODERATOR]: 'Moderator',
  [Role.DIRECTOR]: 'Direktor',
  [Role.ADMIN]: 'Administrator',
  [Role.COLLECTOR]: 'Undiruvchi',
};

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  [CollectionStatus.NEW]: 'Yangi',
  [CollectionStatus.ASSIGNED]: 'Biriktirilgan',
  [CollectionStatus.IN_PROGRESS]: 'Jarayonda',
  [CollectionStatus.CLOSED]: 'Yopilgan',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'Qoralama',
  [CaseStatus.MODERATION]: 'Moderatsiyada',
  [CaseStatus.DIRECTOR_REVIEW]: 'Direktor ko‘rigida',
  [CaseStatus.ADMIN_FINALIZE]: 'Yakunlash (admin)',
  [CaseStatus.FINALIZED]: 'Yakunlangan',
  [CaseStatus.REJECTED]: 'Rad etilgan',
  [CaseStatus.CANCELLED]: 'Bekor qilingan',
};

export const PRODUCT_LABEL: Record<ProductType, string> = {
  [ProductType.REAL_ESTATE]: 'Uy-joy (ko‘chmas mulk)',
  [ProductType.AUTO]: 'Avtotransport',
};

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  [DocumentType.NOTARY]: 'Notarial hujjat',
  [DocumentType.SCAN]: 'Skan',
  [DocumentType.PASSPORT]: 'Pasport',
  [DocumentType.COLLATERAL_PHOTO]: 'Garov rasmi',
  [DocumentType.TECH_PASSPORT]: 'Texnik pasport',
  [DocumentType.GEN_DOVERNOST]: 'Gen doverennost',
  [DocumentType.DOWN_PAYMENT_RECEIPT]: 'Boshlang‘ich to‘lov kvitansiyasi',
  [DocumentType.DIRECTOR_FINAL]: 'Yakuniy hujjat (direktor)',
  [DocumentType.GENERATED_PDF]: 'Generatsiya qilingan PDF',
  [DocumentType.CHAT]: 'Chat fayli',
  [DocumentType.OTHER]: 'Boshqa',
};
