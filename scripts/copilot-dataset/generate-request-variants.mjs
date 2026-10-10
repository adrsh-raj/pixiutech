#!/usr/bin/env node

/**
 * PIXIU TECH CYBERLAB — PHASE 2 REQUEST VARIANT GENERATOR (WP 2.3)
 *
 * Generates controlled, invariant-checked linguistic request variations tied
 * to canonical parent records. IDs and output ordering are stable regardless
 * of parent source order. Read-only mode is available for verification.
 *
 * Produces: data/ai-copilot/phase2/records/requests.jsonl
 * Target: >= 100 high-quality request_to_circuit records.
 *
 * Copyright (c) 2026 Pixiu Tech. All rights reserved.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./bundle-helper.mjs";
import { canonicalSourceSlug, sha256, stableStringify } from "./normalize-record.mjs";
import { getBuildTimestamp } from "./build-metadata.mjs";

const BOARD_NAMES = {
  "arduino-uno": "Arduino Uno",
  "esp32-devkit": "ESP32",
  "rpi-pico": "Raspberry Pi Pico",
  "microbit-v2": "micro:bit",
};
const REQUIRED_STYLES = ["direct", "goal_oriented", "contextual", "colloquial", "typo"];

/**
 * Generate exactly five controlled request variations from a canonical parent.
 * No target circuit or board semantics are invented or changed here.
 */
export function createPromptVariations(canonicalRecord) {
  if (!canonicalRecord?.instruction?.text || !canonicalRecord?.context || !canonicalRecord?.record_id) {
    throw new Error("Request variant generation requires a canonical parent with instruction, context, and record_id");
  }

  const title = canonicalRecord.instruction.text.trim();
  const cleanTitle = title.replace(/\s*\([^)]*\)/g, "").trim() || title;
  const boardId = canonicalRecord.context.target_board || "arduino-uno";
  const boardName = BOARD_NAMES[boardId] || boardId;
  const variants = [
    {
      kind: "paraphrase",
      request_style: "direct",
      text: "Build a " + cleanTitle + " circuit using " + boardName + ".",
    },
    {
      kind: "paraphrase",
      request_style: "goal_oriented",
      text: "How do I set up and wire the " + cleanTitle + " on my " + boardName + "?",
    },
    {
      kind: "paraphrase",
      request_style: "contextual",
      text: "I am in Grade " + (canonicalRecord.context.grade_band || 7) +
        " robotics class. Can you help me assemble the " + cleanTitle + "?",
    },
    {
      kind: "colloquial",
      request_style: "colloquial",
      text: boardName + " me " + cleanTitle + " kaise connect aur wire karein?",
    },
  ];

  let typoTitle = cleanTitle.toLowerCase()
    .replace(/circuit/g, "cirkut")
    .replace(/sensor/g, "sensr");
  if (typoTitle === cleanTitle.toLowerCase()) {
    const words = typoTitle.split(/(\s+)/);
    const candidateIndex = words.findIndex((word) =>
      /^[a-z]{6,}$/i.test(word) && !/^(arduino|raspberry|microbit)$/i.test(word)
    );
    if (candidateIndex >= 0) {
      const word = words[candidateIndex];
      words[candidateIndex] = word.slice(0, 2) + word.slice(3);
      typoTitle = words.join("");
    } else {
      typoTitle += "x";
    }
  }
  variants.push({
    kind: "typo",
    request_style: "typo",
    text: boardName.toLowerCase() + " " + typoTitle + " wiring",
  });

  const observedStyles = variants.map((variant) => variant.request_style);
  if (stableStringify(observedStyles.slice().sort()) !== stableStringify(REQUIRED_STYLES.slice().sort())) {
    throw new Error("Request variant style coverage is incomplete");
  }
  if (new Set(variants.map((variant) => variant.text)).size !== variants.length) {
    throw new Error("Request generator produced duplicate prompts for " + canonicalRecord.record_id);
  }
  return variants;
}

