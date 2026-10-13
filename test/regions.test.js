import test from 'node:test';
import assert from 'node:assert/strict';
import { regionOf, placeOf } from '../src/regions.js';

test('scans from the end and skips "United Kingdom"', () => {
  assert.equal(regionOf('Mayfair, Middlesex, England, United Kingdom').key, 'england');
  assert.equal(regionOf('Glamis, Forfar, Scotland').key, 'scotland');
});
test('US places resolve to macro-regions; longest alias wins', () => {
  assert.equal(regionOf('Boston, Suffolk, Massachusetts, United States').key, 'usa-new-england');
  assert.equal(regionOf('Charleston, West Virginia, USA').key, 'usa-south');
  assert.equal(regionOf('Indiana, Pennsylvania, USA').key, 'usa-mid-atlantic');
});
test('unknown or empty input returns null', () => {
  assert.equal(regionOf(''), null);
  assert.equal(regionOf(undefined), null);
  assert.equal(regionOf('Atlantis'), null);
});
test('no substring false positives', () => {
  assert.equal(regionOf('Georgetown'), null);
});
test('placeOf keeps the first two parts', () => {
  assert.equal(placeOf('Cork, County Cork, Ireland'), 'Cork, County Cork');
});
