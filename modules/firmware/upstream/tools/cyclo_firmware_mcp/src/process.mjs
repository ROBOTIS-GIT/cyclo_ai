// SPDX-License-Identifier: Apache-2.0
import { spawn } from 'node:child_process';
// Internal helper; executable/entrypoint are never accepted from MCP arguments.
export async function captureJson(entrypoint, args, signal, timeoutMs = 15000, maxBuffer = 256 * 1024, options = {}) {
  if (signal?.aborted) throw new Error('CLI operation cancelled; no result is available');
  const env = Object.fromEntries(['PATH', 'HOME', 'SYSTEMROOT', 'WINDIR', 'TMPDIR'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, ...args], { shell: false, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let bytes = 0; let failure; let killTimer; let pendingLine = ''; const checkpoints = []; let progress;
    const parseLine = line => {
      try { const value = JSON.parse(line); const p=value.scanProgress;
        if(p && Number.isInteger(p.completed) && Number.isInteger(p.total) && p.completed>=0 && p.completed<=p.total && p.total<=1771 && p.probe && typeof p.probe==='object') { checkpoints.push(p.probe); progress=p; try { options.onProgress?.({completed:p.completed,total:p.total}); } catch {} }
      } catch {}
    };
    const report = () => {
      const output=Buffer.concat(chunks).toString('utf8');
      if(!options.streamScan) return JSON.parse(output);
      const lines=output.trim().split(/\r?\n/);
      for(let i=lines.length-1;i>=0;i--) {try {const value=JSON.parse(lines[i]); if(Array.isArray(value.probes)) return value;}catch{}}
      if(progress) return {probes:checkpoints,complete:false,completed:progress.completed,total:progress.total,stopped:'process_interrupted',nextAction:'Process closed. Continue with unprobed IDs/rates; completed probes are preserved.'};
      throw Error('No bounded scan report');
    };
    const stop = message => {
      if (failure) return;
      failure = new Error(message);
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 200);
    };
    const abort = () => stop('CLI operation cancelled; no result is available');
    signal?.addEventListener('abort', abort, {once:true});
    if (signal?.aborted) abort();
    const timer = setTimeout(() => stop('CLI operation exceeded the execution deadline'), timeoutMs);
    const collect = (chunk, stdout) => {
      bytes += chunk.length;
      if (bytes > maxBuffer) stop('CLI output exceeded the safety limit');
      else if (stdout) { chunks.push(chunk); if(options.streamScan) {pendingLine+=chunk.toString('utf8'); let end; while((end=pendingLine.indexOf('\n'))!==-1) {parseLine(pendingLine.slice(0,end));pendingLine=pendingLine.slice(end+1);}} }
    };
    child.stdout.on('data', chunk => collect(chunk, true));
    // Count but do not echo stderr: it may contain private or untrusted text.
    child.stderr.on('data', chunk => collect(chunk, false));
    child.on('error', () => { failure ??= new Error('CLI process could not be started'); });
    // Only settle after close, keeping the adapter's bus lock through termination.
    child.on('close', code => {
      clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', abort);
      if (failure) {
        // A completed JSON report may precede a hung cleanup/forced exit.
        // Preserve bounded stdout evidence; never expose stderr.
        try { failure.evidence = report(); } catch {}
        return reject(failure);
      }
      if (code !== 0) return reject(new Error('CLI operation failed; check the local CLI build, configured target and connection'));
      try { resolve(report()); }
      catch { reject(new Error('CLI returned invalid JSON; verify the supported CLI build')); }
    });
  });
}
