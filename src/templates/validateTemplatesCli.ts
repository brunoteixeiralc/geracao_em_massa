import { validateTemplates } from "./validateTemplates.js";

const smoke = process.argv.includes("--smoke");
const result = await validateTemplates({ smoke });

if (result.issues.length === 0) {
  console.log(`Templates OK: ${result.templatesChecked} validated${smoke ? `, ${result.smokeChecked} smoke-rendered` : ""}.`);
  process.exit(0);
}

console.error(`Template validation failed with ${result.issues.length} issue(s):`);

for (const issue of result.issues) {
  const template = issue.templateId ? `[${issue.templateId}] ` : "";
  const file = issue.filePath ? `${issue.filePath}: ` : "";
  console.error(`- ${template}${file}${issue.message}`);
}

process.exit(1);
