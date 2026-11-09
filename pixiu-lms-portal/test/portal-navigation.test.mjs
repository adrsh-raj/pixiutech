import assert from 'node:assert/strict';
import test from 'node:test';
import { withVirtualCyberlabNavigation } from '../src/config/virtualCyberlabNavigation.js';

const cyberlabIcon = () => null;

function cyberlabLinks(groups) {
  return groups.flatMap(group => group.links).filter(link => link.href === '/simulation');
}

test('adds a Virtual Cyberlab link for roles without an existing simulation link', () => {
  const groups = [{ title: 'MY LEARNING', links: [{ name: 'Overview', key: 'overview' }] }];

  const updated = withVirtualCyberlabNavigation(groups, cyberlabIcon);

  assert.equal(cyberlabLinks(updated).length, 1);
  assert.equal(cyberlabLinks(updated)[0].name, 'Virtual Cyberlab');
  assert.equal(cyberlabLinks(updated)[0].icon, cyberlabIcon);
  assert.equal(updated[0].links[0].name, 'Overview');
});

test('renames an existing simulation link instead of creating a duplicate', () => {
  const groups = [{ title: 'LAB TOOLS', links: [{ name: 'Virtual Arduino Lab', href: '/simulation' }] }];

  const updated = withVirtualCyberlabNavigation(groups, cyberlabIcon);

  assert.equal(cyberlabLinks(updated).length, 1);
  assert.equal(cyberlabLinks(updated)[0].name, 'Virtual Cyberlab');
});
