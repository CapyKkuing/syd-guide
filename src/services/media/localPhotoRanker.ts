/* eslint-disable no-unused-vars */
import { createImageClassifier } from "./transformersRuntime.js";

const MAX_EDGE = 960;

interface Classification {
  label: string;
  score: number;
}

export interface RankedPhoto {
  file: File;
  thumbnail: Blob;
  width: number;
  height: number;
  capturedAt: string | null;
  score: number;
  labels: string[];
}

type Classifier = (
  image: Blob,
  options: { top_k: number }
) => Promise<unknown>;

let classifierPromise: Promise<Classifier> | null = null;

async function classifier(): Promise<Classifier> {
  classifierPromise ??= createImageClassifier();
  return classifierPromise;
}

export async function rankPhotos(files: File[]): Promise<RankedPhoto[]> {
  const classify = await classifier();
  const ranked: Array<RankedPhoto & { hash: string }> = [];

  for (const file of files) {
    const bitmap = await createImageBitmap(file);
    const sample = sampleImage(bitmap);
    const predictions = normalizePredictions(await classify(file, { top_k: 3 }));
    const sceneScore = predictions.some(({ label }) => scenicLabel(label))
      ? Math.max(...predictions.map(({ score }) => score), 0)
      : (predictions[0]?.score ?? 0) * 0.35;
    const duplicate = ranked.some(({ hash }) => hashDistance(hash, sample.hash) <= 6);
    const score = clamp(
      sample.quality * 0.75 + sceneScore * 0.25 - (duplicate ? 0.25 : 0)
    );
    const thumbnail = await thumbnailFromBitmap(bitmap);
    ranked.push({
      file,
      thumbnail,
      width: bitmap.width,
      height: bitmap.height,
      capturedAt: null,
      score,
      labels: predictions.map(({ label }) => label),
      hash: sample.hash,
    });
    bitmap.close();
  }

  return ranked
    .sort((left, right) => right.score - left.score)
    .map((photo) => ({
      file: photo.file,
      thumbnail: photo.thumbnail,
      width: photo.width,
      height: photo.height,
      capturedAt: photo.capturedAt,
      score: photo.score,
      labels: photo.labels,
    }));
}

function normalizePredictions(value: unknown): Classification[] {
  if (!Array.isArray(value)) return [];
  const list = Array.isArray(value[0]) ? value[0] : value;
  return list.filter(
    (item): item is Classification =>
      typeof item === "object"
      && item !== null
      && "label" in item
      && typeof item.label === "string"
      && "score" in item
      && typeof item.score === "number"
  );
}

function sampleImage(bitmap: ImageBitmap): { quality: number; hash: string } {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("사진 분석 화면을 만들 수 없습니다.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminance: number[] = [];
  let brightness = 0;
  let saturation = 0;
  let sharpness = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const light = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminance.push(light);
    brightness += light;
    saturation += Math.max(red, green, blue) - Math.min(red, green, blue);
    if (index >= 4) {
      sharpness += Math.abs(light - (luminance[luminance.length - 2] ?? light));
    }
  }

  const count = luminance.length;
  const mean = brightness / count;
  const variance = luminance.reduce(
    (total, value) => total + (value - mean) ** 2,
    0
  ) / count;
  const exposure = 1 - Math.min(Math.abs(mean - 128) / 128, 1);
  const contrast = Math.min(Math.sqrt(variance) / 64, 1);
  const detail = Math.min(sharpness / count / 32, 1);
  const color = Math.min(saturation / count / 96, 1);
  const resolution = Math.min(
    Math.sqrt(bitmap.width * bitmap.height) / Math.sqrt(12_000_000),
    1
  );
  const ratio = bitmap.width / bitmap.height;
  const coverFit = ratio >= 1.2 && ratio <= 2 ? 1 : 0.65;

  return {
    quality: clamp(
      exposure * 0.22
      + contrast * 0.18
      + detail * 0.24
      + color * 0.1
      + resolution * 0.16
      + coverFit * 0.1
    ),
    hash: perceptualHash(luminance, canvas.width, canvas.height),
  };
}

function perceptualHash(
  luminance: number[],
  width: number,
  height: number
): string {
  const cells: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const sampleX = Math.floor((x + 0.5) * width / 8);
      const sampleY = Math.floor((y + 0.5) * height / 8);
      cells.push(luminance[sampleY * width + sampleX] ?? 0);
    }
  }
  const average = cells.reduce((sum, value) => sum + value, 0) / cells.length;
  return cells.map((value) => value >= average ? "1" : "0").join("");
}

function hashDistance(left: string, right: string): number {
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) difference += 1;
  }
  return difference;
}

async function thumbnailFromBitmap(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(MAX_EDGE / Math.max(bitmap.width, bitmap.height), 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("사진 미리보기를 만들 수 없습니다.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("사진 미리보기를 만들 수 없습니다.")),
      "image/webp",
      0.82
    );
  });
}

function scenicLabel(label: string): boolean {
  return /(seashore|coast|promontory|lakeside|dock|harbor|palace|monastery|bridge|fountain|mountain|valley|cliff|restaurant|street|market)/i.test(label);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
