/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.winsoft.google-blogger',
  productName: 'winsoft-google-blogger',
  artifactName: '${productName}-${version}.${ext}',
  directories: {
    output: 'dist/electron',
  },
  npmRebuild: false,
  publish: [
    {
      provider: 'github',
      owner: 'pyramid-ing',
      repo: 'f2t-google-blogger-pc',
      releaseType: 'release',
    },
  ],
  asar: true,
  asarUnpack: [
    'node_modules/@prisma/engines/**/*',
    'node_modules/sharp/**/*'
  ],
  files: [
    'dist/main/**/*',
    'dist/preload/**/*',
    'dist/render/**/*',
  ],
  extraResources: [
    {
      from: 'node_modules/sharp',
      to: 'node_modules/sharp',
      filter: ['**/*']
    },
    {
      from: 'node_modules/@prisma',
      to: 'node_modules/@prisma',
      filter: ['**/*'],
    },
    {
      from: 'node_modules/.prisma',
      to: 'node_modules/.prisma',
      filter: ['**/*'],
    },
    {
      from: 'node_modules/prisma',
      to: 'node_modules/prisma',
      filter: ['**/*'],
    },
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
    {
      from: 'db-force-reset.json',
      to: 'db-force-reset.json',
    },
  ],
  mac: {
    icon: 'build/icon.icns',
    target: [
      'dmg',
    ],
    category: 'public.app-category.utilities',
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  win: {
    icon: 'build/icon.ico',
    target: [
      'nsis',
    ],
    artifactName: '${productName}-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    perMachine: true,
    artifactName: '${productName}-Setup-${version}.${ext}',
  },
}

module.exports = config
