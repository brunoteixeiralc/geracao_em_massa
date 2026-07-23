import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export type TemplateDefinition = {
  id: string;
  name: string;
  kind: "profile" | "frame";
  previewPath: string;
  canvas: { width: number; height: number };
  videoBox: { x: number; y: number; width: number; height: number };
} & (
  | {
      kind: "profile";
      header: {
        avatarPath: string;
        displayName: string;
        handle: string;
        headline: string;
      };
    }
  | {
      kind: "frame";
      framePath: string;
      keyColor?: string;
    }
);

const relativeAssetPath = z.string().min(1).refine((path) => !path.startsWith("/") && !path.includes(".."), {
  message: "must be a relative path inside the repository"
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, {
  message: "must be a hex color like #00FF00"
});

const baseTemplateSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().min(1),
    previewPath: relativeAssetPath,
    canvas: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }),
    videoBox: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      width: z.number().int().positive(),
      height: z.number().int().positive()
    })
  })
  .strict();

const profileTemplateSchema = baseTemplateSchema
  .extend({
    kind: z.literal("profile").default("profile"),
    header: z.object({
      avatarPath: relativeAssetPath,
      displayName: z.string().min(1),
      handle: z.string().min(1),
      headline: z.string().min(1)
    })
  })
  .strict();

const frameTemplateSchema = baseTemplateSchema
  .extend({
    kind: z.literal("frame"),
    framePath: relativeAssetPath,
    keyColor: hexColor.optional()
  })
  .strict();

const templateSchema = z.union([frameTemplateSchema, profileTemplateSchema]);

export const TEMPLATES: TemplateDefinition[] = loadTemplatesFromDirectory(join(process.cwd(), "assets", "templates"));

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function loadTemplatesFromDirectory(rootDir: string): TemplateDefinition[] {
  const templateDirectories = readdirSync(rootDir)
    .map((entry) => join(rootDir, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory());

  return templateDirectories.map(loadTemplate).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function loadTemplate(templateDir: string): TemplateDefinition {
  const templatePath = join(templateDir, "template.json");
  const raw = readFileSync(templatePath, "utf8");
  const parsed = templateSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    throw new Error(`Invalid template ${templatePath}: ${parsed.error.message}`);
  }

  assertAssetExists(parsed.data.previewPath, templatePath);
  if (parsed.data.kind === "frame") {
    assertAssetExists(parsed.data.framePath, templatePath);
  } else {
    assertAssetExists(parsed.data.header.avatarPath, templatePath);
  }

  return parsed.data;
}

function assertAssetExists(assetPath: string, templatePath: string) {
  if (!existsSync(join(process.cwd(), assetPath))) {
    throw new Error(`Invalid template ${templatePath}: missing asset ${assetPath}`);
  }
}
