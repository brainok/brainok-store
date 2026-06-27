# Private GitHub Release Flow

Use this flow when you want to keep installer files out of public search and
share them only with people who have access to a private GitHub repository.

## Current Windows build

The Windows installer artifacts are generated in:

```text
app-electron/release
```

Upload these three files together:

```text
Brainok-App-0.1.0-win-x64.exe
Brainok-App-0.1.0-win-x64.exe.blockmap
latest.yml
```

`latest.yml` is needed by `electron-updater`. The `.blockmap` file supports
differential updates.

## Important privacy rule

GitHub release privacy follows repository access. Put the release in a private
repository if you want the assets to be private.

People who are not collaborators on that private repository will not be able to
open the release page or download the assets. This is good for internal beta
testing, but it is not ideal for paid customers unless every customer has GitHub
access to the private repository.

For external paid users, prefer Firebase Storage or Cloudflare R2 with a
server-generated temporary download URL.

## Manual upload

1. Create a private GitHub repository, for example `brainok-app-releases`.
2. Open the repository on GitHub.
3. Click Releases.
4. Click Draft a new release.
5. Create tag `v0.1.0`.
6. Release title: `Brainok App v0.1.0`.
7. Upload the three files listed above.
8. Publish the release.
9. In the Netlify app board, set the app's Release URL to:

```text
https://github.com/OWNER/brainok-app-releases/releases/tag/v0.1.0
```

## GitHub CLI upload

Install and authenticate GitHub CLI first:

```powershell
winget install --id GitHub.cli -e
gh auth login
```

After creating a private repository with at least one commit, upload this
release:

```powershell
gh release create v0.1.0 `
  --repo OWNER/brainok-app-releases `
  "app-electron/release/Brainok-App-0.1.0-win-x64.exe" `
  "app-electron/release/Brainok-App-0.1.0-win-x64.exe.blockmap" `
  "app-electron/release/latest.yml" `
  --title "Brainok App v0.1.0" `
  --notes "First Windows beta release."
```

Replace `OWNER` with your GitHub username or organization.

## Rebuild

Build a new Windows release with:

```powershell
npm --workspace app-electron run dist
```

Before uploading a new version, update `app-electron/package.json` version from
`0.1.0` to the next version, such as `0.1.1`.
