/**
 * Copyright (C) 2016 pantojs.xyz
 * sieve.js
 *
 * changelog
 * 2016-06-21[18:46:42]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

const glob = require('glob');

const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const mkdirp = require('mkdirp');
const minimatch = require('minimatch');

const logger = require('panto-logger');

const isString = require('lodash/isString');
const camelCase = require('lodash/camelCase');
const isFunction = require('lodash/isFunction');
const extend = require('lodash/extend');
const lodash = require('lodash');
const flattenDeep = require('lodash/flattenDeep');
const Stream = require('./stream');
const FileCollection = require('./file-collection');

class Panto {
    constructor() {
        const defaultOpts = {
            cwd: process.cwd(),
            output: 'output',
            binaryResource: 'webp,png,jpg,jpeg,gif,bmp,tiff,swf,woff,woff2,ttf,eot,otf,cur,zip,gz,7z,gzip,tgz,lzh,lha,bz2,bzip2,tbz2,tbz,xz,txz,z,lzma,arj,cab,alz,egg,bh,jar,iso,img,udf,wim,rar,tar,bz2,apk,ipa,exe,pages,numbers,key,graffle,xmind,xls,xlsx,doc,docx,ppt,pptx,pot,potx,ppsx,pps,pptm,potm,ppsm,thmx,ppam,ppa,psd,dmg,pdf,rtf,dot,mht,dotm,docm,csv,xlt,xls,xltx,xla,xltm,xlsm,xlam,xlsb,slk,mobi,mp3,mp4,wma,rmvb,ogg,wav,aiff,midi,au,aac,flac,ape,avi,mov,asf,wmv,3gp,mkv,mov,flv,f4v,rmvb,webm,vob,rmf'
        };
        const options = extend({}, defaultOpts);

        const isBinary = filename => minimatch(filename, options.binaryResource);

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
            return safeDirp(name).then(fpath => {
                return new Promise((resolve, reject) => {
                    fs.readFile(fpath, {
                        encoding: isBinary(name) ? null : 'utf-8'
                    }, (err, content) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(content);
                        }
                    });
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
            fileCollectionGroup: {
                value: [],
                writable: false,
                configurable: false,
                enumerable: true
            },
            streams: {
                value: [],
                writable: false,
                configurable: false,
                enumerable: true
            },
            restStreamIdx: {
                value: -1,
                writable: true,
                configurable: false,
                enumerable: true
            },
            options: {
                value: options,
                writable: false,
                configurable: false,
                enumerable: true
            },
            isBinary: {
                value: isBinary,
                writable: false,
                configurable: false,
                enumerable: true
            },
            file: {
                value: {
                    read: R,
                    write: W
                },
                writable: false,
                configurable: false,
                enumerable: true
            }
        });
        Object.freeze(this.file);
    }
    setOptions(opt) {
        extend(this.options, opt);
    }
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
    pick(pattern) {
        if (!pattern || !isString(pattern)) {
            throw new Error(`A string pattern is required to pick up some files`);
        }
        const stream = new Stream(null, pattern);
        stream.on('end', leaf => {
            this.streams.push(leaf);
        });
        return stream;
    }
    rest() {
        const restStream = new Stream(null, null);
        restStream.on('end', leaf => {
            this.streams.push(leaf);
        });
        return restStream;
    }
    build() {
        return this.getFiles().then(filenames => {
            return this._group(filenames);
        }).then(() => {
            return this._walkStream();
        });
    }
    loadTransformer(name) {
        const t = require(`panto-transformer-${name}`);
        this[camelCase(name)] = opts => {
            return new t(opts);
        };
    }
    watch() {
        const {
            cwd,
            output
        } = this.options;
        info(`Watching ${cwd}...`);
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
    _walkStream(diffs) {
        return new Promise((resolve, reject) => {
            let ret = [];
            const startTime = process.hrtime();
            let startStreamIdx = 0;
            const walkStream = () => {
                if (startStreamIdx === this.streams.length) {
                    const diff = process.hrtime(startTime);
                    const millseconds = parseInt(diff[0] * 1e3 + diff[1] / 1e6, 10);
                    this.log.info(`Complete in ${millseconds}ms`);
                    resolve(flattenDeep(ret));
                } else {
                    const stream = this.streams[startStreamIdx];
                    stream.flow(this.fileCollectionGroup[startStreamIdx].values()).then(data => {
                        ret.push(data);
                        walkStream();
                    }).catch(reject);
                }
                startStreamIdx += 1;
            };
            walkStream();
        });
    }
    _onWatchFiles(...diffs) {

        for (let i = 0; i < diffs.length; ++i) {
            let matched = false;

            for (let j = 0; j < this.streams.length; ++j) {
                if (this.streams[j].match(diffs[i].filename)) {
                    matched = true;

                    this.fileCollectionGroup[j].update(diffs[i]);
                }
            }

            if (!matched && this.restStreamIdx >= 0) {
                this.fileCollectionGroup[this.restStreamIdx].update(diffs[i]);
            }
        }
        return this._walkStream(diffs);
    }
    _group(filenames) {
        const group = this.fileCollectionGroup;

        // Initialize group
        for (let k = 0; k < this.streams.length; ++k) {
            group[k] = new FileCollection();
        }

        const leftGroup = new FileCollection();

        for (let i = 0; i < filenames.length; ++i) {
            let filename = filenames[i];
            let matched = false;
            const file = {
                filename
            }; // Mutiple shares

            this.streams.forEach((stream, idx) => {
                if (!stream.pattern) {
                    this.restStreamIdx = idx;
                } else if (stream.match(filename)) {
                    matched = true;
                    group[idx].add(file);
                }
            });

            if (!matched) {
                leftGroup.add(file);
            }
        }

        if (this.restStreamIdx >= 0) {
            group[this.restStreamIdx] = leftGroup;
        }

    }
}

const panto = new Panto();

Object.defineProperty(global, 'panto', {
    value: panto,
    enumerable: true,
    writable: false,
    configurable: false
});

panto.loadTransformer('read');
panto.loadTransformer('write');
panto.loadTransformer('babel');
panto.loadTransformer('filter');
panto.loadTransformer('ignore');
panto.loadTransformer('integrity');
panto.loadTransformer('less');
panto.loadTransformer('uglify');

module.exports = panto;