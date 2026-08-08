const MAX_EXIF_SCAN_BYTES = 512 * 1024;

const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME = 0x0132;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;
const OFFSET_TIME = 0x9010;
const OFFSET_TIME_ORIGINAL = 0x9011;
const OFFSET_TIME_DIGITIZED = 0x9012;

export async function readExifCapturedAt(file: File): Promise<string | null> {
  try {
    const bytes = new Uint8Array(
      await file.slice(0, MAX_EXIF_SCAN_BYTES).arrayBuffer()
    );
    return readJpegCapturedAt(bytes);
  } catch {
    return null;
  }
}

export function readJpegCapturedAt(bytes: Uint8Array): string | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let cursor = 2;
  while (cursor + 4 <= bytes.length) {
    if (bytes[cursor] !== 0xff) return null;
    const marker = bytes[cursor + 1];
    cursor += 2;

    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    const segmentLength = readBigEndianUint16(bytes, cursor);
    if (segmentLength === null || segmentLength < 2) return null;
    const dataStart = cursor + 2;
    const dataEnd = cursor + segmentLength;
    if (dataEnd > bytes.length) return null;

    if (marker === 0xe1 && hasExifHeader(bytes, dataStart, dataEnd)) {
      return readTiffCapturedAt(bytes, dataStart + 6, dataEnd);
    }
    cursor = dataEnd;
  }

  return null;
}

function hasExifHeader(
  bytes: Uint8Array,
  start: number,
  end: number
): boolean {
  return end - start >= 6
    && bytes[start] === 0x45
    && bytes[start + 1] === 0x78
    && bytes[start + 2] === 0x69
    && bytes[start + 3] === 0x66
    && bytes[start + 4] === 0
    && bytes[start + 5] === 0;
}

function readTiffCapturedAt(
  bytes: Uint8Array,
  tiffStart: number,
  tiffEnd: number
): string | null {
  if (tiffStart + 8 > tiffEnd) return null;

  const byteOrder = String.fromCharCode(
    bytes[tiffStart] ?? 0,
    bytes[tiffStart + 1] ?? 0
  );
  if (byteOrder !== "II" && byteOrder !== "MM") return null;
  const littleEndian = byteOrder === "II";
  const reader = createTiffReader(bytes, tiffStart, tiffEnd, littleEndian);
  if (reader.uint16(tiffStart + 2) !== 42) return null;

  const ifd0Offset = reader.uint32(tiffStart + 4);
  if (ifd0Offset === null) return null;
  const ifd0 = tiffStart + ifd0Offset;
  const exifIfdOffset = readLongTag(reader, ifd0, EXIF_IFD_POINTER);

  if (exifIfdOffset !== null) {
    const exifIfd = tiffStart + exifIfdOffset;
    const original = readAsciiTag(reader, exifIfd, DATE_TIME_ORIGINAL);
    if (original) {
      return normalizeExifDate(
        original,
        readAsciiTag(reader, exifIfd, OFFSET_TIME_ORIGINAL)
      );
    }

    const digitized = readAsciiTag(reader, exifIfd, DATE_TIME_DIGITIZED);
    if (digitized) {
      return normalizeExifDate(
        digitized,
        readAsciiTag(reader, exifIfd, OFFSET_TIME_DIGITIZED)
      );
    }
  }

  const fallback = readAsciiTag(reader, ifd0, DATE_TIME);
  return fallback
    ? normalizeExifDate(fallback, readAsciiTag(reader, ifd0, OFFSET_TIME))
    : null;
}

type TiffReader = ReturnType<typeof createTiffReader>;

function createTiffReader(
  bytes: Uint8Array,
  tiffStart: number,
  tiffEnd: number,
  littleEndian: boolean
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    tiffStart,
    tiffEnd,
    uint16(offset: number) {
      return offset >= tiffStart && offset + 2 <= tiffEnd
        ? view.getUint16(offset, littleEndian)
        : null;
    },
    uint32(offset: number) {
      return offset >= tiffStart && offset + 4 <= tiffEnd
        ? view.getUint32(offset, littleEndian)
        : null;
    },
    ascii(offset: number, length: number) {
      if (length < 1 || length > 128 || offset < tiffStart || offset + length > tiffEnd) {
        return null;
      }
      return String.fromCharCode(...bytes.slice(offset, offset + length))
        .replace(/\0.*$/, "")
        .trim();
    },
  };
}

function readLongTag(
  reader: TiffReader,
  ifdOffset: number,
  wantedTag: number
): number | null {
  const entry = findIfdEntry(reader, ifdOffset, wantedTag);
  if (entry === null || reader.uint16(entry + 2) !== 4) return null;
  return reader.uint32(entry + 8);
}

function readAsciiTag(
  reader: TiffReader,
  ifdOffset: number,
  wantedTag: number
): string | null {
  const entry = findIfdEntry(reader, ifdOffset, wantedTag);
  if (entry === null || reader.uint16(entry + 2) !== 2) return null;
  const length = reader.uint32(entry + 4);
  if (length === null || length < 1 || length > 128) return null;

  const valueOffset = length <= 4
    ? entry + 8
    : reader.uint32(entry + 8);
  if (valueOffset === null) return null;
  return reader.ascii(
    length <= 4 ? valueOffset : reader.tiffStart + valueOffset,
    length
  );
}

function findIfdEntry(
  reader: TiffReader,
  ifdOffset: number,
  wantedTag: number
): number | null {
  const entryCount = reader.uint16(ifdOffset);
  if (entryCount === null || entryCount > 256) return null;

  for (let index = 0; index < entryCount; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (entry + 12 > reader.tiffEnd) return null;
    if (reader.uint16(entry) === wantedTag) return entry;
  }
  return null;
}

function normalizeExifDate(
  value: string,
  offset: string | null
): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  if (!offset || !/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/.test(offset)) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function readBigEndianUint16(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset] ?? 0) * 256 + (bytes[offset + 1] ?? 0);
}
