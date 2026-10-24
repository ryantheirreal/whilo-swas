'use strict';

function text(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function libraryAssetContext(asset) {
  if (!asset || typeof asset !== 'object') return '';
  const definition = asset.definition && typeof asset.definition === 'object' && !Array.isArray(asset.definition)
    ? asset.definition : {};
  const widgets = Array.isArray(definition.widgets) ? definition.widgets.slice(0, 16).map(function (widget) {
    if (!widget || typeof widget !== 'object' || Array.isArray(widget)) return null;
    const item = {};
    if (typeof widget.title === 'string') item.title = text(widget.title, 120);
    if (typeof widget.type === 'string') item.type = text(widget.type, 40);
    else if (typeof widget.kind === 'string') item.type = text(widget.kind, 40);
    if (typeof widget.description === 'string') item.description = text(widget.description, 240);
    if (typeof widget.sourceLabel === 'string') item.sourceLabel = text(widget.sourceLabel, 120);
    else if (typeof widget.source_label === 'string') item.sourceLabel = text(widget.source_label, 120);
    if (typeof widget.value === 'number' && Number.isFinite(widget.value)) item.value = widget.value;
    else if (typeof widget.value === 'string') item.value = text(widget.value, 100);
    if (typeof widget.unit === 'string') item.unit = text(widget.unit, 24);
    return Object.keys(item).length ? item : null;
  }).filter(Boolean) : [];
  const fields = Array.isArray(definition.fields) ? definition.fields.slice(0, 24).map(function (field) {
    if (typeof field === 'string') return text(field, 100);
    if (!field || typeof field !== 'object' || Array.isArray(field)) return '';
    return text(field.name || field.label || field.key || '', 100);
  }).filter(Boolean) : [];
  const payload = {
    assetId: text(asset.id, 80),
    name: text(asset.name, 100),
    type: text(asset.asset_type, 40),
    version: Number(asset.version || 1),
    description: text(asset.description, 500),
    sourceUrl: text(asset.source_url, 500),
    widgets,
    fields
  };
  let encoded = JSON.stringify(payload);
  while (encoded.length > 2600 && payload.widgets.length) {
    payload.widgets.pop();
    encoded = JSON.stringify(payload);
  }
  while (encoded.length > 2600 && payload.fields.length) {
    payload.fields.pop();
    encoded = JSON.stringify(payload);
  }
  if (encoded.length > 2600) {
    payload.description = payload.description.slice(0, 180);
    payload.sourceUrl = payload.sourceUrl.slice(0, 180);
    encoded = JSON.stringify(payload);
  }
  return encoded;
}
module.exports = { libraryAssetContext };
