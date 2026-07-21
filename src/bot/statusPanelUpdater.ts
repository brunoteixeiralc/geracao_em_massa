import type { Batch } from "../workflow/batchWorkflow.js";
import { renderBatchPanel } from "./panel.js";

type FetchLike = typeof fetch;

export function createTelegramStatusPanelUpdater(options: { botToken: string; fetch?: FetchLike }) {
  const fetchFn = options.fetch ?? fetch;

  return {
    async updateBatchStatus(batch: Batch) {
      if (!batch.statusPanelChatId || !batch.statusPanelMessageId) {
        return;
      }

      const response = await fetchFn(`https://api.telegram.org/bot${options.botToken}/editMessageText`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          chat_id: batch.statusPanelChatId,
          message_id: batch.statusPanelMessageId,
          text: renderBatchPanel(batch)
        })
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram status panel update failed with status ${response.status}: ${body}`);
      }
    }
  };
}
