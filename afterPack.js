// Ad-hoc code-sign the packaged .app so it runs on Apple Silicon without an
// Apple Developer certificate. Unsigned arm64 apps are hard-blocked by macOS
// ("app is damaged / contains malware"); an ad-hoc signature (`codesign -s -`)
// clears that. Users still clear quarantine once on first open of a download.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  try {
    execFileSync('codesign', ['--force', '--deep', '--timestamp=none', '--sign', '-', appPath],
      { stdio: 'inherit' });
    console.log('  • ad-hoc signed', appPath);
  } catch (e) {
    console.warn('  ! ad-hoc sign failed:', e && e.message);
  }
};
