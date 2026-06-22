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
const fs = require('fs')

// The cross-arch @snazzah/davey native binding we add for the x64 zip would
// otherwise also get packed into the arm64 build (and vice-versa). A foreign-
// arch Mach-O makes macOS warn "this app includes an Intel component". Remove
// the binding that doesn't match the arch we're packing, BEFORE signing.
function pruneCrossArch(dir, wrongSuffix) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (!entry.isDirectory()) continue
    if (entry.name === `davey-darwin-${wrongSuffix}`) {
      fs.rmSync(full, { recursive: true, force: true })
      console.log(`[after-pack] removed cross-arch binding ${full}`)
    } else {
      pruneCrossArch(full, wrongSuffix)
    }
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  // arch enum: x64 = 1, arm64 = 3
  const wrong = context.arch === 1 ? 'arm64' : context.arch === 3 ? 'x64' : null
  if (wrong) {
    const resources = path.join(appPath, 'Contents', 'Resources')
    try {
      if (fs.existsSync(resources)) pruneCrossArch(resources, wrong)
    } catch (e) {
      console.log('[after-pack] prune skipped:', e.message)
    }
  }

  console.log(`[after-pack] ad-hoc signing ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit',
  })
}
