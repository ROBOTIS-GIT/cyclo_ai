import { loadJson } from '../catalog-json.mjs';
import { realpathSync } from 'node:fs';
import { inspectBytes } from './raw-read.mjs';
import { groupPlan, readManyItems } from './group.mjs';
import { planGroupWrite, writeManyItems } from './group-write.mjs';
import { swapIds } from './swap.mjs';
import { mimicGuidance } from '../knowledge/mimic.mjs';
import { codeIndex, readCode } from '../knowledge/source.mjs';
import { ITEMS, tableFor, itemFor, writeRequest, readItems, writeItem } from './table.mjs';
import { modelFor } from './registry.mjs';
import { hardwareEnabled, requireConfirmation } from '../hardware-mode.mjs';
import { McpServer, serveStdio, z } from './runtime-deps.mjs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { TargetSession } from './selection.mjs';
import { listModels, readManual } from './manual.mjs';
import { MODELS, CATALOG } from './registry.mjs';
import { scan, scanPlan, validateRequest } from './workflow.mjs';
import { withBus } from './bus-session.mjs';
const targetSchema = z.strictObject({
  port: z.string().min(1),
  model: z.number().int(),
  firmware: z.number().int(),
  id: z.number().int().min(0).max(253),
  baud: z.number().int(),
  protocol: z.union([z.literal(1), z.literal(2)]).optional(),
  catalogId: z.string().optional(),
  peerIds: z.array(z.number().int().min(0).max(253)).max(1).optional(),
  isolatedBus: z.boolean().default(false),
  addressingVerified: z.boolean().default(false),
  allowScan: z.boolean().default(true),
  allowConfigure: z.boolean().default(true),
});
const busSchema = z.strictObject({
  port: z.string().min(1),
  allowScan: z.boolean().default(true),
  allowConfigure: z.boolean().default(true),
});
const configSchema = z.strictObject({
  allowPortDiscovery: z.boolean().default(true),
  buses: z.record(z.string(), busSchema).default({}),
  targets: z.record(z.string(), targetSchema).default({}),
});
export async function createProductsServer(env = process.env, dependencies = {}) {
  const enabled = hardwareEnabled(env, 'CYCLO_PRODUCTS_ENABLE_HARDWARE');
  const config = env.CYCLO_PRODUCTS_CONFIG
    ? configSchema.parse(JSON.parse(await readFile(env.CYCLO_PRODUCTS_CONFIG, 'utf8')))
    : { allowPortDiscovery: true, buses: {}, targets: {} };
  let provider = dependencies.provider;
  const getProvider = async () => {
    if (!enabled)
      throw Error(
        'Hardware and OS serial discovery are disabled. No port or device access occurred.',
      );
    return (provider ??= await (await import('./provider.mjs')).sdkProvider(env));
  };
  const session = new TargetSession(config, { dynamicPorts: !env.CYCLO_PRODUCTS_CONFIG });
  const docs = JSON.parse(
    await readFile(new URL('../../references/dynamixel-docs.json', import.meta.url), 'utf8'),
  );
  const server = new McpServer({ name: 'cyclo-mcp', version: '0.2.1' });
  const wrap = (fn) => async (args, ctx) => {
    try {
      const value = await fn(args, ctx);
      return {
        content: [{ type: 'text', text: JSON.stringify(value) }],
        structuredContent: value,
        ...((value.outcome && ['failed', 'uncertain', 'not_written'].includes(value.outcome)) ||
        value.closureConfirmed === false ||
        value.busReservationReleased === false
          ? { isError: true }
          : {}),
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text', text: e.message }],
        structuredContent: {
          outcome: 'failed',
          error: e.message,
          errorCode: e.code ?? 'OPERATION_FAILED',
          requiresReidentification: e.requiresReidentification === true,
        },
      };
    }
  };
  const add = (name, description, inputSchema, fn, write = false) =>
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: !write,
          destructiveHint: write,
          idempotentHint: !write,
          openWorldHint: ![
            'cyclo_mimic',
            'robotis_sources',
            'dynamixel_registry',
            'dynamixel_targets',
            'dynamixel_models',
            'dynamixel_table',
          ].includes(name),
        },
      },
      wrap(fn),
    );
  add(
    'cyclo_mimic',
    'Read-only BeyondMimic PPO / SuperMimic world-model selection guidance. Runtime, physics and method are separate. Returns checkout checks, artifact contracts and unsupported stages; never inspects local files or starts training/devices.',
    z.strictObject({
      runtime: z.enum(['lab', 'mjlab']),
      method: z.enum(['beyondmimic', 'supermimic']),
      stage: z.enum(['prepare', 'train', 'play', 'export', 'sim2real']).default('prepare'),
    }),
    mimicGuidance,
  );
  add(
    'robotis_code',
    'Inspect pinned official implementation sources by package and exact profile/revision. Index finds paths/symbols/caller locators; read returns bounded Git-blob-verified source. No device, ROS, local-file or code execution.',
    z.strictObject({
      action: z.enum(['index', 'read']),
      package: z.string().optional(),
      profile: z.string().optional(),
      query: z.string().max(120).optional(),
      path: z.string().max(300).optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(50).default(20),
      startLine: z.number().int().min(1).default(1),
      lineCount: z.number().int().min(1).max(160).default(100),
    }),
    async (args, ctx) => {
      const index = loadJson(new URL('../../references/dhi-sources.json', import.meta.url));
      if (args.action === 'index') return codeIndex(index, args);
      if (!args.package || !args.profile || !args.path)
        throw Error(
          'Read requires exact package, source profile/revision and indexed path; installed source is not assumed to be main',
        );
      return readCode(index, args, {
        fetchSource: dependencies.docsFetch ?? fetch,
        signal: ctx.mcpReq.signal,
      });
    },
  );
  add(
    'dynamixel_models',
    'Search all indexed official current/legacy DYNAMIXEL product documents equally, including generation distinctions and mechanical DYD classification. Local metadata only; feature applicability requires exact-source evidence.',
    z.strictObject({
      query: z.string().max(100).default(''),
      limit: z.number().int().min(1).max(100).default(30),
    }),
    async ({ query, limit }) => {
      const matches = listModels(docs, query);
      return {
        revision: docs.revision,
        summary: docs.summary,
        totalMatched: matches.length,
        models: matches.slice(0, limit).map(({ componentPaths, ...m }) => m),
        guides: docs.guides,
        warning:
          'Document counts are not all physical variants or semantically verified feature claims. No privileged documentation model tier; execution matrix is separate.',
      };
    },
  );
  add(
    'dynamixel_manual',
    'Read bounded, blob-verified official English MDX source for any indexed model or guide, retaining caller props and conditional component evidence. Public documentation only; does not render JSX or access hardware.',
    z.strictObject({
      model: z.string().max(160).optional(),
      guide: z.string().max(240).optional(),
      sourcePath: z.string().max(240).optional(),
      topic: z.string().max(100).optional(),
      startLine: z.number().int().min(1).optional(),
      lineCount: z.number().int().min(1).max(160).default(100),
    }),
    async (args, ctx) =>
      readManual(docs, args, {
        fetchSource: dependencies.docsFetch ?? fetch,
        signal: ctx.mcpReq.signal,
      }),
  );
  add(
    'robotis_sources',
    'Find curated official product/source routes. Local metadata only, not full-text retrieval or proof that every product is reviewed.',
    z.strictObject({ query: z.string().min(1).max(150) }),
    async ({ query }) => {
      const index = JSON.parse(
        await readFile(new URL('../../references/robotis-sources.json', import.meta.url), 'utf8'),
      );
      const repos = JSON.parse(
        await readFile(
          new URL('../../references/robotis-repositories.json', import.meta.url),
          'utf8',
        ),
      );
      const known = new Set(index.sources.map((s) => s.url));
      const modelSources = docs.models.map((m) => ({
        id: m.id,
        title: m.title,
        url: m.sourceUrl,
        family: m.family,
        tags: [...m.aliases, ...m.sourceTopics.map((h) => h.title)],
        coverage: 'indexed official source; exact conditional evidence required',
        execution:
          'source-bound named capabilities; unresolved conditions block only that operation',
      }));
      const sources = [
        ...modelSources,
        ...index.sources,
        ...repos.repositories
          .filter((r) => !known.has(r.html_url))
          .map((r) => ({
            id: `repo-${r.name}`,
            title: r.name,
            url: r.html_url,
            family: 'software-tooling',
            tags: [r.name, r.description ?? ''],
            coverage: 'discovered-only',
            reviewedOn: null,
            discoveredOn: repos.discoveredOn,
            execution: 'none',
            repositoryArchived: r.archived,
            lifecycle: 'not inferred from repository status',
            defaultBranch: r.default_branch,
          })),
      ];
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const ranked = sources
        .map((s) => ({
          s,
          score: words.reduce(
            (n, w) =>
              n +
              (JSON.stringify([s.id, s.title, s.tags, s.family]).toLowerCase().includes(w) ? 1 : 0),
            0,
          ),
        }))
        .filter((x) => x.score)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((x) => x.s);
      return {
        reviewedOn: index.reviewedOn,
        sources: ranked,
        completePortfolio: false,
        next: ranked.length
          ? 'Fetch the exact official page using the host web tool and check product/version before answering.'
          : 'Use official ROBOTIS navigation and ROBOTIS-GIT repositories; request exact product/package if ambiguous. No write map is generated from page text.',
      };
    },
  );
  add(
    'dynamixel_registry',
    'Report bundled and reviewed custom model/capability contracts and unresolved operations without device I/O.',
    z.strictObject({ catalogId: z.string().optional() }),
    async ({ catalogId }) => ({
      models: MODELS.filter((m) => !catalogId || m.catalogId === catalogId).map((m) => ({
        catalogId: m.catalogId,
        name: m.name,
        modelNumbers: m.modelNumbers,
        protocols: m.protocols,
        dualAxis: m.dualAxis,
        capabilities: catalogId
          ? m.capabilities
          : Object.fromEntries(
              Object.entries(m.capabilities).map(([op, c]) => [
                op,
                { status: c.status, reason: c.reason },
              ]),
            ),
        ...(catalogId ? { registers: m.registers, bauds: m.bauds, source: m.source } : {}),
      })),
      catalogSummary: CATALOG.summary,
      hardwareEnabled: enabled,
      targets: session.list().map((t) => t.name),
      targetDetails: session.list(),
      buses: Object.keys(config.buses ?? {}),
      runtimeTested: 'mocks only; no installed-host or physical-device verification',
      unsupported: [
        'unreviewed writes',
        'reset',
        'reboot',
        'flashing',
        'unresolved per-item semantics',
      ],
    }),
  );
  add(
    'dynamixel_ports',
    'Discover OS serial ports only with operator-enabled discovery; never opens them or selects a target automatically.',
    z.strictObject({ confirmed: z.boolean().default(false) }),
    async ({ confirmed }) => {
      requireConfirmation(confirmed);
      if (!config.allowPortDiscovery)
        throw Error('Port discovery is not authorized in operator config');
      const p = await getProvider();
      return {
        ports: await p.ports(),
        selectionRequired: true,
        warning:
          'Adapter identity is not actuator identity. Choose a port and bounded scan explicitly.',
      };
    },
  );
  async function onBus(target, permission, work, preflight = () => {}) {
    if (!target || !target[permission])
      throw Error('Unknown target or operation not authorized in operator config');
    const provider = await getProvider();
    return withBus(provider, target, work, { acquireLease: dependencies.lease, preflight });
  }
  const inspectSchema = {
    bus: z.string().optional(),
    target: z.string().optional(),
    port: z.string().min(1).max(512).optional(),
    baud: z.number().int().optional(),
    protocol: z.union([z.literal(1), z.literal(2)]).optional(),
    dryRun: z.boolean().default(true),
    confirmed: z.boolean().default(false),
  };
  async function inspect(args, ids, extra, ctx) {
    const t = session.resolve(args);
    if (!t.allowScan) throw Error('Read inspection is not authorized on this bus');
    if (args.target) session.target(args.target);
    const baud = args.baud ?? t.baud,
      protocol =
        args.protocol ??
        t.protocol ??
        (t.model !== undefined ? modelFor(t.model, t.firmware, t.catalogId).protocol : undefined);
    if (!Number.isInteger(baud) || baud < 9600 || baud > 12000000 || ![1, 2].includes(protocol))
      throw Error('Specify the host baud and packet protocol');
    ids = ids ?? (t.id !== undefined ? [t.id] : undefined);
    if (
      !ids?.length ||
      ids.some((id) => id > (protocol === 1 ? 253 : 252)) ||
      new Set(ids).size !== ids.length
    )
      throw Error('Choose unique valid unicast IDs');
    if (
      args.target &&
      (ids.length !== 1 ||
        ids[0] !== t.id ||
        baud !== t.baud ||
        (t.protocol !== undefined && protocol !== t.protocol))
    )
      throw Error('A target-specific grant cannot inspect another ID, rate or protocol');
    if (
      extra.address !== undefined &&
      (extra.address + extra.length > (protocol === 1 ? 256 : 65536) ||
        (extra.synchronized && protocol !== 2))
    )
      throw Error('Invalid raw read range/protocol');
    if (args.dryRun)
      return {
        executed: false,
        request: { port: t.port, ids, baud, protocol, ...extra },
        interpretation: 'Raw bytes only; source-resolved named reads remain preferred',
      };
    requireConfirmation(args.confirmed);
    return onBus(t, 'allowScan', async (t, connect) =>
      inspectBytes(
        connect,
        { ids, baud, protocol, ...extra, ...(args.target ? { expected: t } : {}) },
        { signal: ctx.mcpReq.signal },
      ),
    );
  }
  add(
    'dynamixel_ping',
    'Bounded read-only unicast Ping for an explicitly selected port/bus/target, including unindexed controllers/sensors. Protocol1 proves presence only. Never selects or writes a device.',
    z.strictObject({ ...inspectSchema, id: z.number().int().min(0).max(253).optional() }),
    async (args, ctx) => inspect(args, args.id === undefined ? undefined : [args.id], {}, ctx),
  );
  add(
    'dynamixel_read_raw',
    'Explicit bounded raw bytes from selected unicast IDs on a selected port/bus, or one configured target. Optional native Protocol2 Sync Read. No signed/unit guesses or write permission; prefer source-resolved named reads when available.',
    z.strictObject({
      ...inspectSchema,
      ids: z.array(z.number().int().min(0).max(253)).min(1).max(254).optional(),
      address: z.number().int().min(0).max(65535),
      length: z.number().int().min(1).max(1024),
      synchronized: z.boolean().default(false),
    }),
    async (args, ctx) =>
      inspect(
        args,
        args.ids,
        { address: args.address, length: args.length, synchronized: args.synchronized },
        ctx,
      ),
  );
  add(
    'dynamixel_targets',
    'Inspect session-selected targets and their confirmed/blocked state without device access.',
    z.strictObject({}),
    async () => ({
      targets: session.list(),
      persistence: 'session only; explicit operator config remains unchanged',
    }),
  );
  add(
    'dynamixel_select',
    'Select one observed device from a completed bounded scan after explicit user confirmation and verified unique bus addressing. No device writes or added operator permissions.',
    z.strictObject({
      scanId: z.string(),
      candidateId: z.string(),
      name: z.string(),
      confirmed: z.boolean(),
      isolatedBus: z.boolean().default(false),
      addressingVerified: z.boolean().default(false),
      catalogId: z.string().optional(),
      peerIds: z.array(z.number().int().min(0).max(253)).max(1).default([]),
    }),
    async (args) => ({ target: await session.select(args) }),
    true,
  );
  add(
    'dynamixel_select_many',
    'Select several candidates from one completed scan. Read-only permissions are preserved; writes independently require verified addressing.',
    z.strictObject({
      scanId: z.string(),
      candidates: z
        .array(
          z.strictObject({
            candidateId: z.string(),
            name: z.string(),
            catalogId: z.string().optional(),
            peerIds: z.array(z.number().int().min(0).max(253)).max(1).default([]),
          }),
        )
        .min(1)
        .max(254),
      confirmed: z.boolean(),
      isolatedBus: z.boolean().default(false),
      addressingVerified: z.boolean().default(false),
    }),
    async (args) => ({ targets: await session.selectMany(args) }),
    true,
  );
  add(
    'dynamixel_scan',
    'Bounded read-only Protocol 1/2 scan on an explicitly selected port, configured bus or existing target. Unknown ID/model needs no preconfigured device identity. Always choose one candidate explicitly.',
    z.strictObject({
      bus: z.string().optional(),
      target: z.string().optional(),
      port: z.string().min(1).max(512).optional(),
      catalogId: z.string().optional(),
      ids: z.array(z.number().int()),
      bauds: z.array(z.number().int()),
      protocols: z.array(z.union([z.literal(1), z.literal(2)])).default([1, 2]),
      timeoutMs: z.number().int().default(30),
      budgetMs: z.number().int().optional(),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      const plan = scanPlan(args),
        bus = session.resolve(args);
      if (!bus.allowScan) throw Error('Scan is not authorized on this bus');
      if (args.dryRun) return { executed: false, plan };
      requireConfirmation(args.confirmed);
      session.clearObservations(bus.port);
      let binding;
      const result = await onBus(bus, 'allowScan', async (t, connect, verifyBinding) => {
        binding = verifyBinding;
        return scan(connect, args, { signal: ctx.mcpReq.signal });
      });
      const selection = session.recordScan(bus, result, binding);
      return {
        ...result,
        selectionRequired: true,
        ...(selection ?? {}),
        next: selection
          ? 'Select the requested observed candidate when the current task already identifies it and verifies addressing; ask only if target/addressing is unresolved.'
          : 'No selectable observation: inspect completeness/errors and do not guess a device.',
      };
    },
  );
  add(
    'dynamixel_swap_ids',
    'Swap actual persistent IDs of two selected, uniquely addressed devices on one bus. Uses a free temporary ID, verifies every transition, and stops on uncertainty. No torque/mode/baud changes.',
    z.strictObject({
      targetA: z.string(),
      targetB: z.string(),
      temporaryId: z.number().int().min(0).max(253),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      if (args.targetA === args.targetB) throw Error('Select two distinct targets');
      const a = { ...session.target(args.targetA) },
        b = { ...session.target(args.targetB) };
      for (const t of [a, b]) t.protocol ??= modelFor(t.model, t.firmware, t.catalogId).protocol;
      if (!a.allowConfigure || !b.allowConfigure)
        throw Error('Both targets require configuration permission');
      if (a.port !== b.port || a.protocol !== b.protocol || a.baud !== b.baud || a.id === b.id)
        throw Error('Swap requires distinct IDs on the same selected port/protocol/baud');
      for (const t of [a, b])
        if (!t.addressingVerified && !t.isolatedBus)
          throw Error('Verified unique addressing required');
      validateRequest({ ...a, changes: { id: args.temporaryId } });
      validateRequest({ ...b, changes: { id: a.id } });
      validateRequest({ ...a, id: args.temporaryId, changes: { id: b.id } });
      if ([a, b].some((t) => modelFor(t.model, t.firmware, t.catalogId, t.protocol).dualAxis))
        throw Error('Dual-axis ID swaps require a source-specific cohort procedure');
      const maximum = Math.min(
        modelFor(a.model, a.firmware, a.catalogId, a.protocol).idMaximum,
        modelFor(b.model, b.firmware, b.catalogId, b.protocol).idMaximum,
      );
      if (args.temporaryId > maximum || [a.id, b.id].includes(args.temporaryId))
        throw Error('Invalid temporary ID');
      if (args.dryRun)
        return {
          executed: false,
          stages: [
            [a.id, args.temporaryId],
            [b.id, a.id],
            [args.temporaryId, b.id],
          ],
          pending: [
            'live identity/torque/lock states',
            'free temporary/destination IDs',
            'transition continuity and closure',
          ],
        };
      requireConfirmation(args.confirmed);
      session.clearObservations(a.port);
      try {
        const result = await onBus(a, 'allowConfigure', async (t, connect) => {
          await b.verifyBinding?.();
          session.target(args.targetA);
          session.target(args.targetB);
          return swapIds(connect, a, b, args.temporaryId, { signal: ctx.mcpReq.signal });
        });
        session.retirePort(a.port, 'ID swap changed bus addressing; re-identify affected targets');
        if (
          result.outcome === 'verified' &&
          result.closureConfirmed &&
          result.busReservationReleased === true
        ) {
          for (const [name, original, location] of [
            [args.targetA, a, result.locations.a],
            [args.targetB, b, result.locations.b],
          ]) {
            session.targets.set(name, {
              ...original,
              ...location,
              status: 'ready',
              revision: original.revision + 1,
            });
          }
          result.targets = [session.describe(args.targetA), session.describe(args.targetB)];
        }
        return result;
      } catch (e) {
        session.retirePort(a.port, 'ID swap requires read-only reconciliation');
        throw e;
      }
    },
    true,
  );
  add(
    'dynamixel_table',
    'Inspect bundled or reviewed custom Control Table rows and their read/write resolution, enums, encoding, source and unresolved conditions. No hardware I/O. Documentation coverage is separate from executable metadata.',
    z.strictObject({
      catalogId: z.string(),
      query: z.string().max(100).default(''),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(30),
    }),
    async ({ catalogId, query, offset, limit }) => {
      const entry = ITEMS.models.find((m) => m.catalogId === catalogId);
      if (!entry) throw Error('Unknown actuator catalog identity');
      const items = entry.items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));
      return {
        catalogId,
        summary: ITEMS.summary,
        totalMatched: items.length,
        items: items.slice(offset, offset + limit),
        nextOffset: offset + limit < items.length ? offset + limit : null,
        limits: ITEMS.limits,
      };
    },
  );
  add(
    'dynamixel_read',
    'Read one exact catalog/custom model-specific named Control Table item after explicit target confirmation. No writes, mode changes or torque commands. Unresolved encodings return raw bytes without guessed units.',
    z.strictObject({
      target: z.string(),
      item: z.string(),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      const t = session.target(args.target),
        model = modelFor(t.model, t.firmware, t.catalogId, t.protocol);
      const items = [itemFor(model, args.item)];
      if (args.dryRun)
        return {
          executed: false,
          items: items.map((i) => ({
            item: i.key,
            address: i.address,
            width: i.width,
            readStatus: i.readStatus,
            source: i.source,
          })),
        };
      requireConfirmation(args.confirmed);
      return onBus(t, 'allowScan', async (t, connect) =>
        readItems(connect, t, [args.item], { signal: ctx.mcpReq.signal }),
      );
    },
  );
  add(
    'dynamixel_read_many',
    'Read one common named item from selected devices using native Sync Read or supported Bulk Read in bounded batches. Read-only; exact per-device bytes and signed/unit metadata; no physical simultaneity claim.',
    z.strictObject({
      targets: z.array(z.string()).min(1).max(253),
      item: z.string(),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      if (new Set(args.targets).size !== args.targets.length)
        throw Error('Choose unique target names');
      const targets = args.targets.map((name) => session.target(name));
      if (targets.some((t) => !t.allowScan)) throw Error('Every selected target must permit reads');
      const entries = groupPlan(targets, args.item);
      if (args.dryRun)
        return {
          executed: false,
          items: entries.map(({ target, item }) => ({
            id: target.id,
            item: item.key,
            address: item.address,
            width: item.width,
          })),
        };
      requireConfirmation(args.confirmed);
      return onBus(targets[0], 'allowScan', async (t, connect) => {
        for (const target of targets) await target.verifyBinding?.();
        return readManyItems(connect, targets, args.item, { signal: ctx.mcpReq.signal });
      });
    },
  );
  add(
    'dynamixel_write',
    'Write one source-resolved Control Table item, including documented motor-control items where semantics are resolved. No arbitrary address input. Explicit customer command supplies confirmed:true once; preview defaults true. Never changes other items implicitly.',
    z.strictObject({
      target: z.string(),
      item: z.string(),
      value: z.number().int(),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      const t = session.target(args.target),
        model = modelFor(t.model, t.firmware, t.catalogId, t.protocol),
        item = itemFor(model, args.item);
      writeRequest(model, item, args.value);
      if (args.dryRun)
        return {
          executed: false,
          item,
          requested: args.value,
          pending: ['live identity', 'documented item preconditions', 'readback'],
          warning:
            'Preview performs no device I/O and is not an observed state or permission to change other items',
        };
      requireConfirmation(args.confirmed);
      try {
        session.clearObservations(t.port);
        const result = await onBus(
          t,
          'allowConfigure',
          async (t, connect) => {
            session.target(args.target);
            return writeItem(connect, t, args.item, args.value, { signal: ctx.mcpReq.signal });
          },
          (t) =>
            session.assertWriteAddress(t, {
              ram: item.memory !== 'EEPROM' || item.write.kind === 'indirect-data',
            }),
        );
        session.settle(args.target, result);
        return { ...result, sessionTarget: session.list().find((t) => t.name === args.target) };
      } catch (e) {
        if (e.requiresReidentification)
          session.retirePort(t.port, 'bus binding or ownership changed');
        throw e;
      }
    },
    true,
  );

  add(
    'dynamixel_write_many',
    'Write one common source-resolved direct RAM item to several selected devices with per-target raw integer values. One native Sync/Bulk Write packet; no splitting, implicit setup or retries. Register verification does not prove simultaneous motion.',
    z.strictObject({
      targets: z
        .array(z.strictObject({ target: z.string(), value: z.number().int() }))
        .min(2)
        .max(253),
      item: z.string(),
      dryRun: z.boolean().default(true),
      confirmed: z.boolean().default(false),
    }),
    async (args, ctx) => {
      if (new Set(args.targets.map((t) => t.target)).size !== args.targets.length)
        throw Error('Choose unique target names');
      const writes = args.targets.map(({ target, value }) => ({
        target: session.target(target),
        item: args.item,
        value,
      }));
      if (writes.some((w) => !w.target.allowConfigure))
        throw Error('Every group target must permit configuration');
      const plan = planGroupWrite(writes);
      if (args.dryRun)
        return {
          executed: false,
          instruction: plan.instruction,
          packetBytes: plan.packetBytes,
          items: plan.entries.map((e) => ({
            id: e.target.id,
            item: e.item.key,
            value: e.value,
            bytes: e.bytes,
            address: e.item.address,
            width: e.item.width,
          })),
          pending: ['live identity', 'documented item preconditions', 'readback'],
        };
      requireConfirmation(args.confirmed);
      const first = writes[0].target;
      try {
        session.clearObservations(first.port);
        const result = await onBus(
          first,
          'allowConfigure',
          async (t, connect) => {
            for (const [i, w] of writes.entries()) {
              session.target(args.targets[i].target);
              await w.target.verifyBinding?.();
            }
            return writeManyItems(connect, writes, { signal: ctx.mcpReq.signal });
          },
          () => {
            for (const w of writes) session.assertWriteAddress(w.target, { ram: true });
          },
        );
        if (
          result.outcome === 'uncertain' ||
          !result.closureConfirmed ||
          result.busReservationReleased !== true
        )
          session.retirePort(first.port, 'Group write requires read-only reconciliation');
        return result;
      } catch (error) {
        if (error.requiresReidentification)
          session.retirePort(first.port, 'Group bus binding or ownership changed');
        throw error;
      }
    },
    true,
  );

  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    await serveStdio(() => createProductsServer());
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
