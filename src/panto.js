/**
 * Copyright (C) 2016 pantojs.xyz
 * panto.js
 *
 * changelog
 * 2016-06-21[18:46:42]:revised
 * 2016-06-26[12:17:28]:add match to panto.file
 * 2016-06-26[17:36:31]:dependencies map
 * 2016-07-01[00:05:53]:fixed isbinary
 * 2016-07-04[23:14:52]:use binary extension;add rimraf
 * 2016-07-11[11:42:55]:upgrade stream to support multiple files transforming
 * 2016-07-12[14:15:12]:new loadTransformer
 * 2016-07-19[10:35:28]:new stream
 * 2016-07-20[22:53:59]:support "src" option
 * 2016-07-21[21:30:45]:throw error if src and output matches
 * 2016-07-22[23:18:53]:emit start event
 * 2016-07-30[14:24:55]:optimize
 * 2016-07-31[00:43:20]:remove useless log
 * 2016-08-18[13:28:07]:remove log
 * 2016-08-19[17:49:18]:dormant stream supported
 * 2016-09-01[18:31:20]:add id for building events
 * 2016-10-21[13:06:51]:add watch_ignore option
 * 2016-11-03[11:52:45]:async/await
 *
 * @author yanni4night@gmail.com
 * @version 0.2.0
 * @since 0.0.1
 */
'use strict';

const path = require('path');
const EventEmitter = require('events');

const chokidar = require('chokidar');
const subdir = require('subdir');
const glob = require('glob');
const lodash = require('lodash');
const c2p = require('callback2promise');

const defineFrozenProperty = require('define-frozen-property');
const logger = require('panto-logger');
const PantoStream = require('panto-stream');
const Options = require('panto-options');
const FileUtils = require('panto-file-utils');
const DependencyMap = require('panto-dependency-map');

const FileCollection = require('./file-collection');

const {
    isString,
    camelCase,
    flattenDeep,
    uniq
} = lodash;

