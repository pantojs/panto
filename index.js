/**
  * Copyright (C) 2016 pantojs.xyz
  * index.js
  *
  * changelog
  * 2016-06-21[17:41:48]:revised
  *
  * @author yanni4night@gmail.com
  * @version 0.0.22
  * @since 0.0.1
  */
'use strict';
const defineFrozenProperty = require('define-frozen-property');

const Panto = require('./src/panto');

/**
 * Global Panto single instance.
 * 
 * @type {Panto}
 * @global
 */
const panto = new Panto();

defineFrozenProperty(global, 'panto', panto, true);

module.exports = panto;