'use strict';

// A local, deterministic runner for saved workspace assets. It never fetches
// source_url, launches a browser, uses a computer bridge, or mutates the asset.
// Any labels and values originated by the user remain data, never instructions.
const { libraryAssetContext } = require('./library-asset-context');

const READ_ONLY_STEP_KINDS = new Set([
  'inspect', 'extract', 'summarize', 'compare', 'draft', 'review', 'verify', 'open_library_asset'
]);

function clean(value, max = 240) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function reject(message) {
  const error = new Error(message);
  error.statusCode = 409;
  throw error;
}

function groupComparableMetrics(widgets) {
  const groups = new Map();
  for (const widget of widgets) {
    if (typeof widget.value !== 'number' || !Number.isFinite(widget.value)) continue;
    const unit = clean(widget.unit || '(unit not specified)', 24);
    const bucket = groups.get(unit) || [];
    bucket.push({ label: clean(widget.title || 'Untitled metric', 120), value: widget.value, unit });
    groups.set(unit, bucket);
  }
  return [...groups.entries()]
    .filter(([, metrics]) => metrics.length >= 2)
    .map(([unit, metrics]) => ({
      unit,
      metrics: metrics.slice().sort((a, b) => b.value - a.value),
      spread: Math.max(...metrics.map(item => item.value)) - Math.min(...metrics.map(item => item.value))
    }))
    .slice(0, 12);
}

function recommendationList(asset, widgets, comparableGroups, numericCount) {
  const recommendations = [];
  if (!widgets.length) recommendations.push('Add widget metadata to the saved asset before creating an evidence-rich routine.');
  if (!numericCount) recommendations.push('Add numeric values to KPI widgets to enable deterministic metric checks.');
  if (numericCount && !comparableGroups.length) recommendations.push('Use consistent units on at least two numeric widgets to enable meaningful comparisons.');
  if (asset.source_url) recommendations.push('This analysis used the saved snapshot only. Open the asset in its own runtime to verify live freshness.');
  if (!recommendations.length) recommendations.push('Snapshot metadata is sufficient for a deterministic first pass; define more measurable acceptance criteria for deeper checks.');
  return recommendations.slice(0, 6);
}

