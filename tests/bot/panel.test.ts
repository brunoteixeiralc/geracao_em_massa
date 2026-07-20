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
});
