/**
 * Copyright (C) 2016 pantojs.xyz
 * file.js
 *
 * changelog
 * 2016-07-04[23:38:50]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const minimatch = require('minimatch');
const binaryExtensions = require('binary-extensions');

class FileUtils {
    constructor(opt) {
        this.options = opt;
    }
    isBinary(filepath) {
        const ext = path.extname(filepath).slice(1).toLowerCase();
        return (this.options.binary_resource || '').toLowerCase().split(',').indexOf(ext) > -1 || binaryExtensions.indexOf(ext) > -1;
    }
    locate(name) {
        return path.join(this.options.cwd, name);
    }
    safeDirp(name) {
        const fpath = this.locate(name);
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
    }
    read(name) {
        return new Promise((resolve, reject) => {
            fs.readFile(this.locate(name), {
                encoding: this.isBinary(name) ? null : 'utf-8'
            }, (err, content) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(content);
                }
            });
        });
    }
    write(name, content) {
        return this.safeDirp(path.join(this.options.output, name)).then(fpath => {
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
    }
    rimraf(...args) {
        return rimraf(...args);
    }
    match(...args) {
        return minimatch(...args);
    }
}

module.exports = FileUtils;