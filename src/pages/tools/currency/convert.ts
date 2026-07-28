export function convertAudToKrw(amountAud: number, krwPerAud: number): number {
  if (!Number.isFinite(amountAud) || amountAud < 0) {
    throw new Error("AUD 금액은 0 이상이어야 합니다.");
  }
  validateRate(krwPerAud);
  return Math.round(amountAud * krwPerAud);
}

export function convertKrwToAud(amountKrw: number, krwPerAud: number): number {
  if (!Number.isFinite(amountKrw) || amountKrw < 0) {
    throw new Error("KRW 금액은 0 이상이어야 합니다.");
  }
  validateRate(krwPerAud);
  return Math.round((amountKrw / krwPerAud) * 100) / 100;
}

function validateRate(krwPerAud: number) {
  if (!Number.isFinite(krwPerAud) || krwPerAud <= 0) {
    throw new Error("환율은 0보다 커야 합니다.");
  }
}
