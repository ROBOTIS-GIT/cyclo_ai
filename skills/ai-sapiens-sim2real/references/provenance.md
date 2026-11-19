# Optional export-record consistency check

This is a plugin-local JSON format, not a ROBOTIS standard, signature, registry or ONNX schema. Record it at the actual export from an authorized executor, using the real task/run/commit and hashes. Do not invent these values or generate a fresh manifest around known mixed artifacts to make them pass.

Schema version 1 requires: run_id matching the selected run directory basename; kind velocity or mimic; task_id; backend cyclo-lab-physx, cyclo-lab-newton or cyclo-mjlab; robot_revision; full lowercase source_commit Git hash; recorded_at ISO 8601 with timezone; and artifacts containing policy/config SHA-256 entries (plus motion for Mimic). No unlisted role is accepted. The helper reads only the selected policy/config/motion and manifest, not file paths from the manifest.

Shape example; uppercase tokens below must be replaced from actual evidence before use:

```json
{
  "schema_version": 1,
  "run_id": "ACTUAL_RUN_DIRECTORY_NAME",
  "kind": "velocity",
  "task_id": "ACTUAL_REGISTERED_TASK",
  "backend": "cyclo-mjlab",
  "robot_revision": "ACTUAL_ROBOT_REVISION",
  "source_commit": "ACTUAL_FULL_LOWERCASE_GIT_HASH",
  "recorded_at": "ACTUAL_EXPORT_TIME_WITH_TIMEZONE",
  "artifacts": {
    "policy": {"sha256": "ACTUAL_POLICY_HASH"},
    "config": {"sha256": "ACTUAL_CONFIG_HASH"}
  }
}
```

```bash
python3 skills/ai-sapiens-sim2real/scripts/asset_audit.py --run /absolute/run --kind velocity --provenance /absolute/export-record.json
```

A hash/run/kind mismatch blocks with exit 2. Matching records yield hashes_match_supplied_manifest and authenticity_verified: false. That confirms byte/metadata consistency with the supplied record only. An editable or falsely created manifest can describe a mixed asset; the helper cannot establish original authorship, training provenance, task truth, joint/FPS semantics, ONNX validity or hardware safety. Independently verify the original executor/run record and review compatibility before staging. Without --provenance, only the previous layout/hash inventory runs. Never report either mode as “safe to deploy”.
