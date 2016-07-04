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
 *
 * @author yanni4night@gmail.com
 * @version 0.0.12
 * @since 0.0.1
 */
'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const chokidar = require('chokidar');
const glob = require('glob');
const minimatch = require('minimatch');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const logger = require('panto-logger');
const isString = require('lodash/isString');
const camelCase = require('lodash/camelCase');
const extend = require('lodash/extend');
const lodash = require('lodash');
const flattenDeep = require('lodash/flattenDeep');
const binaryExtensions = require('binary-extensions');

const Stream = require('./stream');
const DependencyMap = require('./dependency-map');

/** Class representing a panto */
class Panto extends EventEmitter {
    constructor() {
        super();
        const defaultOpts = {
            cwd: process.cwd(),
            output: 'output',
            binary_resource: ''
        };

        const options = extend({}, defaultOpts);

        const isBinary = filepath => {
            const ext = path.extname(filepath).slice(1).toLowerCase();
            return (options.binary_resource || '').toLowerCase().split(',').indexOf(ext) > -1 || binaryExtensions.indexOf(ext) > -1;
        };

        const L = name => path.join(options.cwd, name);

        const safeDirp = name => {
            const fpath = L(name);
            const dir = path.dirname(fpath);
            return new Promise(resolve => {
                fs.exists(dir, exist => {
                    resolve(exist);
                });
            }).then(exist => {
                if (!exist) {
                    return new Promise((resolve, reject) => {
                        mkdirp(dir, err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(fpath);
                            }
                        });
                    });
                } else {
                    return fpath;
                }
            });
        };

        const R = name => {
            return new Promise((resolve, reject) => {
                fs.readFile(L(name), {
                    encoding: isBinary(name) ? null : 'utf-8'
                }, (err, content) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(content);
                    }
                });
            });
        };

        const W = (name, content) => {
            return safeDirp(path.join(options.output, name)).then(fpath => {
                return new Promise((resolve, reject) => {
                    fs.writeFile(fpath, content, err => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });
        };
        
        Object.defineProperties(this, {
            log: {
                value: logger,
                writable: false,
                configurable: false,
                enumerable: true
            },
            util: {
                value: lodash,
                writable: false,
                configurable: false,
                enumerable: true
            },
            _streams: {
                value: [],
                writable: false,
                configurable: false,
                enumerable: false
            },
            _dependencies: {
                value: new DependencyMap(),
                writable: false,
                configurable: false,
                enumerable: false
            },
            options: {
                value: options,
                writable: false,
                configurable: false,
                enumerable: true
            },
            file: {
                value: {
                    read: R,
                    write: W,
                    locate: L,
                    mkdirp: safeDirp,
                    isBinary,
                    rimraf,
                    match: minimatch
                },
                writable: false,
                configurable: false,
                enumerable: true
            }
        });

        Object.freeze(this.file);
        Object.freeze(this.log);
        Object.freeze(this.util);
    }
    /**
     * Extend options.
     * 
     * @param {object} opt options to extend
     * @return {Panto} this
     */
    setOptions(opt) {
        extend(this.options, opt);
        return this;
    }
    /**
     * Search all the files in "cwd" option.
     * 
     * @return {Promise}
     */
    getFiles() {
        return new Promise((resolve, reject) => {
            glob('**/*', {
                cwd: this.options.cwd,
                nodir: true,
                ignore: `${this.options.output}/**/*`
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
            this[camelCase(name)] = opts => {
                return new T(opts);
            };
        } else {
            this[camelCase(name)] = opts => {
                return new transformer(opts);
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
        const {
            cwd,
            output
        } = this.options;

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
        return this;
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
                if (this._streams[j].fix(filesShouldBeTransformedAgain[i])) {
                    matched = true;
                }
            }

            if (!matched) {
                restStreamIdxes.forEach(restStreamIdx => {
                    this._streams[restStreamIdx].fix(filesShouldBeTransformedAgain[i], true);
                });
            }
        }
        return this.walkStream();
    }
}
/**
 * Global Panto single instance.
 * 
 * @type {Panto}
 * @global
 */
const panto = new Panto();

Object.defineProperty(global, 'panto', {
    value: panto,
    enumerable: true,
    writable: false,
    configurable: false
});

module.exports = panto;