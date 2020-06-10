/**
 * @license
 * Copyright (c) 2020 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {assert} from '../../platform/chai-web.js';
import {Manifest} from '../../runtime/manifest.js';
import {Schema2Kotlin} from '../schema2kotlin.js';
import {SchemaGraph} from '../schema2graph.js';

describe('schema2kotlin', () => {
  describe('Handle Interface Type', () => {
    it('Read Singleton Entity', async () => await assertHandleInterface(
      `particle P
         h: reads Thing {name: Text}`,
      'ReadSingletonHandle<Thing>'
    ));
    it('Write Singleton Entity', async () => await assertHandleInterface(
      `particle P
         h: writes Thing {name: Text}`,
      'WriteSingletonHandle<Thing>'
    ));
    it('Read Write Singleton Entity', async () => await assertHandleInterface(
      `particle P
         h: reads writes Thing {name: Text}`,
      'ReadWriteSingletonHandle<Thing>'
    ));
    it('Read Write Anonymous Entity', async () => await assertHandleInterface(
      `particle P
         h: reads writes * {name: Text}`,
      'ReadWriteSingletonHandle<P_H>'
    ));
    it('Read Collection of Entities', async () => await assertHandleInterface(
      `particle P
         h: reads [Thing {name: Text}]`,
      'ReadCollectionHandle<Thing>'
    ));
    it('Write Collection of Entities', async () => await assertHandleInterface(
      `particle P
         h: writes [Thing {name: Text}]`,
      'WriteCollectionHandle<Thing>'
    ));
    it('Read Write Collection of Entities', async () => await assertHandleInterface(
      `particle P
         h: reads writes [Thing {name: Text}]`,
      'ReadWriteCollectionHandle<Thing>'
    ));
    it('Read Collection of Entities and Query by String', async () => await assertHandleInterface(
      `particle P
         h: reads [Thing {name: Text} [name == ?]]`,
      'ReadQueryCollectionHandle<Thing, String>'
    ));
    it('Read Write Collection of Entities and Query by Number', async () => await assertHandleInterface(
      `particle P
         h: reads writes [Thing {age: Number} [age > ?]]`,
      'ReadWriteQueryCollectionHandle<Thing, Double>'
    ));
    it('Read Reference Singleton', async () => await assertHandleInterface(
      `particle P
         h: reads &Thing {name: Text}`,
      'ReadSingletonHandle<Reference<Thing>>'
    ));
    it('Write Reference Singleton', async () => await assertHandleInterface(
      `particle P
         h: writes &Thing {name: Text}`,
      'WriteSingletonHandle<Reference<Thing>>'
    ));
    it('Read Collection of References', async () => await assertHandleInterface(
      `particle P
         h: reads [&Thing {name: Text}]`,
      'ReadCollectionHandle<Reference<Thing>>'
    ));
    it('Write Collection of References', async () => await assertHandleInterface(
      `particle P
         h: writes [&Thing {name: Text}]`,
      'WriteCollectionHandle<Reference<Thing>>'
    ));
    it('Read Tuple of 2 References', async () => await assertHandleInterface(
      `particle P
         h: reads (&Foo {name: Text}, &Bar {age: Number})`,
      'ReadSingletonHandle<Tuple2<Reference<Foo>, Reference<Bar>>>'
    ));
    it('Write Collection of Tuples of 3 References', async () => await assertHandleInterface(
      `particle P
         h: writes [(&Foo {name: Text}, &Bar {age: Number}, &Baz {isThisIt: Boolean})]`,
      'WriteCollectionHandle<Tuple3<Reference<Foo>, Reference<Bar>, Reference<Baz>>>'
    ));
    async function assertHandleInterface(manifestString: string, expectedHandleInterface: string) {
      const manifest = await Manifest.parse(manifestString);
      assert.lengthOf(manifest.particles, 1);
      assert.lengthOf(manifest.particles[0].connections, 1);

      const [particle] = manifest.particles;
      const [connection] = particle.connections;

      const graph = new SchemaGraph(particle);
      const schema2kotlin = new Schema2Kotlin({_: []});

      assert.equal(
        schema2kotlin.handleInterfaceType(connection, graph.nodes),
        expectedHandleInterface);
    }
  });
  describe('Handles Class Declaration', () => {
    it('Single Read Handle', async () => await assertHandleClassDeclaration(
      `particle P
         h1: reads Person {name: Text}`,
      `class Handles : HandleHolderBase(
        "P",
        mapOf("h1" to Person)
    ) {
        val h1: ReadSingletonHandle<Person> by handles
    }`
    ));
    it('Conflicting Schema Names', async () => await assertHandleClassDeclaration(
      `particle P
         h1: reads Person {name: Text}
         h2: reads Person {age: Number}`,
      `class Handles : HandleHolderBase(
        "P",
        mapOf("h1" to P_H1, "h2" to P_H2)
    ) {
        val h1: ReadSingletonHandle<P_H1> by handles
        val h2: ReadSingletonHandle<P_H2> by handles
    }`
    ));
    it('Read, Write and Query Handles', async () => await assertHandleClassDeclaration(
      `particle P
        h1: reads Person {name: Text}
        h2: writes Person {name: Text}
        h3: reads [Person {name: Text} [name == ?]]
      `,
      `class Handles : HandleHolderBase(
        "P",
        mapOf("h1" to P_H1, "h2" to P_H2, "h3" to P_H3)
    ) {
        val h1: ReadSingletonHandle<P_H1> by handles
        val h2: WriteSingletonHandle<P_H2> by handles
        val h3: ReadQueryCollectionHandle<P_H3, String> by handles
    }`
    ));
    it('Handle with references', async () => await assertHandleClassDeclaration(
      `particle P
        h1: reads Person {
          name: Text,
          home: &Accommodation {
            squareFootage: Number,
            address: &Address {
              streetAddress: Text,
              postCode: Text  
            }
          }
        }
      `,
      `class Handles : HandleHolderBase(
        "P",
        mapOf("h1" to Person)
    ) {
        val h1: ReadSingletonHandle<Person> by handles
    }`
    ));
    // Below test shows the shortcoming of our handle declaration, which allows
    // specifying a single entity per handle.
    // TODO(b/157598151): Update HandleSpec from hardcoded single EntitySpec to
    //                    allowing multiple EntitySpecs for handles of tuples.
    it('Handle with a tuple', async () => await assertHandleClassDeclaration(
      `particle P
        h1: reads (
          &Person {name: Text},
          &Accommodation {squareFootage: Number},
          &Address {streetAddress: Text, postCode: Text}
        )
      `,
      `class Handles : HandleHolderBase(
        "P",
        mapOf("h1" to Person)
    ) {
        val h1: ReadSingletonHandle<Tuple3<Reference<Person>, Reference<Accommodation>, Reference<Address>>> by handles
    }`
    ));
    async function assertHandleClassDeclaration(manifest: string, expectedHandleClass: string) {
      await assertComponent(manifest, ({handleClassDecl}) => handleClassDecl, expectedHandleClass);
    }
  });
  describe('Schema Aliases', () => {
    it('Single Entity', async () => await assertSchemaAliases(
      `particle P
        h1: reads Person {name: Text}
      `, [
        'typealias P_H1 = AbstractP.Person'
      ]
    ));
    it('Multiple Connections with the same Schema', async () => await assertSchemaAliases(
      `particle P
         h1: reads Person {name: Text}
         h2: reads [Person {name: Text}]
         h3: reads [&Person {name: Text}]
      `, [
        'typealias P_H1 = AbstractP.Person',
        'typealias P_H2 = AbstractP.Person',
        'typealias P_H3 = AbstractP.Person',
      ]
    ));
    it('Handle with references', async () => await assertSchemaAliases(
      `particle P
        h1: reads Person {
          name: Text,
          home: &Accommodation {
            squareFootage: Number,
            address: &Address {
              streetAddress: Text,
              postCode: Text  
            }
          }
        }
      `, [
        'typealias P_H1 = AbstractP.Person',
        'typealias P_H1_Home = AbstractP.Accommodation',
        'typealias P_H1_Home_Address = AbstractP.Address',
      ]
    ));
    it('Handle with a tuple', async () => await assertSchemaAliases(
      `particle P
        h1: reads (
          &Person {name: Text},
          &Accommodation {squareFootage: Number},
          &Address {streetAddress: Text, postCode: Text}
        )
      `, [
        'typealias P_H1_0 = AbstractP.Person',
        'typealias P_H1_1 = AbstractP.Accommodation',
        'typealias P_H1_2 = AbstractP.Address',
      ]
    ));
    async function assertSchemaAliases(manifest: string, expectedAliases: string[]) {
      await assertComponent(manifest, ({typeAliases}) => typeAliases.sort(), expectedAliases);
    }
  });

  // Asserts that a certain generated component, i.e. one of the results of the
  // generateParticleClassComponents equals the expected value.
  async function assertComponent<T>(
      manifestString: string,
      extractor: <T>({typeAliases, classes, handleClassDecl}) => T,
      expectedValue: T) {
    const manifest = await Manifest.parse(manifestString);
    assert.lengthOf(manifest.particles, 1);
    const [particle] = manifest.particles;

    const schema2kotlin = new Schema2Kotlin({_: []});
    const generators = await schema2kotlin.calculateNodeAndGenerators(particle);
    const components = schema2kotlin.generateParticleClassComponents(particle, generators);
    assert.deepEqual(extractor(components), expectedValue);
  }

  describe('Test Harness', () => {
    it('exposes a handle as a read write handle regardless of particle spec direction', async () => await assertTestHarness(
      `particle P
        h1: reads Person {name: Text}
        h2: reads Address {streetAddress: Text}
      `, `
class PTestHarness<P : AbstractP>(
    factory : (CoroutineScope) -> P
) : BaseTestHarness<P>(factory, listOf(
    HandleSpec("h1", HandleMode.ReadWrite, HandleContainerType.Singleton, P_H1, HandleDataType.Entity),
    HandleSpec("h2", HandleMode.ReadWrite, HandleContainerType.Singleton, P_H2, HandleDataType.Entity)
)) {
    val h1: ReadWriteSingletonHandle<P_H1> by handleMap
    val h2: ReadWriteSingletonHandle<P_H2> by handleMap
}
`
    ));
    it('specifies handle type correctly - singleton, collection, entity, reference, tuples', async () => await assertTestHarness(
      `particle P
        singletonEntity: reads Person {name: Text}
        singletonReference: writes &Person {name: Text}
        collectionEntity: writes [Person {name: Text}]
        collectionReference: reads [&Person {name: Text}]
        collectionTuples: reads [(&Product {name: Text}, &Manufacturer {name: Text})]
  `,
    // TODO(b/157598151): Update HandleSpec from hardcoded single EntitySpec to
    //                    allowing multiple EntitySpecs for handles of tuples.
`
class PTestHarness<P : AbstractP>(
    factory : (CoroutineScope) -> P
) : BaseTestHarness<P>(factory, listOf(
    HandleSpec("singletonEntity", HandleMode.ReadWrite, HandleContainerType.Singleton, P_SingletonEntity, HandleDataType.Entity),
    HandleSpec("singletonReference", HandleMode.ReadWrite, HandleContainerType.Singleton, P_SingletonReference, HandleDataType.Reference),
    HandleSpec("collectionEntity", HandleMode.ReadWrite, HandleContainerType.Collection, P_CollectionEntity, HandleDataType.Entity),
    HandleSpec("collectionReference", HandleMode.ReadWrite, HandleContainerType.Collection, P_CollectionReference, HandleDataType.Reference),
    HandleSpec("collectionTuples", HandleMode.ReadWrite, HandleContainerType.Collection, P_CollectionTuples_0, HandleDataType.Entity)
)) {
    val singletonEntity: ReadWriteSingletonHandle<P_SingletonEntity> by handleMap
    val singletonReference: ReadWriteSingletonHandle<Reference<P_SingletonReference>> by handleMap
    val collectionEntity: ReadWriteCollectionHandle<P_CollectionEntity> by handleMap
    val collectionReference: ReadWriteCollectionHandle<Reference<P_CollectionReference>> by handleMap
    val collectionTuples: ReadWriteCollectionHandle<Tuple2<Reference<P_CollectionTuples_0>, Reference<P_CollectionTuples_1>>> by handleMap
}
`
    ));
    async function assertTestHarness(manifestString: string, expected: string) {
      const manifest = await Manifest.parse(manifestString);
      assert.lengthOf(manifest.particles, 1);
      const [particle] = manifest.particles;

      const schema2kotlin = new Schema2Kotlin({_: []});
      const generators = await schema2kotlin.calculateNodeAndGenerators(particle);
      const nodes = generators.map(g => g.node);
      const actual = schema2kotlin.generateTestHarness(particle, nodes);
      assert.equal(actual, expected);
    }
  });
});
