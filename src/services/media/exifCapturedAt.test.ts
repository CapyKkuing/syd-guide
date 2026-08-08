import { describe, expect, it } from "vitest";
import { readJpegCapturedAt } from "./exifCapturedAt";

function jpegWithExifDate(
  date: string,
  offset = "+10:00"
): Uint8Array {
  const dateBytes = new TextEncoder().encode(`${date}\0`);
  const offsetBytes = new TextEncoder().encode(`${offset}\0`);
  const ifd0Offset = 8;
  const exifIfdOffset = 26;
  const valuesOffset = 56;
  const tiff = new Uint8Array(valuesOffset + dateBytes.length + offsetBytes.length);
  const view = new DataView(tiff.buffer);

  tiff.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifd0Offset, true);

  view.setUint16(ifd0Offset, 1, true);
  view.setUint16(ifd0Offset + 2, 0x8769, true);
  view.setUint16(ifd0Offset + 4, 4, true);
  view.setUint32(ifd0Offset + 6, 1, true);
  view.setUint32(ifd0Offset + 10, exifIfdOffset, true);

  view.setUint16(exifIfdOffset, 2, true);
  view.setUint16(exifIfdOffset + 2, 0x9003, true);
  view.setUint16(exifIfdOffset + 4, 2, true);
  view.setUint32(exifIfdOffset + 6, dateBytes.length, true);
  view.setUint32(exifIfdOffset + 10, valuesOffset, true);
  view.setUint16(exifIfdOffset + 14, 0x9011, true);
  view.setUint16(exifIfdOffset + 16, 2, true);
  view.setUint32(exifIfdOffset + 18, offsetBytes.length, true);
  view.setUint32(exifIfdOffset + 22, valuesOffset + dateBytes.length, true);
  tiff.set(dateBytes, valuesOffset);
  tiff.set(offsetBytes, valuesOffset + dateBytes.length);

  const exifHeader = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0, 0]);
  const segmentLength = exifHeader.length + tiff.length + 2;
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1,
    segmentLength >> 8,
    segmentLength & 0xff,
    ...exifHeader,
    ...tiff,
    0xff, 0xd9,
  ]);
}

describe("readJpegCapturedAt", () => {
  it("reads DateTimeOriginal and its timezone offset", () => {
    expect(readJpegCapturedAt(jpegWithExifDate("2026:08:02 09:20:00")))
      .toBe("2026-08-02T09:20:00+10:00");
  });

  it("returns null when a photo has no usable JPEG EXIF timestamp", () => {
    expect(readJpegCapturedAt(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])))
      .toBeNull();
    expect(readJpegCapturedAt(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])))
      .toBeNull();
  });
});