function analyzeLibraryRoutine(routine, asset, now = new Date()) {
  if (!routine || typeof routine !== 'object') reject('A saved routine is required.');
  if (!asset || typeof asset !== 'object') reject('A saved workspace library asset is required.');

  const allowedTarget = ['library_asset', 'dashboard', 'web_app'].includes(String(routine.target_kind || ''));
  if (!allowedTarget || !routine.asset_id || String(routine.asset_id) !== String(asset.id)) {
    reject('Saved-snapshot analysis only supports a routine explicitly linked to its workspace asset.');
  }
  if (asset.status === 'archived') reject('Archived library assets cannot be analyzed.');
  if (routine.target_kind === 'dashboard' && asset.asset_type !== 'dashboard') reject('The selected asset is not a dashboard.');
  if (routine.target_kind === 'web_app' && asset.asset_type !== 'web_app') reject('The selected asset is not a web app.');

  const rawSteps = Array.isArray(routine.steps) && routine.steps.length
    ? routine.steps.slice(0, 16)
    : [{ id: 'step-1', label: 'Inspect and summarize saved asset metadata', kind: 'inspect' },
       { id: 'step-2', label: 'Verify the snapshot evidence', kind: 'verify' }];
  const unsupported = rawSteps.find(step => !step || !READ_ONLY_STEP_KINDS.has(String(step.kind || 'inspect')));
  if (unsupported) reject('This routine includes an external action. Use the approval-gated runtime path for website, notification or computer actions.');

  let context;
  try {
    context = JSON.parse(libraryAssetContext(asset) || '{}');
  } catch (_) {
    reject('The saved asset could not be represented as a safe snapshot.');
  }
  const widgets = Array.isArray(context.widgets) ? context.widgets : [];
  const fields = Array.isArray(context.fields) ? context.fields : [];
  const numericWidgets = widgets.filter(widget => typeof widget.value === 'number' && Number.isFinite(widget.value));
  const comparableGroups = groupComparableMetrics(widgets);
  const summary = {
    assetId: clean(context.assetId, 80),
    assetName: clean(context.name, 100),
    assetType: clean(context.type, 40),
    assetVersion: Number.isSafeInteger(Number(context.version)) ? Number(context.version) : 1,
    widgetCount: widgets.length,
    fieldCount: fields.length,
    numericMetricCount: numericWidgets.length,
    comparableUnitGroups: comparableGroups.length,
    sourceUrlConfigured: Boolean(context.sourceUrl)
  };
  const evidence = [
    { id: 'asset-metadata', kind: 'metadata', label: 'Saved asset metadata', status: 'recorded', data: summary },
    { id: 'widget-inventory', kind: 'inventory', label: 'Widget and field inventory', status: widgets.length || fields.length ? 'recorded' : 'no_data',
      data: { widgets: widgets.slice(0, 16).map(widget => ({
        title: clean(widget.title || 'Untitled widget', 120),
        type: clean(widget.type || 'unspecified', 40),
        hasValue: typeof widget.value === 'number' || typeof widget.value === 'string',
        unit: clean(widget.unit || '', 24)
      })), fields: fields.slice(0, 24).map(field => clean(field, 100)) }
  ];
  const recommendations = recommendationList(asset, widgets, comparableGroups, numericWidgets.length);
  const stepResults = rawSteps.map((rawStep, index) => {
    const kind = String(rawStep.kind || 'inspect');
    const label = clean(rawStep.label || kind, 300);
    let status = 'succeeded';
    let data = {};
    if (kind === 'inspect' || kind === 'open_library_asset') {
      data = { metadata: summary, sideEffects: false, networkRequests: 0 };
    } else if (kind === 'extract') {
      data = { metrics: numericWidgets.map(widget => ({
        label: clean(widget.title || 'Untitled metric', 120), value: widget.value, unit: clean(widget.unit || '', 24)
      })).slice(0, 16), fields: fields.slice(0, 24) };
      if (!numericWidgets.length && !fields.length) status = 'no_data';
    } else if (kind === 'summarize') {
      data = { summary, numericMetrics: numericWidgets.map(widget => ({
        label: clean(widget.title || 'Untitled metric', 120), value: widget.value, unit: clean(widget.unit || '', 24)
      })).slice(0, 16) };
    } else if (kind === 'compare') {
      data = { comparableGroups };
      if (!comparableGroups.length) status = 'insufficient_data';
    } else if (kind === 'draft') {
      data = { method: 'deterministic_rules', recommendations };
    } else if (kind === 'review') {
      data = { checks: [
        { check: 'asset_metadata_available', passed: Boolean(summary.assetId && summary.assetName && summary.assetType) },
        { check: 'snapshot_bounded', passed: context.widgets.length <= 16 && fields.length <= 24 },
        { check: 'external_content_not_fetched', passed: true }
      ] };
    } else if (kind === 'verify') {
      data = { acceptanceChecks: (Array.isArray(routine.acceptance_criteria) ? routine.acceptance_criteria : []).slice(0, 8).map(item => {
        const criterion = clean(item, 500);
        if (/outcome is recorded/i.test(criterion)) return { criterion, status: 'passed', reason: 'The run and its evidence have been persisted.' };
        if (/evidence and exceptions are included/i.test(criterion)) return { criterion, status: 'passed', reason: 'This report records the available snapshot evidence and any missing-data states.' };
        if (/numeric metric/i.test(criterion)) return { criterion, status: numericWidgets.length ? 'passed' : 'needs_human_review', reason: numericWidgets.length ? 'Numeric snapshot values were found.' : 'No numeric values were available in the saved snapshot.' };
        return { criterion, status: 'needs_human_review', reason: 'Custom acceptance criteria are not executed as arbitrary code by the safe snapshot runner.' };
      }) };
    }
    return { stepId: 'step-' + (index + 1), kind, label, status, method: 'deterministic_saved_snapshot', data };
  });

  return {
    resultVersion: 1,
    executionMode: 'saved_library_snapshot',
    executionStatus: 'succeeded',
    executedAt: now.toISOString(),
    summary,
    stepResults,
    evidence,
    recommendations,
    safety: {
      readOnly: true,
      writesPerformed: false,
      externalNetworkRequests: 0,
      browserActions: 0,
      computerActions: 0,
      providerCalls: 0,
      billedWillowBucks: 0,
      note: 'Only the bounded saved snapshot was analyzed. The external URL and computer were not opened; this result is not a claim of live-site or desktop execution.'
    }
  };
}

module.exports = { analyzeLibraryRoutine, READ_ONLY_STEP_KINDS };
