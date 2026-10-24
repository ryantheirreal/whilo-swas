'use strict';

const assert = require('node:assert/strict');
const { libraryAssetContext } = require('../web/whilo-swas/server/security/library-asset-context');

const sample = {
  id: 'asset-123',
  name: 'Executive dashboard',
  asset_type: 'dashboard',
  version: 3,
  description: 'A useful summary',
  source_url: 'https://example.com/dashboard',
  definition: {
    widgets: [
      { title: 'Revenue', type: 'metric', description: 'Collected revenue', value: 1250, unit: 'BRL' },
      { title: '<script>alert(1)</script>', kind: 'chart', source_label: 'Untrusted label', value: { executable: true }, extra_secret: 'must not be included' },
      { title: 'x'.repeat(500), description: 'y'.repeat(500) }
    ],
    ignoredPrivateField: 'must not be included'
  }
};

const parsed = JSON.parse(libraryAssetContext(sample));
assert.equal(parsed.assetId, 'asset-123');
assert.equal(parsed.widgets.length, 3);
assert.equal(parsed.widgets[0].value, 1250);
assert.equal(parsed.widgets[1].value, undefined, 'object values must not pass into model context');
assert.equal(parsed.widgets[1].title.length <= 120, true);
assert.equal(parsed.widgets[1].extra_secret, undefined);
assert.equal(parsed.ignoredPrivateField, undefined);
assert.equal(parsed.widgets[2].title.length <= 120, true);
assert.equal(libraryAssetContext(null), '');
assert.equal(libraryAssetContext({ id: 'x', definition: { widgets: 'not-an-array' } }) !== '', true);
const bounded = libraryAssetContext({ id: 'x', name: 'n'.repeat(10000), definition: { widgets: Array.from({length:100}, (_,i)=>({title:'widget '+i,description:'d'.repeat(1000)})) } });
assert.ok(bounded.length <= 2600);
assert.doesNotThrow(() => JSON.parse(bounded), 'bounded context must remain valid JSON');
console.log('Library asset context tests passed.');
