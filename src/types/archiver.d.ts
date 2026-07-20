declare module "archiver" {
  import type { Writable } from "node:stream";

  export type Archiver = {
    file(path: string, options: { name: string }): void;
    finalize(): Promise<void>;
    once(event: "error", listener: (error: Error) => void): Archiver;
    pipe(stream: Writable): void;
  };

  export default function archiver(format: "zip", options?: { zlib?: { level?: number } }): Archiver;
}
