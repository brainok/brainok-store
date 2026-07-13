import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const firestoreProjectId = "braionk-lab";
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/admin/downloads/stats.json",
);

function firestoreValue(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return firestoreFields(value.mapValue.fields || {});
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(firestoreValue);
  }
  return null;
}

function firestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields || {}).map(([key, value]) => [key, firestoreValue(value)]),
  );
}

function githubRepoFromUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;

    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;

    return { owner, repo };
  } catch {
    return null;
  }
}

function appDownloadGithubRepos(apps) {
  const repoMap = new Map();

  apps
    .filter((app) => app.status === "active")
    .filter((app) => (app.appType || "application") === "application")
    .forEach((app) => {
      [app.downloads?.macUrl, app.downloads?.releaseUrl].forEach((url) => {
        const githubRepo = githubRepoFromUrl(url);
        if (!githubRepo) return;

        const key = `${githubRepo.owner}/${githubRepo.repo}`;
        const existing = repoMap.get(key);
        if (existing) {
          existing.apps.push(app.name || app.appId || key);
          return;
        }

        repoMap.set(key, {
          ...githubRepo,
          apps: [app.name || app.appId || key],
        });
      });
    });

  return Array.from(repoMap.values()).sort((a, b) => {
    const firstAppA = a.apps[0] || a.repo;
    const firstAppB = b.apps[0] || b.repo;
    return firstAppA.localeCompare(firstAppB);
  });
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function loadPublicApps() {
  const rows = await fetchJson(
    `https://firestore.googleapis.com/v1/projects/${firestoreProjectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "apps" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "visibility" },
              op: "EQUAL",
              value: { stringValue: "public" },
            },
          },
        },
      }),
    },
  );

  return rows
    .map((row) => (row.document?.fields ? firestoreFields(row.document.fields) : null))
    .filter(Boolean);
}

function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "brainok-store-download-stats",
    "x-github-api-version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function loadRepoGroup(repo) {
  const releases = await fetchJson(
    `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases`,
    {
      headers: githubHeaders(),
    },
  );

  const group = {
    appName: repo.apps.join(", ") || repo.repo,
    repoUrl: `https://github.com/${repo.owner}/${repo.repo}`,
    downloads: 0,
    assets: [],
  };

  releases.forEach((release) => {
    (release.assets || []).forEach((asset) => {
      if (!asset.name.toLowerCase().endsWith(".dmg")) return;

      const downloads = asset.download_count || 0;
      group.downloads += downloads;
      group.assets.push({
        version: release.tag_name,
        releaseUrl: release.html_url,
        assetName: asset.name,
        assetUrl: asset.browser_download_url,
        updatedAt: asset.updated_at,
        downloads,
      });
    });
  });

  return group.assets.length > 0 ? group : null;
}

async function main() {
  const apps = await loadPublicApps();
  const repos = appDownloadGithubRepos(apps);
  const groups = [];
  const errors = [];

  for (const repo of repos) {
    try {
      const group = await loadRepoGroup(repo);
      if (group) {
        groups.push(group);
      }
    } catch (error) {
      errors.push({
        appName: repo.apps.join(", ") || repo.repo,
        repo: `${repo.owner}/${repo.repo}`,
        message: error instanceof Error ? error.message : "Failed to load",
      });
    }
  }

  const stats = {
    generatedAt: new Date().toISOString(),
    source: "github-actions",
    firestoreProjectId,
    repoCount: repos.length,
    checkedRepos: groups.length,
    totalAssets: groups.reduce((sum, group) => sum + group.assets.length, 0),
    totalDownloads: groups.reduce((sum, group) => sum + group.downloads, 0),
    errors,
    groups,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(stats, null, 2)}\n`);
  console.log(
    `Wrote ${outputPath}: ${stats.checkedRepos}/${stats.repoCount} repos, ${stats.totalAssets} assets, ${stats.totalDownloads} downloads`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
