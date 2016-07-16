/**
 * Copyright (C) 2016 pantojs.xyz
 * sieve.js
 *
 * changelog
 * 2016-06-21[18:46:42]:revised
 * 2016-06-26[12:17:28]:add match to panto.file
 * 2016-06-26[17:36:31]:dependencies map
 * 2016-07-01[00:05:53]:fixed isbinary
 * 2016-07-04[23:14:52]:use binary extension;add rimraf
 * 2016-07-11[11:42:55]:upgrade stream to support multiple files transforming
 * 2016-07-12[14:15:12]:new loadTransformer
 *
 * @author yanni4night@gmail.com
 * @version 0.0.20
 * @since 0.0.1
 */
'use strict';

const EventEmitter = require('events');

const chokidar = require('chokidar');
const glob = require('glob');
const lodash = require('lodash');

const defineFrozenProperty = require('define-frozen-property');

const logger = require('panto-logger');
const Stream = require('panto-stream');
const Options = require('panto-options');
const FileUtils = require('panto-file-utils');
const DependencyMap = require('panto-dependency-map');

const {isString, camelCase, flattenDeep} = lodash;

/** Class representing a panto */
class Panto extends EventEmitter {
    constructor() {
        super();

        const options = new Options({
            cwd: process.cwd(),
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
     * Search all the files in "cwd" option.
     * 
     * @return {Promise}
     */
    getFiles() {
        return new Promise((resolve, reject) => {
            glob('**/*', {
                cwd: this.getOption('cwd'),
                nodir: true,
                ignore: `${this.getOption('output')}/**/*`
            }, (err, filenames) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(filenames);
                }
            });
        });
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
     * Select some files matched the pattern.
     * 
     * @param  {string} pattern
     * @return {Stream}
     */
    pick(pattern) {
        if (!pattern || !isString(pattern)) {
            throw new Error(`A string pattern is required to pick up some files`);
        }
        const stream = new Stream(null, pattern);
        stream.on('end', leaf => {
            this._streams.push(leaf);
        });
        return stream;
    }
    /**
     * Get the files not selected.
     * 
     * @return {Stream}
     */
    rest() {
        const restStream = new Stream(null, null);
        restStream.on('end', leaf => {
            this._streams.push(leaf);
        });
        return restStream;
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
            Stream.prototype[camelCase(name)] = function(opts) {
                return this.pipe(new T(opts));
            };
        } else {
            Stream.prototype[camelCase(name)] = function(opts) {
                return this.pipe(new transformer(opts));
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
        const cwd = this.getOption('cwd', process.cwd());
        const output = this.getOption('output', 'output');

        this.log.info('=================================================');
        this.log.info(`Watching ${cwd}...`);

        const watcher = chokidar.watch(`${cwd}/**/*`, {
            ignored: [`${output}/**/*`, /[\/\\]\./],
            persistent: true,
            ignoreInitial: true,
            cwd: cwd
        });
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
        return new Promise((resolve, reject) => {
            let ret = [];
            const startTime = process.hrtime();
            let startStreamIdx = 0;
            
            const _walkStream = () => {
                if (startStreamIdx === this._streams.length) {
                    const diff = process.hrtime(startTime);
                    const totalMs = parseInt(diff[0] * 1e3 + diff[1] / 1e6, 10);

                    this.log.info(`Complete in ${totalMs}ms`);

                    resolve(flattenDeep(ret));
                } else {
                    const stream = this._streams[startStreamIdx];
                    let streamStartTime = process.hrtime();

                    this.log.debug(`${stream.tag}...start[${1+startStreamIdx}/${this._streams.length}]`);

                    stream.flow()
                        .then(
                            data => {
                                let streamDiff = process.hrtime(streamStartTime);
                                const streamMs = parseInt(streamDiff[0] * 1e3 + streamDiff[1] / 1e6, 10);

                                this.log.debug(`${stream.tag}...complete in ${streamMs}ms`);

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

        let allFileNames = dependencyFileNames.concat(changedFileNames);
        let allFileNamesMessage;
        if (allFileNames.length > 10) {
            allFileNamesMessage = allFileNames.slice(0, 10).join('\n') + `\n...and ${allFileNames.length-10} more`;
        } else {
            allFileNamesMessage = allFileNames.join('\n');
        }
        // Show max 10 files
        this.log.data(`Flowing files:\n${allFileNamesMessage}`);

        // Rest streams may be more than one
        const restStreamIdxes = [];
        
        for (let i = 0; i < filesShouldBeTransformedAgain.length; ++i) {
            let matched = false;

            this._dependencies.clear(filesShouldBeTransformedAgain[i].filename);

            for (let j = 0; j < this._streams.length; ++j) {
                if(this._streams[j].isRest()){
                    restStreamIdxes.push(j);
                }
                if (this._streams[j].push(filesShouldBeTransformedAgain[i])) {
                    matched = true;
                }
            }

            if (!matched) {
                restStreamIdxes.forEach(restStreamIdx => {
                    this._streams[restStreamIdx].push(filesShouldBeTransformedAgain[i], true);
                });
            }
        }
        return this.walkStream();
    }
}

module.exports = Panto;