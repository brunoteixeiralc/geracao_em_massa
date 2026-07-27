import type { TelegramDownloadInput, TelegramDownloadResult } from "./telegramFileDownloader.js";
import type { InstagramUrlDownloadInput } from "./instagramUrlDownloader.js";

export type InputVideoDownloadInput = TelegramDownloadInput & {
  sourceType?: "telegram_file" | "instagram_url";
  sourceUrl?: string | null;
};

export type InputVideoDownloader = {
  downloadVideo(input: InputVideoDownloadInput): Promise<TelegramDownloadResult>;
};

export function createInputVideoDownloader(options: {
  telegramDownloader: InputVideoDownloader;
  instagramDownloader: {
    downloadVideo(input: InstagramUrlDownloadInput): Promise<TelegramDownloadResult>;
  };
}): InputVideoDownloader {
  return {
    async downloadVideo(input) {
      if (input.sourceType === "instagram_url") {
        if (!input.sourceUrl) {
          throw new Error("Video do Instagram sem URL de origem.");
        }

        return options.instagramDownloader.downloadVideo({
          batchId: input.batchId,
          videoId: input.videoId,
          sourceUrl: input.sourceUrl
        });
      }

      return options.telegramDownloader.downloadVideo(input);
    }
  };
}
