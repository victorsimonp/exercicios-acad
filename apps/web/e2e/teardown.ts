import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export default function teardown() {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'src/testing/cleanup-e2e.ts'],
    {
      cwd: fileURLToPath(new URL('../../api/', import.meta.url)),
      windowsHide: true,
      stdio: 'pipe',
    },
  );
}
