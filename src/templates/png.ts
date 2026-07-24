import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export type PngInfo = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaceMethod: number;
};

type PngData = {
  info: PngInfo;
  idatChunks: Buffer[];
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngInfo(filePath: string): PngInfo {
  return readPng(filePath).info;
}

export function countPngRgbPixels(filePath: string, color: { red: number; green: number; blue: number }): number {
  const png = readPng(filePath);
  const bytesPerPixel = bytesPerPixelFor(png.info);
  const rowSize = png.info.width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(png.idatChunks));
  let sourceOffset = 0;
  let previousRow = Buffer.alloc(rowSize);
  let matches = 0;

  for (let y = 0; y < png.info.height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    const encodedRow = inflated.subarray(sourceOffset, sourceOffset + rowSize);
    sourceOffset += rowSize;
    const row = unfilterRow(filterType, encodedRow, previousRow, bytesPerPixel);

    for (let x = 0; x < png.info.width; x += 1) {
      const pixelOffset = x * bytesPerPixel;
      const red = row[pixelOffset];
      const green = row[pixelOffset + 1];
      const blue = row[pixelOffset + 2];
      const alpha = bytesPerPixel === 4 ? row[pixelOffset + 3] : 255;

      if (alpha > 0 && red === color.red && green === color.green && blue === color.blue) {
        matches += 1;
      }
    }

    previousRow = row;
  }

  return matches;
}

function readPng(filePath: string): PngData {
  const file = readFileSync(filePath);
  if (!file.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error("not a PNG file");
  }

  let offset = pngSignature.length;
  let info: PngInfo | undefined;
  const idatChunks: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = file.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      info = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlaceMethod: data[12]
      };
    }

    if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    }

    if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!info) {
    throw new Error("PNG missing IHDR chunk");
  }

  if (idatChunks.length === 0) {
    throw new Error("PNG missing IDAT chunk");
  }

  return { info, idatChunks };
}

function bytesPerPixelFor(info: PngInfo) {
  if (info.bitDepth !== 8 || info.interlaceMethod !== 0) {
    throw new Error("only non-interlaced 8-bit PNG files are supported");
  }

  if (info.colorType === 2) {
    return 3;
  }

  if (info.colorType === 6) {
    return 4;
  }

  throw new Error("only RGB and RGBA PNG files are supported");
}

function unfilterRow(filterType: number, encodedRow: Buffer, previousRow: Buffer, bytesPerPixel: number) {
  const row = Buffer.alloc(encodedRow.length);

  for (let index = 0; index < encodedRow.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previousRow[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;

    switch (filterType) {
      case 0:
        row[index] = encodedRow[index];
        break;
      case 1:
        row[index] = (encodedRow[index] + left) & 0xff;
        break;
      case 2:
        row[index] = (encodedRow[index] + up) & 0xff;
        break;
      case 3:
        row[index] = (encodedRow[index] + Math.floor((left + up) / 2)) & 0xff;
        break;
      case 4:
        row[index] = (encodedRow[index] + paeth(left, up, upLeft)) & 0xff;
        break;
      default:
        throw new Error(`unsupported PNG filter ${filterType}`);
    }
  }

  return row;
}

function paeth(left: number, up: number, upLeft: number) {
  const prediction = left + up - upLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upLeftDistance = Math.abs(prediction - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
}
