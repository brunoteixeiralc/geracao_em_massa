# Template Guide

Templates are file-backed. To add a new visual layout, create one folder under `assets/templates/<id>` with a `template.json` file and the image assets used by the renderer.

For frame templates, the easiest workflow is:

1. Create a 1080x1920 design in Canva or another editor.
2. Put a solid key-color rectangle where the input video should appear.
3. Export the design as PNG.
4. Run the scaffold command.
5. Validate the template.
6. Run a smoke render before opening a PR.

## Recommended Frame Template Flow

Use bright green `#00FF01` for the video placeholder area. The template manager can detect that area automatically and write the correct `videoBox` values.

```bash
npm run templates:create-frame -- \
  --frame ~/Downloads/my-template.png \
  --id humor-gato \
  --name "Humor Gato"
```

This creates:

```text
assets/templates/humor-gato/
  frame.png
  template.json
```

Then validate:

```bash
npm run templates:validate
```

For a full local render check with FFmpeg:

```bash
npm run templates:smoke
```

## Listing Templates

```bash
npm run templates:list
```

Example output:

```text
ID              Kind   Canvas     Video Box          Name
humor-cachorro  frame  1080x1920  0,761,1080,1159   Humor Cachorro
```

## Manual Video Box

If the PNG does not use a key-color placeholder, pass the video box manually:

```bash
npm run templates:create-frame -- \
  --frame ~/Downloads/my-template.png \
  --id humor-gato \
  --name "Humor Gato" \
  --video-box 0,761,1080,1159
```

The format is:

```text
x,y,width,height
```

## Custom Key Color

The default key color is `#00FF01`. To use another color:

```bash
npm run templates:create-frame -- \
  --frame ~/Downloads/my-template.png \
  --id humor-gato \
  --name "Humor Gato" \
  --key-color "#FF0000"
```

## `template.json`

Frame templates use this shape:

```json
{
  "id": "humor-gato",
  "name": "Humor Gato",
  "kind": "frame",
  "previewPath": "assets/templates/humor-gato/frame.png",
  "framePath": "assets/templates/humor-gato/frame.png",
  "canvas": { "width": 1080, "height": 1920 },
  "videoBox": { "x": 0, "y": 761, "width": 1080, "height": 1159 },
  "keyColor": "#00FF01"
}
```

Rules:

- `id` must match the folder name.
- `id` must use lowercase letters, numbers, and hyphens.
- `previewPath` and `framePath` must be relative paths inside the repository.
- `canvas` must match the PNG dimensions.
- `videoBox` must fit inside the canvas.
- `keyColor` should cover the video placeholder area when used.

## Pull Request Checklist

Before opening a template PR:

```bash
npm run templates:list
npm run templates:validate
npm run templates:smoke
npm run test:unit
```

If `templates:smoke` fails because FFmpeg is not installed locally, validate the template and let CI run the remaining checks.
