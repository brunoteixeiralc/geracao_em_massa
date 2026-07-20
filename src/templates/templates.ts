export type TemplateDefinition = {
  id: string;
  name: string;
  previewPath: string;
  canvas: { width: number; height: number };
  videoBox: { x: number; y: number; width: number; height: number };
  header: {
    avatarPath: string;
    displayName: string;
    handle: string;
    headline: string;
  };
};

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "humor-01",
    name: "Humor 01",
    previewPath: "assets/templates/humor-01/preview.png",
    canvas: { width: 1080, height: 1920 },
    videoBox: { x: 90, y: 620, width: 900, height: 1120 },
    header: {
      avatarPath: "assets/templates/humor-01/avatar.png",
      displayName: "HUMOR DE CACHORRO",
      handle: "@humordecachorro",
      headline: "Meu maior arrependimento foi nao ter seguido essa pagina antes kkk"
    }
  }
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}
