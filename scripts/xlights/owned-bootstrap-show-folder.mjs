import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RGBEFFECTS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xrgb>
  <models/>
  <views/>
  <modelGroups type="rgb_effects"/>
</xrgb>
`;

const NETWORKS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Networks computer="xLightsDesigner Bootstrap" GlobalFPPProxy="" GlobalForceLocalIP="" AutoUpdateFromBase="0" BaseShowDir="">
  <suppressframes frames="20"/>
</Networks>
`;

const EFFECT_PRESETS_JSON = `{"presets":[]}
`;

const MARKER_JSON = `{
  "artifactType": "xlightsdesigner_bootstrap_show_folder_v1",
  "purpose": "Minimal xLights show folder used only to bring the owned Designer API online before switching to the user's real show folder."
}
`;

export function defaultOwnedBootstrapShowFolder() {
  return path.join(os.homedir(), 'Library', 'Containers', 'org.xlights', 'Data', 'tmp', 'xld-owned-bootstrap-show');
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) {
    return false;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

export function ensureOwnedBootstrapShowFolder(showDir = defaultOwnedBootstrapShowFolder()) {
  const resolved = path.resolve(showDir);
  fs.mkdirSync(resolved, { recursive: true });
  fs.mkdirSync(path.join(resolved, 'valuecurves'), { recursive: true });
  fs.mkdirSync(path.join(resolved, 'colorcurves'), { recursive: true });
  fs.mkdirSync(path.join(resolved, 'palettes'), { recursive: true });

  const changed = [
    writeIfChanged(path.join(resolved, 'xlights_rgbeffects.xml'), RGBEFFECTS_XML),
    writeIfChanged(path.join(resolved, 'xlights_networks.xml'), NETWORKS_XML),
    writeIfChanged(path.join(resolved, 'xlights_effectpresets.json'), EFFECT_PRESETS_JSON),
    writeIfChanged(path.join(resolved, '.xlightsdesigner-bootstrap.json'), MARKER_JSON)
  ].some(Boolean);

  return {
    path: resolved,
    changed,
    files: [
      path.join(resolved, 'xlights_rgbeffects.xml'),
      path.join(resolved, 'xlights_networks.xml'),
      path.join(resolved, 'xlights_effectpresets.json'),
      path.join(resolved, '.xlightsdesigner-bootstrap.json')
    ]
  };
}
