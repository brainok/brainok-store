# Brainok App Release Repo Workflow

이 문서는 Brainok macOS 앱을 배포할 때 사용하는 두 저장소 구조를 설명합니다.

목표는 Codex에게 로컬 앱 폴더 주소만 알려줘도 다음 작업을 일관되게 수행하게 만드는 것입니다.

```text
private source repo
  -> app code, build scripts, signing, notarization
  -> example: Hotkey-launcher-mac

public release repo
  -> notarized DMG files, lightweight README, GitHub Releases latest asset
  -> example: Hotkey-launcher-mac-release
```

## Can Codex Create The Release Repo?

가능합니다. 사용자가 반드시 GitHub에서 직접 만들 필요는 없습니다.

Codex가 release repo를 만들 수 있는 조건:

- 이 Mac의 git credential에 GitHub 권한이 저장되어 있음.
- GitHub token이 repo 생성 권한을 가짐.
- release repo를 public으로 만들어도 된다는 사용자의 명확한 지시가 있음.
- GitHub 조직 또는 계정 이름이 명확함. 현재 기본값은 `brainok`.

Codex가 자동으로 만들 수 없는 경우:

- GitHub 인증이 없음.
- token에 repo 생성 권한이 없음.
- 조직 정책상 API repo 생성이 막혀 있음.
- 사용자가 public/private 여부를 명확히 정하지 않음.

그 경우 사용자가 GitHub에서 빈 public repo만 직접 만든 뒤, Codex가 나머지 push, tag, release asset 업로드를 처리하면 됩니다.

## Recommended Repo Names

앱 소스 repo:

```text
{AppName}-mac
```

public release repo:

```text
{AppName}-mac-release
```

Examples:

| App | Source Repo | Public Release Repo |
| --- | --- | --- |
| Hotkey Launcher | `Hotkey-launcher-mac` | `Hotkey-launcher-mac-release` |
| PageWheel | `PageWheel-mac` | `PageWheel-mac-release` |
| Brainok Clipboard | `Brainok-Clipboard-mac` | `Brainok-Clipboard-mac-release` |

## Standard Release Repo Layout

```text
README.md
README_EN.md
README_KO.md
Release/
  v2.06/
    Hotkey-Launcher.dmg
  v2.07/
    Hotkey-Launcher.dmg
```

The public download URL should always use GitHub Releases latest:

```text
https://github.com/brainok/{release-repo}/releases/latest/download/{DMG-FILENAME}.dmg
```

Example:

```text
https://github.com/brainok/Hotkey-launcher-mac-release/releases/latest/download/Hotkey-Launcher.dmg
```

## Why Two Repos?

The source repo can stay private and contain:

- source code
- build scripts
- signing setup names
- private development history
- debugging notes

The release repo can be public and contain only:

- notarized DMG
- checksum
- install instructions
- GitHub Releases download asset

This keeps downloads simple while avoiding accidental source exposure.

## Standard Release Flow

1. Receive local source folder path from the user.
2. Inspect source repo:
   - `git status --short --branch`
   - `git remote -v`
   - version files
   - build scripts
   - signing/notarization scripts
3. Update app version if requested.
4. Build the app.
5. Create DMG.
6. Sign DMG.
7. Notarize DMG.
8. Staple DMG.
9. Verify DMG:
   - `codesign --verify --verbose=2`
   - `spctl --assess --type open --context context:primary-signature -vv`
   - `hdiutil verify`
   - `shasum -a 256`
10. Commit and push source repo changes.
11. Create or update public release repo.
12. Copy DMG into `Release/{version}/`.
13. Update README files with latest version and SHA-256.
14. Commit and push release repo.
15. Tag release repo with the same version.
16. Create or update GitHub Release.
17. Upload `{DMG-FILENAME}.dmg` as release asset.
18. Confirm `releases/latest/download/...` downloads the new DMG.

## Creating A Public Release Repo

Preferred method if GitHub CLI exists:

```bash
gh repo create brainok/{release-repo} --public --description "{AppName} public release downloads"
```

Fallback method if `gh` is not installed:

