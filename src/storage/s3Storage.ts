import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";

export type StorageClient = {
  send(command: PutObjectCommand): Promise<unknown>;
};

export type UploadFileInput = {
  filePath: string;
  key: string;
  contentType: string;
};

export type UploadFileResult = {
  key: string;
  url: string;
};

export function createS3Storage(options: {
  bucket: string;
  publicAssetBaseUrl: string;
  client: StorageClient;
}) {
  const publicBaseUrl = options.publicAssetBaseUrl.replace(/\/+$/g, "");

  return {
    async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
      assertSafeStorageKey(input.key);

      await options.client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.key,
          Body: createReadStream(input.filePath),
          ContentType: input.contentType
        })
      );

      return {
        key: input.key,
        url: `${publicBaseUrl}/${encodeStorageKey(input.key)}`
      };
    }
  };
}

export function createS3Client(options: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  return new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey
    },
    forcePathStyle: true
  });
}

function assertSafeStorageKey(key: string) {
  const parts = key.split("/");
  if (
    key.length === 0 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    parts.some((part) => part.length === 0 || part === "." || part === "..")
  ) {
    throw new Error("Storage key invalida.");
  }
}

function encodeStorageKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}
