#!/usr/bin/env python3
"""Read-only layout and supplied-manifest consistency audit; NOT a provenance, ONNX or safety certification."""
import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
import sys


def checked_file(path):
    path = Path(path).absolute()
    for part in (path, *path.parents):
        if part.is_symlink():
            raise ValueError(f'Symlink not accepted: {part}')
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f'Missing, empty or nonregular file: {path}')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def check_manifest(path, run, kind, files):
    checked_file(path)
    with Path(path).open(encoding='utf-8') as stream:
        record = json.load(stream)
    if not isinstance(record, dict) or type(record.get('schema_version')) is not int or record['schema_version'] != 1:
        raise ValueError('Manifest schema_version must be integer 1')
    required = ('run_id', 'task_id', 'robot_revision', 'source_commit', 'recorded_at')
    if any(not isinstance(record.get(key), str) or not record[key].strip() for key in required):
        raise ValueError('Manifest requires nonblank run/task/revision/commit/time metadata')
    if record['run_id'] != run.name or record.get('kind') != kind:
        raise ValueError('Manifest run_id or kind does not match the selected run/kind')
    if record.get('backend') not in ('cyclo-lab-physx', 'cyclo-lab-newton', 'cyclo-mjlab'):
        raise ValueError('Manifest backend is not a supported backend label')
    if not re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', record['source_commit']):
        raise ValueError('Manifest source_commit must be a full lowercase Git hash')
    try:
        timestamp = datetime.fromisoformat(record['recorded_at'].replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError('Manifest recorded_at must be ISO 8601 with timezone') from exc
    if timestamp.tzinfo is None:
        raise ValueError('Manifest recorded_at requires timezone')
    artifacts = record.get('artifacts')
    if not isinstance(artifacts, dict) or set(artifacts) != set(files):
        raise ValueError('Manifest artifact roles must exactly match policy/config and optional mimic motion')
    for role, actual in files.items():
        expected = artifacts[role]
        if not isinstance(expected, dict) or not isinstance(expected.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', expected['sha256']):
            raise ValueError(f'Manifest has invalid SHA-256 for {role}')
        if expected['sha256'] != actual['sha256']:
            raise ValueError(f'Manifest SHA-256 mismatch for {role}')
    return {'status': 'hashes_match_supplied_manifest', 'run_id': record['run_id'],
            'task_id': record['task_id'], 'backend': record['backend'],
            'robot_revision': record['robot_revision'], 'source_commit': record['source_commit'],
            'recorded_at': record['recorded_at'], 'authenticity_verified': False}


def audit(run, kind, motion=None, provenance=None):
    run = Path(run).absolute()
    if not run.is_dir():
        raise ValueError(f'Run directory not found: {run}')
    files = {'policy': checked_file(run / 'exported/policy.onnx'),
             'config': checked_file(run / 'params/sim2real.yaml')}
    for item in files.values():
        if not Path(item['path']).resolve().is_relative_to(run.resolve()):
            raise ValueError('Policy/config must remain inside the selected run')
    if kind not in ('velocity', 'mimic'):
        raise ValueError('Kind must be velocity or mimic')
    if kind == 'mimic' and motion is None:
        raise ValueError('Mimic requires --motion pointing to the converted deployment CSV')
    if motion is not None:
        if kind != 'mimic':
            raise ValueError('--motion is only valid for mimic')
        if Path(motion).suffix.lower() != '.csv':
            raise ValueError('Motion reference must be a CSV')
        files['motion'] = checked_file(motion)
    consistency = check_manifest(provenance, run, kind, files) if provenance is not None else None
    return {'status': 'layout_checks_passed', 'kind': kind, 'run': str(run), 'files': files,
            'manifest_consistency': consistency, 'provenance_authenticity_verified': False,
            'requires_review': [
                'Trusted original export record; supplied manifests are unsigned assertions, and copied mixed-run files without an authentic record cannot be certified',
                'ONNX validity, dimensions, joint/observation/action semantics and runtime compatibility',
                'Mimic reference matches training; format, units, FPS and playback window' if kind == 'mimic'
                else 'Simulation evaluation and robot revision compatibility',
                'Robot identity, operator safety, backup, rollback and separate execution authorization']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', required=True, type=Path)
    parser.add_argument('--kind', required=True, choices=['velocity', 'mimic'])
    parser.add_argument('--motion', type=Path)
    parser.add_argument('--provenance', type=Path, help='Check hashes and metadata against a supplied export manifest; does not prove authenticity')
    args = parser.parse_args()
    try:
        result = audit(args.run, args.kind, args.motion, args.provenance)
    except (OSError, ValueError) as exc:
        print(json.dumps({'status': 'blocked', 'error': str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
