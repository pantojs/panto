/**
 * Copyright (C) 2016 pantojs.xyz
 * sieve.js
 *
 * changelog
 * 2016-06-21[18:46:42]:revised
 * 2016-06-26[12:17:28]:add match to panto.file
 * 2016-06-26[17:36:31]:dependencies map
 *
 * @author yanni4night@gmail.com
 * @version 0.0.10
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
const logger = require('panto-logger');
const isString = require('lodash/isString');
const camelCase = require('lodash/camelCase');
const extend = require('lodash/extend');
const lodash = require('lodash');
const flattenDeep = require('lodash/flattenDeep');

const Stream = require('./stream');
const FileCollection = require('./file-collection');

/** Class representing a panto */
class Panto extends EventEmitter {
    constructor() {
        super();
        const defaultOpts = {
            cwd: process.cwd(),
            output: 'output',
            binary_resource: 'webp,png,jpg,jpeg,gif,bmp,tiff,swf,woff,woff2,ttf,eot,otf,cur,zip,gz,7z,gzip,tgz,lzh,lha,bz2,bzip2,tbz2,tbz,xz,txz,z,lzma,arj,cab,alz,egg,bh,jar,iso,img,udf,wim,rar,tar,bz2,apk,ipa,exe,pages,numbers,key,graffle,xmind,xls,xlsx,doc,docx,ppt,pptx,pot,potx,ppsx,pps,pptm,potm,ppsm,thmx,ppam,ppa,psd,dmg,pdf,rtf,dot,mht,dotm,docm,csv,xlt,xls,xltx,xla,xltm,xlsm,xlam,xlsb,slk,mobi,mp3,mp4,wma,rmvb,ogg,wav,aiff,midi,au,aac,flac,ape,avi,mov,asf,wmv,3gp,mkv,mov,flv,f4v,rmvb,webm,vob,rmf'
        };
        const options = extend({}, defaultOpts);

        const isBinary = filename => minimatch(filename, options.binary_resource);

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

        let _restStreamIdx = -1;
        
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
                value: {},
                writable: false,
                configurable: false,
                enumerable: false
            },
            _restStreamIdx: {
                set(idx) {
                    if (isNaN(idx)) {
                        throw new Error('"_restStreamIdx" must be a number');
                    }
                    _restStreamIdx = +idx;
                },
                get() {
                    return _restStreamIdx;
                },
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
     *             panto.reportDependencies(file.filename, 'src/img/bg.png');
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
    reportDependencies(filename, dependencies) {
        if (!filename || !dependencies) {
            return this;
        }

        let deps = this._dependencies[filename];

        if (!deps) {
            this._dependencies[filename] = deps = {};
        }

        if (!Array.isArray(dependencies)) {
            dependencies = [dependencies];
        }

        dependencies.forEach(dep => {
            if (!deps[dep]) {
                deps[dep] = 1; // any value truely
            }
        });

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

        Object.keys(this._dependencies).forEach(key => {
            delete this._dependencies[key];
        });

        return this;
    }
    /**
     * Do the build, including "getFiles",
     * "_group" and "_walkStream".
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
            return this._group(filenames);
        }).then(() => {
            return this._walkStream();
        });
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
     * Watch cwd for any file change.
     * It should be after build.
     *
     * For example,
     * <code>
     * panto.build().then(() => {
     *     panto.watch();
     * }).catch(...)
     * </code>
     * 
     * @return {Promise}
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
                this._onWatchFiles({
                    filename: path,
                    cmd: 'add'
                });
            })
            .on('change', path => {
                this.log.info(`File ${path} has been changed`);
                this._onWatchFiles({
                    filename: path,
                    cmd: 'change'
                });
            })
            .on('unlink', path => {
                this.log.info(`File ${path} has been removed`);
                this._onWatchFiles({
                    filename: path,
                    cmd: 'remove'
                });
            });

    }
    _walkStream() {
        return new Promise((resolve, reject) => {
            let ret = [];
            const startTime = process.hrtime();
            let startStreamIdx = 0;
            
            const walkStream = () => {
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
                                walkStream();
                            }).catch(reject);
                }
                startStreamIdx += 1;
            };
            walkStream();
        }).then(files => {
            this.emit('complete', files);
            return files;
        }).catch(err => {
            this.emit('error', err);
        });
    }
    _resolveAllChangedFiles(...diffs) {
        const filesShouldBeTransformedAgain = diffs.slice();

        const findDependencies = filename => {
            for (let dfn in this._dependencies) {
                if (this._dependencies[dfn][filename]) {
                    if (!filesShouldBeTransformedAgain.some(f => (f.filename === dfn))) {
                        filesShouldBeTransformedAgain.push({
                            filename: dfn,
                            cmd: 'change'
                        });
                    }
                    findDependencies(dfn);
                }
            }
        };

        for (let i = 0; i < diffs.length; ++i) {
            let {
                filename,
                cmd
            } = diffs[i];

            if ('remove' === cmd) {
                delete this._dependencies[filename];
            }

            findDependencies(filename);
        }
        return filesShouldBeTransformedAgain;
    }
    _onWatchFiles(...diffs) {
        // Find all the files should be transformed again
        const filesShouldBeTransformedAgain = this._resolveAllChangedFiles(...diffs);

        this.log.data('The following files will be transformed again:\n', filesShouldBeTransformedAgain.map(f => f.filename)
            .join('\n'));
        
        for (let i = 0; i < filesShouldBeTransformedAgain.length; ++i) {
            let matched = false;

            for (let j = 0; j < this._streams.length; ++j) {
                if (this._streams[j].fix(filesShouldBeTransformedAgain[i])) {
                    matched = true;
                }
            }

            if (!matched && this._restStreamIdx >= 0) {
                this._streams[this._restStreamIdx].fix(filesShouldBeTransformedAgain[i], true);
            }
        }
        return this._walkStream();
    }
    _group(filenames) {

        const restGroup = new FileCollection();

        for (let i = 0; i < filenames.length; ++i) {
            let filename = filenames[i];
            let matched = false;
            const file = {
                filename
            }; // Mutiple shares

            this._streams.forEach((stream, idx) => {
                if (stream.isRest()) {
                    this._restStreamIdx = idx;
                } else if (stream.swallow(file)) {
                    matched = true;
                }
            });

            if (!matched) {
                restGroup.add(file);
            }
        }

        if (this._restStreamIdx >= 0) {
            this._streams[this._restStreamIdx].copy(restGroup);
        }

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