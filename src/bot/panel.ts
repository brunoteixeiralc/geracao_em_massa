import type { Batch } from "../workflow/batchWorkflow.js";

const MAX_BATCH_VIDEOS = 50;

export function renderBatchPanel(batch: Batch): string {
  const lines = [`Lote #${batch.id}`, `Status: ${labelStatus(batch.status)}`];

  if (batch.templateId) {
    lines.push(`Template: ${batch.templateId}`);
  }

  if (batch.status === "receiving") {
    lines.push(`Videos: ${batch.videos.length}/${MAX_BATCH_VIDEOS} recebidos`);
  }

  if (batch.status === "settings") {
    lines.push("");
    lines.push("Ajustes do lote");
    lines.push(`Corte automatico: ${onOff(batch.settings.autoCut)}`);
    lines.push(`Zoom: ${batch.settings.zoomPercent}%`);
    lines.push(`Velocidade: ${batch.settings.speed.toFixed(1)}x`);
    lines.push(`Espelhar: ${onOff(batch.settings.mirror)}`);
    lines.push(`Cortar inicio: ${batch.settings.trimStartSeconds.toFixed(1)}s`);
    lines.push(`Cortar fim: ${batch.settings.trimEndSeconds.toFixed(1)}s`);
    lines.push(`Antiduplicidade: ${onOff(batch.settings.antiduplication)}`);
    lines.push(`CTA: ${onOff(batch.settings.cta)}`);
    lines.push(`Marca d'agua: ${onOff(batch.settings.watermark)}`);
  }

  if (["queued", "downloading", "validating", "rendering", "zipping", "uploading", "delivering"].includes(batch.status)) {
    const progress = calculateProgress(batch);
    lines.push(`Fase: ${labelStatus(batch.status)}`);
    lines.push(`Baixados: ${progress.downloaded}/${batch.videos.length}`);
    lines.push(`Renderizados: ${progress.rendered}/${batch.videos.length}`);
    lines.push(`Entregues: ${progress.delivered}/${batch.videos.length}`);
  }

  if (batch.status === "completed") {
    lines.push(`${batch.videos.length} Reels prontos`);
  }

  if (batch.status === "failed") {
    lines.push("Falha no lote. Verifique os itens marcados com erro.");
  }

  return lines.join("\n");
}

function labelStatus(status: Batch["status"]) {
  const labels: Record<Batch["status"], string> = {
    draft: "Rascunho",
    receiving: "Recebendo videos",
    settings: "Ajustes",
    queued: "Na fila",
    downloading: "Baixando videos",
    validating: "Validando arquivos",
    rendering: "Renderizando",
    zipping: "Criando ZIP",
    uploading: "Enviando arquivos",
    delivering: "Entregando resultados",
    completed: "Concluido",
    failed: "Falhou",
    cancelled: "Cancelado"
  };

  return labels[status];
}

function onOff(value: boolean) {
  return value ? "ligado" : "desligado";
}

function calculateProgress(batch: Batch) {
  const downloadedStatuses = new Set(["rendering", "ready", "delivered"]);
  const renderedStatuses = new Set(["ready", "delivered"]);

  return {
    downloaded: batch.videos.filter((video) => Boolean(video.inputPath) || downloadedStatuses.has(video.status)).length,
    rendered: batch.videos.filter((video) => Boolean(video.outputPath) || renderedStatuses.has(video.status)).length,
    delivered: batch.videos.filter((video) => video.status === "delivered").length
  };
}