Use the GitHub REST API with the token from git credential when available.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/orgs/brainok/repos \
  -d '{
    "name": "AppName-mac-release",
    "private": false,
    "description": "AppName public release downloads",
    "has_issues": false,
    "has_projects": false,
    "has_wiki": false
  }'
```

For a personal account instead of an organization:

```text
POST https://api.github.com/user/repos
```

## Initializing The Release Repo Locally

```bash
mkdir -p "{release-local-folder}/Release/{version}"
cd "{release-local-folder}"
git init
git remote add origin "https://github.com/brainok/{release-repo}.git"
```

Create:

- `README.md`
- `README_EN.md`
- `README_KO.md`
- `.gitignore`

Recommended `.gitignore`:

```gitignore
.DS_Store
```

Do not ignore DMG files in the release repo. DMG files are the purpose of this repo.

## GitHub Release Asset Rule

The release repo can store historical DMGs under `Release/vX.YY/`, but the public store should download from GitHub Releases latest:

```text
https://github.com/brainok/{release-repo}/releases/latest/download/{DMG-FILENAME}.dmg
```

This means each release must update both:

- git repo files under `Release/{version}/`
- GitHub Releases asset named exactly `{DMG-FILENAME}.dmg`

If the asset name changes, update the store download URL too.

## Checksums

Every release README should include:

```text
Latest release: vX.YY
SHA-256: {sha256}
```

The checksum must match the GitHub Releases latest download, not only the local file.

Verify:

```bash
curl -L -o /tmp/latest.dmg \
  "https://github.com/brainok/{release-repo}/releases/latest/download/{DMG-FILENAME}.dmg"

shasum -a 256 /tmp/latest.dmg
```

## Codex Prompt For Another App

Use this prompt when releasing another Brainok app:

```text
이 로컬 앱 폴더를 기준으로 Brainok 표준 배포 구조를 만들어줘:

{LOCAL_APP_FOLDER}

해야 할 일:

1. 먼저 현재 git repo, remote, branch, version, build script, DMG/notarization script를 분석해줘.
2. 앱 소스 repo는 private source repo로 유지해줘.
3. public release repo가 없으면 GitHub에 brainok/{APP_REPO_NAME}-release 이름으로 public repo를 만들 수 있는지 확인하고, 가능하면 만들어줘.
4. GitHub 인증이나 권한 때문에 자동 생성이 안 되면, 내가 GitHub에서 빈 public repo만 만들면 되도록 정확한 repo 이름을 알려줘.
5. 앱을 요청한 버전으로 빌드하고 notarized DMG를 만들어줘.
6. DMG 검증을 실행해줘:
   - codesign --verify
   - spctl --assess
   - hdiutil verify
   - shasum -a 256
7. source repo에는 앱 코드와 빌드 스크립트 변경만 commit/push/tag 해줘.
8. release repo에는 Release/{VERSION}/{DMG_FILENAME}.dmg, README.md, README_EN.md, README_KO.md를 commit/push/tag 해줘.
9. GitHub Releases에서 {VERSION} release를 만들고 {DMG_FILENAME}.dmg asset을 올려줘.
10. releases/latest/download/{DMG_FILENAME}.dmg URL이 새 DMG를 내려받는지 checksum으로 확인해줘.
11. 마지막에 source repo commit, release repo commit, tag, latest URL, SHA-256을 요약해줘.

중요:
- source repo와 release repo는 서로 다른 git repo여도 정상이다.
- public에는 DMG와 README만 올리고 source code는 올리지 않는다.
- store.brainok.net 다운로드 링크는 release repo의 GitHub Releases latest URL을 사용한다.
```

## Manual Fallback

Codex가 GitHub repo를 만들 수 없다고 하면 사용자가 직접 할 일은 하나입니다:

1. GitHub에서 새 public repo 생성:

```text
brainok/{AppName}-mac-release
```

나머지는 Codex가 처리할 수 있습니다:

- local release repo 초기화
- README 작성
- DMG 복사
- commit/push/tag
- GitHub Release 생성
- latest asset 업로드
- checksum 검증

