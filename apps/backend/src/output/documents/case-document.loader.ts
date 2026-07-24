import { resolveOwners, type BorrowerLike, type OwnerLike } from '@credit-core/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Load a case with all SP-1 relations needed to render documents. */
export async function loadCaseForDocs(prisma: PrismaService, id: string) {
  const c = await prisma.creditCase.findUnique({
    where: { id },
    include: {
      branch: true,
      borrower: true,
      /*
        Ordered, and ordered the same way the API mapper orders it.

        «The primary collateral» decides real things — the score's pledge factors, the case's
        productType, whose name appears as the pledgor, and the order 3.1.1 lists them in. Without
        an ORDER BY that was whatever MySQL returned, so the wizard's live score and the printed
        report could disagree about which pledge came first. `id` breaks the tie: collaterals are
        created inside one transaction and can share a timestamp to the millisecond.
      */
      collaterals: { include: { owners: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      creditLine: {
        include: {
          tranches: {
            orderBy: { trancheNo: 'asc' },
            include: { schedule: { include: { installments: { orderBy: { seq: 'asc' } } } } },
          },
          insurance: true,
        },
      },
      employment: true,
      affordability: true,
      creditHistory: true,
      scoring: { include: { factors: true } },
      incomeCertificate: { include: { months: true } },
      disbursement: true,
      seller: true,
      documents: true,
    },
  });
  if (!c) return null;
  const organization = await prisma.organization.findUnique({ where: { id: 'default' } });

  /*
    Fill in the implied owner before any template sees the data.

    The forms all name an owner, but the operator only fills the list in when it is somebody other
    than the borrower — so the common case, a borrower pledging their own property, printed «—» in
    every document. Resolving it here fixes all of them at once and keeps the templates free of
    fallback logic they were each getting slightly differently.
  */
  return withResolvedOwners({ ...c, organization });
}

/**
 * Apply the implied-owner rule to a loaded case.
 *
 * Exported and used by the fixtures too, so a template test and the real thing see the same shape.
 * Putting it only in the query would have left every harness — review pack, render checks — still
 * printing «—» for the case the fix exists for.
 */
export function withResolvedOwners<T extends { borrower: BorrowerLike | null; collaterals: { owners: OwnerLike[] }[] }>(c: T): T {
  return {
    ...c,
    collaterals: c.collaterals.map((col) => ({
      ...col,
      owners: resolveOwners(col.owners, c.borrower) as typeof col.owners,
    })),
  };
}

export type CaseDocData = NonNullable<Awaited<ReturnType<typeof loadCaseForDocs>>>;
