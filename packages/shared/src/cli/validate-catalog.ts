import { validateCatalog, loadCatalog, defaultCatalogDir } from '../catalog';

const dir = process.argv[2] ?? defaultCatalogDir();
const issues = validateCatalog(dir);
if (issues.length) {
  for (const i of issues) console.error(`✗ ${i.file} ${i.path}: ${i.message}`);
  console.error(`\n${issues.length} issue(s)`);
  process.exit(1);
}
const c = loadCatalog(dir);
console.log(`✓ catalog valid: ${c.components.length} components, ${c.slots.length} slots, ${c.rules.length} rules, ${c.networks.length} networks, ${c.upgrades.length} upgrades`);
