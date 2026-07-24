import "dotenv/config";
import { fileURLToPath } from "node:url";
import {
  createFrameTemplate,
  defaultTemplateIdFromFramePath,
  defaultTemplateNameFromId,
  formatTemplateSummaryTable,
  listTemplateSummaries,
  parseHexColor,
  parseVideoBox
} from "./templateManager.js";

type ParsedArgs = {
  command: "list" | "create-frame" | "help";
  flags: Map<string, string>;
};

export async function runTemplateManagerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.command === "help") {
    console.log(helpText());
    return;
  }

  if (args.command === "list") {
    const rootDir = args.flags.get("root-dir");
    console.log(formatTemplateSummaryTable(listTemplateSummaries(rootDir)));
    return;
  }

  const framePath = requiredFlag(args.flags, "frame");
  const id = args.flags.get("id") ?? defaultTemplateIdFromFramePath(framePath);
  const name = args.flags.get("name") ?? defaultTemplateNameFromId(id);
  const rootDir = args.flags.get("root-dir");
  const keyColor = args.flags.has("key-color") ? parseHexColor(requiredFlag(args.flags, "key-color")) : undefined;
  const videoBox = args.flags.has("video-box") ? parseVideoBox(requiredFlag(args.flags, "video-box")) : undefined;

  const created = await createFrameTemplate({
    id,
    name,
    sourceFramePath: framePath,
    rootDir,
    keyColor,
    videoBox
  });

  console.log(`Template created: ${created.definition.id}`);
  console.log(`Name: ${created.definition.name}`);
  console.log(`Canvas: ${created.definition.canvas.width}x${created.definition.canvas.height}`);
  console.log(
    `Video box: ${created.definition.videoBox.x},${created.definition.videoBox.y},${created.definition.videoBox.width},${created.definition.videoBox.height}`
  );
  console.log(`Path: ${created.templatePath}`);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;

  if (!["list", "create-frame", "help"].includes(command)) {
    throw new Error(`Unknown templates command: ${command}`);
  }

  const flags = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];

    if (!flag?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${flag}`);
    }

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }

    flags.set(flag.slice(2), value);
    index += 1;
  }

  return { command: command as ParsedArgs["command"], flags };
}

function requiredFlag(flags: Map<string, string>, name: string) {
  const value = flags.get(name);
  if (!value) {
    throw new Error(`Missing required flag --${name}`);
  }

  return value;
}

function helpText() {
  return [
    "Template manager",
    "",
    "Commands:",
    "  list",
    "  create-frame --frame path/to/frame.png [--id humor-gato] [--name \"Humor Gato\"] [--key-color #00FF01] [--video-box x,y,width,height]",
    "",
    "Examples:",
    "  npm run templates:list",
    "  npm run templates:create-frame -- --frame ~/Downloads/frame.png --id humor-gato --name \"Humor Gato\""
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTemplateManagerCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