/** Class representing a panto */
class Panto extends EventEmitter {
    constructor() {
            super();

            const options = new Options({
                cwd: process.cwd(),
                src: '.',
                output: 'output',
                binary_resource: '',
                watch_ignore: []
            });

            defineFrozenProperty(this, 'Stream', PantoStream, true);
            defineFrozenProperty(this, 'options', options, true);
            defineFrozenProperty(this, 'file', new FileUtils(options), true);
            defineFrozenProperty(this, 'log', logger, true);
            defineFrozenProperty(this, 'util', lodash, true);
            defineFrozenProperty(this, '_', lodash, true);
            defineFrozenProperty(this, '_streamWrappers', []);
            defineFrozenProperty(this, '_dependencies', new DependencyMap());
            defineFrozenProperty(this, '_fileDiffQueue', []);
            this.isFlowing = false;

            // flow is timeouted
            this._reflowTimeout = null;

            // Sync "isFlowing" status
            this.on('start', () => {
                this.isFlowing = true;
            });
            this.on('complete', () => {
                this.isFlowing = false;
            });
            this.on('error', () => {
                this.isFlowing = false;
            });
        }
        /**
         * Extend options.
         * 
         * @param {object} opt options to extend
         * @return {Panto} this
         */
    setOptions(opt) {
            this.options.extend(opt);
            return this;
        }
        /**
         * Get option.
         * 
         * @param  {...string} args Same as PantoOptions#get
         * @return {mixed}
         */
    getOption(...args) {
            return this.options.get(...args);
        }
        /**
         * Get a copy of all the options.
         * 
         * @return {object}
         */
    getOptions() {
            return this.options.get();
        }
        /**
         * Search all the files in "cwd" option.
         * 
         * @return {Promise}
         */
    async getFiles() {
            const src = this.file.locate('.');
            const output = this.file.touch('.');

            const globOptions = {
                cwd: src,
                nodir: true
            };
           
            if (src === output) {
                throw new Error(`src and output should be different`);
            }

            // Ignore output directory when walking
            if (subdir(src, output)) {
                const rel = path.relative(src, output);
                globOptions.ignore = `${rel}/**/*`;
            }

            return await c2p(glob)('**/*', globOptions);
        }
        /**
         * Report a dependency.
         *
         * Panto mantains a MAP, each key-value pair
         * represents a file and the files it depends on.
         * The MAP is very important when building incremental
         * files, aka change/remove/add. When a file change, it 
         * and the files depend on it all have to be re-built.
         *
         * Panto does not care how a file depends or be depended
         * on another file. It is reported by the transformers.
         *
         * For example,
         *
         * <code>
         * class CssUrlTransformer extends Transformer {
         *     _transform(file) {
         *         return new Promise(resolve => {
         *             // "url(...)" analysis
         *             panto.reportDependencies(file.filename, 'src/img/bg.png', 'src/img/dark.png');
         *             resolve(file);
         *         });
         *     }
         * }
         * </code>
         * 
         * @param  {string} filename The current files
         * @param  {Array|string} dependencies The files that current file depends on
         * @return {Panto} this
         */
    reportDependencies(filename, ...dependencies) {
            if (!filename || !dependencies || !dependencies.length) {
                return this;
            }

            this._dependencies.add(filename, ...dependencies);

            return this;
        }
        /**
         * Pick some files matched the pattern and return a head stream.
         * "Head" means that it has no parent. Beyond that,it has no transformer either.
         *
         * Dormant streams flow only once.
         * 
         * @param  {string} pattern
         * @param  {Boolean} isDormant Default is false
         * @return {PantoStream}
         */
    pick(pattern, isDormant = false) {
            if (!isString(pattern) && !Array.isArray(pattern)) {
                throw new Error(`Pick files with string or array pattern`);
            }

            const stream = new PantoStream();

            this._streamWrappers.push({
                stream,
                pattern,
                isDormant,
                flowsCount: 0,
                files: new FileCollection()
            });
            return stream;
        }
        /**
         * Alias for pick.
         * 
         * @param  {...string}
         * @return {PantoStream}
         */
    $(...args) {
            return this.pick(...args);
        }
        /**
         * Get the files not picked.
         * 
         * @return {PantoStream}
         */
    rest() {
            const stream = new PantoStream();

            this._streamWrappers.push({
                stream,
                pattern: null,
                files: new FileCollection()
            });
            return stream;
        }
        /**
         * Clear all the selected/stream.
         * 
         * @return {Panto} this
         */
    clear() {
            this._streamWrappers.splice(0);
            this._dependencies.clear();

            return this;
        }
        /**
         * Load a transformer as a shortcut.
         *
         * If the second argument is not present,
         * require("panto-transformer-${name}") as
         * the transformer class.
         *
         * For example,
         * <code>
         * panto.loadTransformer('foo')
         * panto.loadTransformer('bar', BarTransformer)
         * </code>
         * 
         * @param  {string} name transformer name
         * @param  {Class|undefiend} transformer
         * @return {Panto} this
         */
    loadTransformer(name, transformer) {
            if (!transformer) {
                let T = require(`panto-transformer-${name.toLowerCase()}`);
                PantoStream.prototype[camelCase(name)] = function (opts) {
                    return this.connect(new PantoStream(new T(opts)));
                };
            } else {
                PantoStream.prototype[camelCase(name)] = function (opts) {
                    return this.connect(new PantoStream(new transformer(opts)));
                };
            }
            return this;
        }
        /**
         * Do the build, including "getFiles",
         * "onFileDiff" and "walkStream".
         *
         * For example,
         * <code>
         * panto.build().catch(...)
         * </code>
         * 
         * @return {Promise}
         */
    async build() {
            // remove output directory first

            await this.file.rimraf('.');

            this._streamWrappers.forEach(({
                stream
            }) => stream.freeze());

            const filenames = await this.getFiles();

            const fileObjects = filenames.map(filename => ({
                filename,
                cmd: 'add'
            }));

            return await this._onFileDiff(...fileObjects);
        }
        /**
         * Watch cwd for any file change.
         * It should be after build.
         *
         * For example,
         * <code>
         * panto.on('error', err => {});
         * panto.on('complete', () => {});
         * 
         * panto.build().then(() => {
         *     panto.watch();
         * });
         * </code>
         * 
         * @return {Panto} this
         */
    watch() {
            const src = this.file.locate('.');
            const output = this.file.touch('.');

            const watchOptions = {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: true,
                cwd: src
            };

            // Ignore output directory when watching
            if (subdir(src, output)) {
                const rel = path.relative(src, output);
                let watchIgnore = this.options.get('watch_ignore');

                if (lodash.isFunction(watchIgnore)) {
                    watchIgnore = watchIgnore();
                }

                if (lodash.isString(watchIgnore)) {
                    watchIgnore = [watchIgnore];
                } else if (Array.isArray(watchIgnore)) {
                    watchIgnore = watchIgnore.filter(lodash.isString);
                } else {
                    watchIgnore = [];
                }

                watchOptions.ignored = [`${rel}/**/*`, '.git/**/*', '.svn/**/*'].concat(watchIgnore);
            }

            const watcher = chokidar.watch(`**/*`, watchOptions);

            watcher.on('add', path => {
                    this.log.info(`File ${path} has been added`);
                    this._onFileDiff({
                        filename: path,
                        cmd: 'add'
                    });
                })
                .on('change', path => {
                    this.log.info(`File ${path} has been changed`);
                    this._onFileDiff({
                        filename: path,
                        cmd: 'change'
                    });
                })
                .on('unlink', path => {
                    this.log.info(`File ${path} has been removed`);
                    this._onFileDiff({
                        filename: path,
                        cmd: 'remove'
                    });
                });

            // Loop up what has be changed during the flowing just now
            this.on('complete', () => {
                this._dispatchFileChange();
            });

            this.on('error', () => {
                this._dispatchFileChange();
            });

            return watcher;
        }
        /**
         * Safe emit
         * 
         * @param  {...mixin} args
         */
    trigger(...args) {
            try {
                this.emit(...args);
            } catch (e) {
                // empty
            }
        }
        /**
         * Walk all the streams and flow.
         * 
         * @return {Promise}
         */
    async walkStream() {
            const BUILD_ID = Date.now();
            let ret = [];

            try {
                this.trigger('start', BUILD_ID);

                for (let streamWrapper of this._streamWrappers) {
                    const {
                        stream,
                        isDormant,
                        flowsCount,
                        files
                    } = streamWrapper;
                    
                    if (isDormant && flowsCount > 0) {
                        continue;
                    }
                    const FLOW_ID = Date.now();

                    this.trigger('flowstart', {
                        tag: stream.tag
                    }, FLOW_ID, BUILD_ID);

                    streamWrapper.flowsCount += 1;

                    const data = await stream.flow(files.values());

                    this.trigger('flowend', {
                        tag: stream.tag
                    }, FLOW_ID, BUILD_ID);

                    ret.push(data);
                }

                ret = flattenDeep(ret);
                this.trigger('complete', ret, BUILD_ID);
                return ret;
            } catch (err) {
                this.trigger('error', err, BUILD_ID);
                return [];
            }
        }
        /**
         * Invoked after file changed/added/removed,
         * for re-building.
         *
         * It tries to incrementally modified the cache
         * in streams, which supports fast re-build.
         * 
         * @param  {...object} diffs
         * @return {Promise}
         */
    async _onFileDiff(...diffs) {
        const changedFileNames = diffs.map(f => f.filename);
        const dependencyFileNames = this._dependencies.resolve(...changedFileNames);

        // Find all the files should be transformed again
        const filesShouldBeTransformedAgain = diffs.concat(dependencyFileNames.map(filename => ({
            filename,
            cmd: 'change'
        })));

        this._fileDiffQueue.push(...filesShouldBeTransformedAgain);

        clearTimeout(this._reflowTimeout);

        return await new Promise((resolve, reject) => {
            this._reflowTimeout = setTimeout(async () => {
                // Await flowing complete
                if (!this.isFlowing) {
                    await this._dispatchFileChange().then(resolve, reject);
                } else {
                    resolve([]);
                }
            }, 500);
        });
    }
    async _dispatchFileChange() {
        if (!this._fileDiffQueue.length) {
            return [];
        }

        const filesShouldBeTransformedAgain = [...this._fileDiffQueue];
        this._fileDiffQueue.splice(0);

        let allFileNames = uniq(filesShouldBeTransformedAgain.map(f => f.filename));
        let allFileNamesMessage;
        if (allFileNames.length > 10) {
            allFileNamesMessage = allFileNames.slice(0, 10).join('\n') + `\n...and ${allFileNames.length-10} more`;
        } else {
            allFileNamesMessage = allFileNames.join('\n');
        }
        // Show max 10 files
        this.log.debug(`Flowing files:\n${allFileNamesMessage}`);

        // Rest streams may be more than one
        const restStreamIdxes = [];
        let isDeservedTransform = false;

        for (let i = 0; i < filesShouldBeTransformedAgain.length; ++i) {
            let matched = false;

            if ('remove' === filesShouldBeTransformedAgain[i].cmd) {
                this._dependencies.clear(filesShouldBeTransformedAgain[i].filename);
            }

            for (let j = 0; j < this._streamWrappers.length; ++j) {
                let {
                    pattern,
                    files
                } = this._streamWrappers[j];
                if (null === pattern) {
                    restStreamIdxes.push(j);
                } else if (this.file.match(filesShouldBeTransformedAgain[i].filename, pattern).length) {
                    files.fix(filesShouldBeTransformedAgain[i]);
                    matched = true;
                    isDeservedTransform = true;
                }
            }

            if (!matched) {
                restStreamIdxes.forEach(restStreamIdx => {
                    isDeservedTransform = true;
                    this._streamWrappers[restStreamIdx].files.fix(filesShouldBeTransformedAgain[i]);
                });
            }
        }

        // Nothing has to be done
        if (!isDeservedTransform) {
            return [];
        }

        return await this.walkStream();
    }
}

module.exports = Panto;