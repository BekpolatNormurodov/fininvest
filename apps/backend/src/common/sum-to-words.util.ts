/**
 * The number-to-words helpers now live in @credit-core/shared, so the operator form can fill the
 * pledge contract's «прописью» line with the exact wording the document will print. This file stays
 * as the path twenty-odd templates already import from — re-exported, not reimplemented, so a sum is
 * only ever spelled one way.
 */
export {
  integerToUzbekWords,
  sumToWordsUz,
  dateToUzbekWords,
  integerToUzbekWordsCyrillic,
  sumToWordsUzCyrillic,
  moneyWithWordsCyr,
  dateToRuCyrillic,
} from '@credit-core/shared';
