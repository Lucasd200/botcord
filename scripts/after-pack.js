// scripts/after-pack.js
//
// Ad-hoc code-sign the macOS .app after electron-builder packs it.
//
// On CI runners (and any machine without an Apple Developer ID certificate)
// electron-builder skips code signing. That leaves the bundle with only the
// linker's default ad-hoc signature: the Info.plist is not bound and the
// bundle resources are unsealed. macOS treats a *quarantined* bundle in that
// state as "damaged" and refuses to open it at all — which is why downloaded
// Mac builds wouldn't launch.
//
// Re-signing the whole bundle ad-hoc ("--sign -") seals its resources and
// binds the Info.plist. The build is still unsigned in the notarization sense,
// so first launch goes through the normal "unidentified developer" Gatekeeper
// prompt (right-click > Open) instead of the dead-end "damaged" error.
//
// If a real signing identity is available, electron-builder's own signing step
// (which runs after this hook) takes over and replaces this signature.

const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  console.log(`[after-pack] ad-hoc signing ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  })
}