/** Check canonical parents and detect stable-ID collisions before emitting data. */
export function assertCanonicalParents(canonicalRecords) {
  if (!Array.isArray(canonicalRecords) || canonicalRecords.length === 0) {
    throw new Error("Canonical parent input must be a non-empty array");
  }
  const seenIds = new Set();
  const seenSourceSlugs = new Map();
  for (const parent of canonicalRecords) {
    if (
      !parent?.record_id ||
      parent.task_type !== "request_to_circuit" ||
      parent.variant?.kind !== "canonical" ||
      !parent.project_family_id ||
      !parent.source?.source_id ||
      !parent.source?.source_path ||
      !parent.source?.source_revision ||
      !parent.context?.target_board ||
      !Array.isArray(parent.target?.circuit?.parts) ||
      !Array.isArray(parent.target?.circuit?.wires) ||
      !parent.hashes?.source_hash ||
      !parent.hashes?.topology_hash
    ) {
      throw new Error("Invalid canonical request parent: " + (parent?.record_id || "<missing record_id>"));
    }
    if (seenIds.has(parent.record_id)) {
      throw new Error("Duplicate canonical parent record_id: " + parent.record_id);
    }
    seenIds.add(parent.record_id);
    const slug = canonicalSourceSlug(parent.source.source_id);
    if (seenSourceSlugs.has(slug)) {
      throw new Error(
        "Canonical source IDs collide after slug normalization: " +
        seenSourceSlugs.get(slug) + " and " + parent.source.source_id
      );
    }
    seenSourceSlugs.set(slug, parent.source.source_id);
  }
  return true;
}

/** Build request records in a stable order without writing any files. */
export function buildRequestVariants(canonicalRecords, { reviewedAt = getBuildTimestamp() } = {}) {
  assertCanonicalParents(canonicalRecords);
  if (!Number.isFinite(Date.parse(reviewedAt))) {
    throw new Error("Request variant reviewedAt must be a valid ISO-compatible timestamp");
  }

  const parents = canonicalRecords.slice().sort((a, b) => a.record_id.localeCompare(b.record_id));
  const requestRecords = [];
  const usedRecordIds = new Set();

  for (const parent of parents) {
    const variations = createPromptVariations(parent);
    for (const variation of variations) {
      const slug = canonicalSourceSlug(parent.source.source_id);
      const recordId = "pxai2-req-" + slug + "-" + variation.request_style;
      if (usedRecordIds.has(recordId)) {
        throw new Error("Request variant record_id collision: " + recordId);
      }
      usedRecordIds.add(recordId);

      const target = { ...parent.target };
      const requestRecord = {
        record_id: recordId,
        record_schema_version: "1.0.0",
        task_type: "request_to_circuit",
        project_family_id: parent.project_family_id,
        source: {
          ...parent.source,
          source_type: "synthetic_mutation",
          source_id: parent.source.source_id + "#request-" + variation.request_style,
        },
        permission: {
          status: "internal_owned",
          review_status: "approved",
        },
        context: { ...parent.context },
        instruction: { text: variation.text },
        target,
        validation: { ...parent.validation },
        capabilities: { ...parent.capabilities },
        review: {
          status: "approved",
          reviewer: "controlled-request-variant-generator",
          reviewed_at: reviewedAt,
        },
        variant: {
          kind: variation.kind,
          request_style: variation.request_style,
          parent_record_id: parent.record_id,
        },
        hashes: {
          source_hash: parent.hashes.source_hash,
          topology_hash: parent.hashes.topology_hash,
          content_hash: sha256({ text: variation.text, target }),
        },
        limitations: parent.limitations || [],
      };
      requestRecords.push(requestRecord);
    }
  }

  const outputIds = requestRecords.map((record) => record.record_id);
  if (new Set(outputIds).size !== outputIds.length) {
    throw new Error("Request variant IDs are not globally unique");
  }
  return requestRecords;
}

export async function generateRequestVariants({
  writeArtifacts = true,
  canonicalRecords = null,
  reviewedAt = getBuildTimestamp(),
} = {}) {
  const canonPath = resolve(ROOT, "data/ai-copilot/phase2/records/canonical.jsonl");
  let parents = canonicalRecords;
  if (parents === null) {
    const content = readFileSync(canonPath, "utf8").trim();
    if (!content) throw new Error("Canonical record file is empty: " + canonPath);
    parents = content.split(/\r?\n/).map((line) => JSON.parse(line));
  }

  const requestRecords = buildRequestVariants(parents, { reviewedAt });
  if (requestRecords.length < 100) {
    throw new Error("Request variant target not met: " + requestRecords.length + " records; expected at least 100");
  }

  const outPath = resolve(ROOT, "data/ai-copilot/phase2/records/requests.jsonl");
  if (writeArtifacts) {
    const outputContent = requestRecords.map((record) => JSON.stringify(record)).join("\n") + "\n";
    writeFileSync(outPath, outputContent, "utf8");
    console.log("Generated " + requestRecords.length + " request variants into: " + outPath);
  } else {
    console.log("Read-only mode: generated " + requestRecords.length + " request variants; no files written.");
  }
  return requestRecords;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateRequestVariants().catch((error) => {
    console.error("Failed to generate request variants:", error);
    process.exit(1);
  });
}
