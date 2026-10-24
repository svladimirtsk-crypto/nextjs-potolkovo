#!/usr/bin/env node
/**
 * LED-26 · POSIX catalog publication for a build/PR, not a live-deploy command.
 *
 * One symlink (data/catalog-current) selects an immutable set of JSON inputs.
 * Old flat JSON paths are stable symlinks through that ONE pointer. Changed
 * pictures are written to immutable, release-qualified URLs BEFORE the switch;
 * old URLs are never overwritten. A reader of one release must pin its release
 * id for the duration of a multi-file read; production Next builds already
 * compile a single reviewed Git tree. Do not treat this as a live cross-deploy
 * browser refresh or as supplier/commercial approval.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync,
  renameSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { catalogVersionOf } from "./feed-review.mjs";

export const CATALOG_DATA_FILES = Object.freeze([
  "catalog-retired.json", "catalog-index.json", "catalog-prefill.json",
  "proof-pricing-inputs.json", "catalog-images.json", "catalog-images-missing.json",
  "eks-feed2-snapshot.json", "catalog-review.json",
]);
const REQUIRED_FILES = [...CATALOG_DATA_FILES.map((file) => `data/${file}`), "feed-diff.md"];
const RELEASE_ID = /^r-[0-9a-f]{16}-[0-9a-f-]{36}$/;
const IMAGE_URL = /^\/catalog\/(?:releases\/r-[0-9a-f-]+\/)?[A-Za-z0-9][A-Za-z0-9._-]*-(?:256|512)\.webp$/;
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const pointerPath = (root) => resolve(root, "data/catalog-current");
const releasePath = (root, id) => resolve(root, "data/catalog-releases", id);
const relativeTarget = (id) => `catalog-releases/${id}`;

function assertId(id) {
  if (!RELEASE_ID.test(id)) throw new Error(`недопустимый release ID: ${String(id)}`);
  return id;
}
function assertImageUrl(url) {
  if (!IMAGE_URL.test(url)) throw new Error(`недопустимый локальный путь фото: ${url}`);
  return url;
}
function urlToFile(root, url) {
  return resolve(root, "public", assertImageUrl(url).slice(1));
}
function defaultImageUrl(id, width) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new Error(`недопустимый productId изображения: ${id}`);
  return `/catalog/${id}-${width}.webp`;
}
function imageUrl(entry, id, width) {
  return assertImageUrl(entry?.[`href${width}`] ?? defaultImageUrl(id, width));
}
function atomicSymlink(target, file) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = join(dirname(file), `.catalog-link-${randomUUID()}`);
  try {
    symlinkSync(target, temp);
    renameSync(temp, file); // ONE POSIX rename is the publication/rollback point.
  } finally {
    rmSync(temp, { force: true });
  }
}

/** No guessed ID and no redirect through arbitrary filesystem symlinks. */
export function activeReleaseId(root) {
  const link = pointerPath(root);
  if (!existsSync(link) && !isSymlink(link)) return null;
  if (!isSymlink(link)) throw new Error("data/catalog-current должен быть символической ссылкой");
  const target = readlinkSync(link);
  const id = target.startsWith("catalog-releases/") ? target.slice("catalog-releases/".length) : "";
  return assertId(id);
}
function isSymlink(file) {
  try { return lstatSync(file).isSymbolicLink(); } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
function expectedCatalogVersion(root) {
  const snapshot = json(resolve(root, "data/eks-feed2-snapshot.json"));
  return snapshot.catalogVersion ?? catalogVersionOf(snapshot);
}
function releaseManifest(root, id) {
  assertId(id);
  const manifest = json(resolve(releasePath(root, id), "manifest.json"));
  if (manifest.releaseId !== id || !/^cat-sha256-[a-f0-9]{64}$/.test(manifest.catalogVersion)) {
    throw new Error(`повреждён манифест выпуска ${id}`);
  }
  return manifest;
}

/** All inputs and referenced assets exist and match hashes BEFORE any switch. */
export function verifyCatalogRelease(root, id) {
  const manifest = releaseManifest(root, id);
  if (Object.keys(manifest.files ?? {}).sort().join("|") !== [...REQUIRED_FILES].sort().join("|")) {
    throw new Error(`неполный набор файлов выпуска ${id}`);
  }
  for (const rel of REQUIRED_FILES) {
    if (!/^[a-f0-9]{64}$/.test(manifest.files[rel]) ||
        sha(readFileSync(resolve(releasePath(root, id), rel))) !== manifest.files[rel]) {
      throw new Error(`контрольная сумма не совпала: ${rel}`);
    }
  }
  const snapshot = json(resolve(releasePath(root, id), "data/eks-feed2-snapshot.json"));
  const index = json(resolve(releasePath(root, id), "data/catalog-index.json"));
  if ((snapshot.catalogVersion ?? catalogVersionOf(snapshot)) !== manifest.catalogVersion || index.catalogVersion !== manifest.catalogVersion) {
    throw new Error(`разные версии снапшота и индекса в выпуске ${id}`);
  }
  const photos = json(resolve(releasePath(root, id), "data/catalog-images.json"));
  const urls = new Set(Object.entries(photos).flatMap(([productId, entry]) =>
    [256, 512].map((width) => imageUrl(entry, productId, width))));
  if (urls.size !== Object.keys(manifest.images ?? {}).length) {
    throw new Error(`манифест выпуска ${id} не перечисляет все фото`);
  }
  for (const url of urls) {
    if (!Object.hasOwn(manifest.images, url) ||
        sha(readFileSync(urlToFile(root, url))) !== manifest.images[url]) {
      throw new Error(`неполное или повреждённое фото выпуска: ${url}`);
    }
  }
  return manifest;
}

function createRelease(root, { id, version, previousReleaseId, files, images }) {
  const destination = releasePath(root, id);
  const temp = releasePath(root, `.pending-${randomUUID()}`);
  mkdirSync(resolve(temp, "data"), { recursive: true });
  try {
    const hashes = {};
    for (const rel of REQUIRED_FILES) {
      const content = files[rel];
      if (!Buffer.isBuffer(content)) throw new Error(`нет выходного файла ${rel}`);
      writeFileSync(resolve(temp, rel), content);
      hashes[rel] = sha(content);
    }
    const imageHashes = {};
    for (const url of images) imageHashes[url] = sha(readFileSync(urlToFile(root, url)));
    writeFileSync(resolve(temp, "manifest.json"), `${JSON.stringify({
      releaseId: id, catalogVersion: version, previousReleaseId, files: hashes, images: imageHashes,
    }, null, 2)}\n`);
    if (existsSync(destination)) throw new Error(`выпуск уже существует: ${id}`);
    renameSync(temp, destination);
    verifyCatalogRelease(root, id);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** Adopt the flat last-known-good WITHOUT changing its bytes. This can run
 * after all validation; converting old paths happens only while still on old
 * content. A crash during adoption therefore cannot expose the new catalog. */
function adoptLegacy(root) {
  const dataDir = resolve(root, "data");
  const oldFiles = {};
  for (const file of CATALOG_DATA_FILES) {
    const path = resolve(dataDir, file);
    oldFiles[`data/${file}`] = existsSync(path) ? readFileSync(path)
      : Buffer.from(`${JSON.stringify({ status: "legacy-baseline-unreviewed" })}\n`);
  }
  const report = resolve(root, "feed-diff.md");
  oldFiles["feed-diff.md"] = existsSync(report) ? readFileSync(report)
    : Buffer.from("Начальный каталог: diff не публиковался.\n");
  const snapshot = JSON.parse(oldFiles["data/eks-feed2-snapshot.json"]);
  const version = snapshot.catalogVersion ?? catalogVersionOf(snapshot);
  const indexVersion = JSON.parse(oldFiles["data/catalog-index.json"]).catalogVersion;
  if (!/^cat-sha256-[a-f0-9]{64}$/.test(version) || indexVersion !== version) {
    throw new Error("старый снапшот/индекс без общей проверенной версии — нельзя переключать");
  }
  const images = new Set(Object.entries(JSON.parse(oldFiles["data/catalog-images.json"]))
    .flatMap(([id, entry]) => [256, 512].map((width) => imageUrl(entry, id, width))));
  const id = `r-${version.slice(-16)}-${randomUUID()}`;
  createRelease(root, { id, version, previousReleaseId: null, files: oldFiles, images });
  atomicSymlink(relativeTarget(id), pointerPath(root));
  for (const file of CATALOG_DATA_FILES) {
    const path = resolve(dataDir, file);
    const expected = oldFiles[`data/${file}`];
    if (existsSync(path) && !readFileSync(path).equals(expected)) {
      throw new Error(`старый файл изменился во время переноса: ${file}`);
    }
    atomicSymlink(`catalog-current/data/${file}`, path);
  }
  atomicSymlink("data/catalog-current/feed-diff.md", report);
  return id;
}

/** Refuse partial/manual migration: before switching every legacy path must
 * point through the SAME symlink, not directly at a particular release. */
function assertViews(root) {
  for (const file of CATALOG_DATA_FILES) {
    const path = resolve(root, "data", file);
    if (!isSymlink(path) || readlinkSync(path) !== `catalog-current/data/${file}`) {
      throw new Error(`путь ${file} не связан с общим указателем каталога`);
    }
  }
}
function withLock(root, action) {
  const lock = resolve(root, "data/.catalog-publish.lock");
  mkdirSync(lock); // EEXIST => fail closed, do not steal a potentially live lock.
  try { return action(); } finally { rmSync(lock, { recursive: true, force: true }); }
}

/** Pre-stage: carry forward previously versioned photos, but never reuse an
 * old image if the supplier's cover URL for that product changed. */
export function stageCatalogImages(root, stage, before, after) {
  const oldMap = json(resolve(root, "data/catalog-images.json"));
  const stageImages = resolve(stage, "public/catalog");
  for (const [id, entry] of Object.entries(oldMap)) {
    for (const width of [256, 512]) {
      const url = imageUrl(entry, id, width);
      if (url.includes("/releases/")) copyFileSync(urlToFile(root, url), resolve(stageImages, basename(defaultImageUrl(id, width))));
    }
  }
  const oldCovers = new Map((before.products ?? []).map((product) => [product.productId, product.coverImage]));
  for (const product of after.products ?? []) {
    if (oldCovers.has(product.productId) && oldCovers.get(product.productId) !== product.coverImage) {
      for (const width of [256, 512]) {
        rmSync(resolve(stageImages, basename(defaultImageUrl(product.productId, width))), { force: true });
      }
    }
  }
}

/** Entire release is staged and verified before the ONLY visible change:
 * rename of data/catalog-current. Old image URLs remain immutable. */
export function publishCatalogRelease({ root, stage, report, review, expectedVersion, expectedPointer,
  failpoint = "" }) {
  return withLock(root, () => {
    if (activeReleaseId(root) !== expectedPointer || expectedCatalogVersion(root) !== expectedVersion) {
      throw new Error("каталог изменился во время staging — начните проверку заново");
    }
    const previousId = activeReleaseId(root) ?? adoptLegacy(root);
    assertViews(root);
    verifyCatalogRelease(root, previousId);
    const newVersion = json(resolve(stage, "data/eks-feed2-snapshot.json")).catalogVersion;
    const id = `r-${newVersion.slice(-16)}-${randomUUID()}`;
    const imageMap = json(resolve(stage, "data/catalog-images.json"));
    const pendingAssets = resolve(root, "public/catalog/releases", `.pending-${randomUUID()}`);
    const destinationAssets = resolve(root, "public/catalog/releases", id);
    const destinationRelease = releasePath(root, id);
    const files = {};
    let switched = false;
    try {
      mkdirSync(pendingAssets, { recursive: true });
      const imageUrls = new Set();
      const oldImageMap = json(resolve(root, "data/catalog-images.json"));
      for (const [productId, entry] of Object.entries(imageMap)) {
        for (const width of [256, 512]) {
          const name = basename(defaultImageUrl(productId, width));
          const candidate = readFileSync(resolve(stage, "public/catalog", name));
          const flatUrl = defaultImageUrl(productId, width);
          const priorUrl = oldImageMap[productId] ? imageUrl(oldImageMap[productId], productId, width) : flatUrl;
          let href;
          if (existsSync(urlToFile(root, flatUrl)) && candidate.equals(readFileSync(urlToFile(root, flatUrl)))) {
            href = flatUrl;
          } else if (existsSync(urlToFile(root, priorUrl)) && candidate.equals(readFileSync(urlToFile(root, priorUrl)))) {
            href = priorUrl;
          } else {
            href = `/catalog/releases/${id}/${name}`;
            writeFileSync(resolve(pendingAssets, name), candidate);
          }
          if (href !== flatUrl) entry[`href${width}`] = href;
          else delete entry[`href${width}`];
          imageUrls.add(href);
        }
      }
      for (const file of CATALOG_DATA_FILES) {
        files[`data/${file}`] = file === "catalog-review.json"
          ? Buffer.from(`${JSON.stringify(review, null, 2)}\n`)
          : file === "catalog-images.json"
            ? Buffer.from(`${JSON.stringify(imageMap, null, 2)}\n`)
            : readFileSync(resolve(stage, "data", file));
      }
      files["feed-diff.md"] = Buffer.from(`${report}\n`);
      // Versioned asset paths are not visible from a manifest until they exist.
      mkdirSync(dirname(destinationAssets), { recursive: true });
      renameSync(pendingAssets, destinationAssets);
      createRelease(root, { id, version: newVersion, previousReleaseId: previousId, files, images: imageUrls });
      if (failpoint === "before-switch") throw new Error("LED-26 test: сбой до переключения");
      if (activeReleaseId(root) !== previousId || expectedCatalogVersion(root) !== expectedVersion) {
        throw new Error("каталог изменился перед атомарным переключением");
      }
      atomicSymlink(relativeTarget(id), pointerPath(root));
      switched = true;
      if (failpoint === "after-switch") throw new Error("LED-26 test: сбой после переключения");
      verifyCatalogRelease(root, id);
      return { releaseId: id, previousReleaseId: previousId, catalogVersion: newVersion };
    } catch (error) {
      if (switched) {
        // Rollback is ONE rename. Keep both releases and assets: a concurrent
        // reader might already have pinned the new version when it was active.
        atomicSymlink(relativeTarget(previousId), pointerPath(root));
      } else {
        rmSync(destinationRelease, { recursive: true, force: true });
        rmSync(destinationAssets, { recursive: true, force: true });
      }
      throw error;
    } finally {
      rmSync(pendingAssets, { recursive: true, force: true });
    }
  });
}

/** Operator rollback, no FEED_URL and no automatic production deployment. */
export function rollbackCatalogRelease({ root, targetId = null }) {
  return withLock(root, () => {
    const current = activeReleaseId(root);
    if (!current) throw new Error("нет активного версионированного каталога");
    assertViews(root);
    const manifest = releaseManifest(root, current);
    const previous = targetId ?? manifest.previousReleaseId;
    if (!previous || previous === current) throw new Error("нет предыдущего выпуска для отката");
    verifyCatalogRelease(root, previous);
    atomicSymlink(relativeTarget(previous), pointerPath(root));
    return { fromReleaseId: current, toReleaseId: previous,
      catalogVersion: releaseManifest(root, previous).catalogVersion };
  });
}
