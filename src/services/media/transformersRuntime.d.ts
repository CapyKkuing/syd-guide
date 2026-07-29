/* eslint-disable no-unused-vars */
export function createImageClassifier(): Promise<
  (image: Blob, options: { top_k: number }) => Promise<unknown>
>;
