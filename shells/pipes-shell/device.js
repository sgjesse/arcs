/*
 * Copyright (c) 2019 Google Inc. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * Code distributed by Google as part of this project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import {SyntheticStores} from '../lib/synthetic-stores.js';
import {Context} from './context.js';
import {Pipe} from './pipe.js';
import {Utils} from '../lib/utils.js';

const defaultManifest = `
import 'https://thorn-egret.glitch.me/custom.recipes'
import 'https://$particles/PipeApps/MapsAutofill.recipes'
`;

// TODO(sjmiles): why not automatic?
SyntheticStores.init();

let recipes;
let client;
let userContext;
let testMode;
let recipeManifest;

export const DeviceApiFactory = async (storage, manifest, deviceClient) => {
  recipeManifest = manifest || defaultManifest;
  client = deviceClient;
  await marshalRecipeContext();
  userContext = new Context(storage);
  await signalClientWhenReady(deviceClient);
  return deviceApi;
};

const signalClientWhenReady = async client => {
  // inform client when shell is ready
  const ready = client && client.shellReady;
  if (ready) {
    await userContext.isReady;
    ready.call(client);
  }
};

const marshalRecipeContext = async () => {
  const manifest = await Utils.parse(recipeManifest);
  recipes = manifest.findRecipesByVerb('autofill');
  console.log('supported types:', recipes.map(recipe => recipe.name.toLowerCase().replace(/_/g, '.')));
};

const deviceApi = {
  receiveEntity(json) {
    const id = receiveJsonEntity(json);
    console.log(`[${id}]: received entity`);
    return id;
  },
  observeEntity(json) {
    console.log('observing entity');
    observeJsonEntity(json);
    return true;
  },
  flush() {
    console.log('flushing caches');
    Utils.env.loader.flushCaches();
    marshalRecipeContext();
  }
};

const receiveJsonEntity = async json => {
  try {
    testMode = !json;
    if (userContext.pipesArc) {
      const arc =  await Pipe.receiveEntity(userContext.context, recipes, foundSuggestions, json);
      return String(arc.id);
    }
  } catch (x) {
    console.error(x);
  }
};

const foundSuggestions = (arc, text) => {
  if (testMode) {
    console.log(`[testMode] foundSuggestions("${String(arc.id)}", "${text}")`);
  } else {
    console.warn(`invoking DeviceClient.foundSuggestions("${String(arc.id)}", "${text}")`);
    if (client) {
      client.foundSuggestions(String(arc.id), text);
    }
  }
};

const observeJsonEntity = async json => {
  Pipe.observeEntity(userContext.entityStore, json);
};