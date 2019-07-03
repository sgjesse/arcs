/**
 * @license
 * Copyright 2019 Google LLC.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {assert} from '../../../platform/chai-web.js';
import {checkDefined} from '../../../runtime/testing/preconditions.js';
import {ClaimIsTag, ClaimType} from '../../../runtime/particle-claim.js';
import {CheckHasTag} from '../../../runtime/particle-check.js';
import {ProvideSlotConnectionSpec} from '../../../runtime/particle-spec.js';
import {ParticleNode} from '../particle-node.js';
import {buildFlowGraph} from '../testing/flow-graph-testing.js';

describe('FlowGraph', () => {
  it('works with empty recipe', async () => {
    const graph = await buildFlowGraph(`
      recipe R
    `);
    assert.isEmpty(graph.particleMap);
    assert.isEmpty(graph.handles);
  });

  it('works with single particle', async () => {
    const graph = await buildFlowGraph(`
      particle P
      recipe R
        P
    `);
    assert.isEmpty(graph.handles);
    assert.hasAllKeys(graph.particleMap, ['P']);
    const node = checkDefined(graph.particleMap.get('P'));
    assert.isEmpty(node.inEdges);
    assert.isEmpty(node.outEdges);
  });

  it('works with two particles', async () => {
    const graph = await buildFlowGraph(`
      particle P1
        out Foo {} foo
      particle P2
        in Foo {} bar
      recipe R
        P1
          foo -> h
        P2
          bar <- h
    `);
    assert.lengthOf(graph.particles, 2);
    assert.lengthOf(graph.handles, 1);
    assert.hasAllKeys(graph.particleMap, ['P1', 'P2']);
    const P1 = checkDefined(graph.particleMap.get('P1'));
    const P2 = checkDefined(graph.particleMap.get('P2'));
    assert.isEmpty(P1.inEdges);
    assert.isEmpty(P2.outEdges);
    assert.equal(P1.outNodes[0], P2.inNodes[0], 'handle node is different');
    assert.sameMembers(graph.connectionsAsStrings, ['P1.foo -> P2.bar']);
  });

  it('works with handles with multiple inputs', async () => {
    const graph = await buildFlowGraph(`
      particle P1
        out Foo {} foo
      particle P2
        out Foo {} bar
      particle P3
        in Foo {} baz
      recipe R
        P1
          foo -> h
        P2
          bar -> h
        P3
          baz <- h
    `);
    assert.hasAllKeys(graph.particleMap, ['P1', 'P2', 'P3']);
    assert.sameMembers(graph.connectionsAsStrings, ['P1.foo -> P3.baz', 'P2.bar -> P3.baz']);
  });

  it('works with handles with multiple outputs', async () => {
    const graph = await buildFlowGraph(`
      particle P1
        out Foo {} foo
      particle P2
        in Foo {} bar
      particle P3
        in Foo {} baz
      recipe R
        P1
          foo -> h
        P2
          bar <- h
        P3
          baz <- h
    `);
    assert.hasAllKeys(graph.particleMap, ['P1', 'P2', 'P3']);
    assert.sameMembers(graph.connectionsAsStrings, ['P1.foo -> P2.bar', 'P1.foo -> P3.baz']);
  });

  it('works with datastores with tag claims', async () => {
    const graph = await buildFlowGraph(`
      schema MyEntity
        Text text
      resource MyResource
        start
        [{"text": "asdf"}]
      store MyStore of MyEntity in MyResource
        claim is trusted
      particle P
        in MyEntity input
      recipe R
        use MyStore as s
        P
          input <- s
    `);
    assert.lengthOf(graph.edges, 1);
    const claim = graph.edges[0].claim;
    assert.equal(claim.type, ClaimType.IsTag);
    assert.equal((claim as ClaimIsTag).tag, 'trusted');
  });

  it('copies particle claims to particle nodes and out-edges', async () => {
    const graph = await buildFlowGraph(`
      particle P
        out Foo {} foo
        claim foo is trusted
      recipe R
        P
          foo -> h
    `);
    const node = checkDefined(graph.particleMap.get('P'));
    assert.equal(node.claims.size, 1);
    const claim = node.claims.get('foo');
    assert.equal(claim.handle.name, 'foo');
    assert.equal((claim.expression as ClaimIsTag).tag, 'trusted');
    assert.isEmpty(node.checks);

    assert.lengthOf(graph.edges, 1);
    assert.equal(graph.edges[0].claim, claim.expression);
  });

  it('copies particle checks to particle nodes and in-edges', async () => {
    const graph = await buildFlowGraph(`
      particle P
        in Foo {} foo
        check foo is trusted
      recipe R
        P
          foo <- h
    `);
    const node = checkDefined(graph.particleMap.get('P'));
    assert.lengthOf(node.checks, 1);
    const check = node.checks[0];
    assert.equal(check.target.name, 'foo');
    assert.deepEqual(check.expression, new CheckHasTag('trusted'));
    assert.isEmpty(node.claims);

    assert.lengthOf(graph.edges, 1);
    assert.equal(graph.edges[0].check, check);
  });

  it('supports making checks on slots', async () => {
    const graph = await buildFlowGraph(`
      particle P1
        consume root
          provide slotToProvide
        check slotToProvide data is trusted
      particle P2
        consume slotToConsume
      recipe R
        slot 'rootslotid-root' as root
        P1
          consume root as root
            provide slotToProvide as slot0
        P2
          consume slotToConsume as slot0
    `);
    assert.lengthOf(graph.slots, 2);

    const slot1 = checkDefined(graph.slots[0]);
    assert.isEmpty(slot1.outEdges);
    assert.lengthOf(slot1.inEdges, 1);
    assert.equal(slot1.inEdges[0].connectionName, 'root');
    assert.equal((slot1.inEdges[0].start as ParticleNode).name, 'P1');
    assert.isUndefined(slot1.inEdges[0].check);
    assert.isUndefined(slot1.check);

    const slot2 = checkDefined(graph.slots[1]);
    assert.isEmpty(slot2.outEdges);
    assert.lengthOf(slot2.inEdges, 1);
    assert.equal(slot2.inEdges[0].connectionName, 'slotToConsume');
    assert.equal((slot2.inEdges[0].start as ParticleNode).name, 'P2');
    const check = slot2.inEdges[0].check;
    assert.instanceOf(check.target, ProvideSlotConnectionSpec);
    assert.equal(check.target.name, 'slotToProvide');
    assert.deepEqual(check.expression, new CheckHasTag('trusted'));
    assert.equal(check, slot2.check);
  });
});