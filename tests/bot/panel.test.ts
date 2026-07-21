import { describe, expect, it } from "vitest";
import { renderBatchPanel } from "../../src/bot/panel.js";
import { createDraftBatch, receiveVideo, selectTemplate } from "../../src/workflow/batchWorkflow.js";

describe("renderBatchPanel", () => {
  it("shows receiving progress", () => {
    let batch = selectTemplate(createDraftBatch({ id: "522", telegramUserId: "123" }), "humor-01");
    batch = receiveVideo(batch, { id: "v1", fileId: "f1", fileName: "one.mp4", sizeBytes: 1000 }, 50);

    expect(renderBatchPanel(batch)).toContain("Videos: 1/50 recebidos");
  });

  it("shows global settings", () => {
    const batch = selectTemplate(createDraftBatch({ id: "522", telegramUserId: "123" }), "humor-01");

    expect(renderBatchPanel({ ...batch, status: "settings" })).toContain("Zoom: 105%");
  });

  it("shows live worker progress by phase", () => {
    const batch = {
      ...selectTemplate(createDraftBatch({ id: "522", telegramUserId: "123" }), "humor-01"),
      status: "rendering" as const,
      videos: [
        { id: "v1", fileId: "f1", fileName: "one.mp4", sizeBytes: 1000, status: "ready" as const },
        { id: "v2", fileId: "f2", fileName: "two.mp4", sizeBytes: 1000, status: "rendering" as const },
        { id: "v3", fileId: "f3", fileName: "three.mp4", sizeBytes: 1000, status: "queued" as const }
      ]
    };

    const panel = renderBatchPanel(batch);

    expect(panel).toContain("Fase: Renderizando");
    expect(panel).toContain("Baixados: 2/3");
    expect(panel).toContain("Renderizados: 1/3");
    expect(panel).toContain("Entregues: 0/3");
  });
});
