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
 *
 * @author yanni4night@gmail.com
 * @version 0.0.29
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
const table = require('table').default;

const defineFrozenProperty = require('define-frozen-property');
const logger = require('panto-logger');
const PantoStream = require('panto-stream');
const Options = require('panto-options');
const FileUtils = require('panto-file-utils');
const DependencyMap = require('panto-dependency-map');

const FileCollection = require('./file-collection');

const {isString, camelCase, flattenDeep, uniq} = lodash;

/** Class representing a panto */
class Panto extends EventEmitter {
    constructor() {
        super();

        const options = new Options({
            cwd: process.cwd(),
            src: '.',
            output: 'output',
            binary_resource: ''
        });
        
        defineFrozenProperty(this, 'options', options, true);
        defineFrozenProperty(this, 'file', new FileUtils(options), true);
        defineFrozenProperty(this, 'log', logger, true);
        defineFrozenProperty(this, 'util', lodash, true);
        defineFrozenProperty(this, '_', lodash, true);
        defineFrozenProperty(this, '_streams', []);
        defineFrozenProperty(this, '_dependencies', new DependencyMap());
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
    getFiles() {
        const src = this.file.locate('.');
        const output = this.file.touch('.');

        const globOptions = {
            cwd: src,
            nodir: true
        };

        if (src === output) {
            throw new Error(`src and output should be different`);
        }

        // Ignore output
        if (subdir(src, output)) {
            const rel = path.relative(src, output);
            globOptions.ignore = `${rel}/**/*`;
        }

        return c2p(glob)('**/*', globOptions);
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
     * Pick some files matched the pattern.
     * 
     * @param  {string} pattern
     * @return {PantoStream}
     */
    pick(pattern) {
        if (!isString(pattern) && !Array.isArray(pattern)) {
            throw new Error(`Pick files with string or array pattern`);
        }
        
        const stream = new PantoStream();
        
        this._streams.push({
            stream,
            pattern,
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
        
        this._streams.push({
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
        this._streams.splice(0);
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
            PantoStream.prototype[camelCase(name)] = function(opts) {
                return this.connect(new PantoStream(new T(opts)));
            };
        } else {
            PantoStream.prototype[camelCase(name)] = function(opts) {
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
    build() {
        // remove output directory first
        this.file.rimraf('.');

        this._streams.forEach(({
            stream
        }) => stream.freeze());

        return this.getFiles().then(filenames => {
            return this.onFileDiff(...filenames.map(filename => ({
                filename,
                cmd: 'add'
            })));
        });
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
            cwd: src
        };

        // Ignore output
        if(subdir(src, output)) {
            const rel = path.relative(src, output);
            watchOptions.ignored = [`${rel}/**/*`, /^\./];
        }

        this.log.info('\n' + table([
            ['Watching for changes'],
            [src]
        ]));

        const watcher = chokidar.watch(`**/*`, watchOptions);
        
        watcher.on('add', path => {
                this.log.info(`File ${path} has been added`);
                this.onFileDiff({
                    filename: path,
                    cmd: 'add'
                });
            })
            .on('change', path => {
                this.log.info(`File ${path} has been changed`);
                this.onFileDiff({
                    filename: path,
                    cmd: 'change'
                });
            })
            .on('unlink', path => {
                this.log.info(`File ${path} has been removed`);
                this.onFileDiff({
                    filename: path,
                    cmd: 'remove'
                });
            });
        return watcher;
    }
    /**
     * Walk all the streams and flow.
     * 
     * @return {[type]} [description]
     */
    walkStream() {
        const tableData = [];

        this._streams.forEach(({stream}, i) => {
            tableData[i] = [stream.tag, 'ready', '-'];
        });

        const print = () => {
            const data = table(tableData);
            this.log.info('\n' + data);
        };

        return new Promise((resolve, reject) => {

            const ret = [];
            const startTime = process.hrtime();
            let startStreamIdx = 0;
            
            this.emit('start');

            const _walkStream = () => {
                if (startStreamIdx === this._streams.length) {
                    const diff = process.hrtime(startTime);
                    const totalMs = parseInt(diff[0] * 1e3 + diff[1] / 1e6, 10);
                    tableData.push(['Total', `complete`, `${totalMs}ms`]);
                    print();

                    resolve(flattenDeep(ret));
                } else {
                    const {stream, files} = this._streams[startStreamIdx];
                    let streamStartTime = process.hrtime();
                    const idx = startStreamIdx;
                    tableData[idx][1] = 'running';

                    this.log.info(`Processing ${stream.tag}...[${1 + startStreamIdx}/${this._streams.length}]`);
                    
                    stream.flow(files.values())
                        .then(
                            data => {
                                let streamDiff = process.hrtime(streamStartTime);
                                const streamMs = parseInt(streamDiff[0] * 1e3 + streamDiff[1] / 1e6, 10);

                                tableData[idx][1] = `complete`;
                                tableData[idx][2] = `${streamMs}ms`;

                                ret.push(data);
                                _walkStream();
                            }).catch(reject);
                }
                startStreamIdx += 1;
            };
            _walkStream();
        }).then(files => {
            this.emit('complete', files);
            return files;
        }).catch(err => {
            this.emit('error', err);
            throw err;
        });
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
    onFileDiff(...diffs) {
        const changedFileNames = diffs.map(f => f.filename);
        const dependencyFileNames = this._dependencies.resolve(...changedFileNames);
        
        // Find all the files should be transformed again
        const filesShouldBeTransformedAgain = diffs.concat(dependencyFileNames.map(filename => ({
            filename,
            cmd: 'change'
        })));

        let allFileNames = uniq(dependencyFileNames.concat(changedFileNames));
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
        
        for (let i = 0; i < filesShouldBeTransformedAgain.length; ++i) {
            let matched = false;

            if('remove' === filesShouldBeTransformedAgain[i].cmd) {
                this._dependencies.clear(filesShouldBeTransformedAgain[i].filename);
            }

            for (let j = 0; j < this._streams.length; ++j) {
                let {stream, pattern, files} = this._streams[j];
                if(null === pattern){
                    restStreamIdxes.push(j);
                } else if (this.file.match(filesShouldBeTransformedAgain[i].filename, pattern).length) {
                    files.update(filesShouldBeTransformedAgain[i]);
                    stream.clearCache(filesShouldBeTransformedAgain[i].filename);
                    matched = true;
                }
            }

            if (!matched) {
                restStreamIdxes.forEach(restStreamIdx => {
                    this._streams[restStreamIdx].stream.clearCache(filesShouldBeTransformedAgain[i].filename);
                    this._streams[restStreamIdx].files.update(filesShouldBeTransformedAgain[i]);
                });
            }
        }
        return this.walkStream();
    }
}

module.exports = Panto;