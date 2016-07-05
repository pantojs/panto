/**
 * Copyright (C) 2016 pantojs.xyz
 * test-stream.js
 *
 * changelog
 * 2016-06-21[19:28:12]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';
const assert = require('assert');
const Stream = require('../src/stream');
const Transformer = require('panto-transformer');
const extend = require('lodash/extend');

/*global describe,it*/
/*eslint no-console: ["error", { allow: ["error"] }] */
class DoubleTransformer extends Transformer {
    _transform(file) {
        const {
            content
        } = file;
        return new Promise(resolve => {
            resolve(extend(file, {
                content: content + content
            }));
        });
    }
}

class MultiplyTransformer extends Transformer {
    _transform(file) {
        const {
            content
        } = file;
        return new Promise(resolve => {
            resolve([
                extend({}, file),
                extend({}, file, {
                    content: content + content
                })
            ]);
        });
    }
}

describe('stream', () => {
    describe('#pipe', () => {
        it('should get another stream returned', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s !== rs, 'new object');
            assert.ok(rs instanceof Stream, 'new stream');
        });

        it('bubble up "end" event', done => {
            const s = new Stream();
            const rs = s.pipe(new Transformer()).pipe(new Transformer());
            s.on('end', () => {
                done();
            });
            rs.emit('end');
        });
    });
    describe('#fix#flow', () => {
        it('should return origin file if transformer is null', done => {
            const s = new Stream(null, '*.js').end();
            s.fix({
                cmd: 'add',
                filename: 'a.js',
                content: 'aaaa'
            });
            s.fix({
                cmd: 'add',
                filename: 'b.js',
                content: 'bbbb'
            });
            s.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'aaaa'
                }, {
                    filename: 'b.js',
                    content: 'bbbb'
                }]);

                done();
            });
        });
        it('transform using own transformer if no parent', done => {
            const s = new Stream(null, '*.js', new DoubleTransformer()).end();
            s.fix({
                cmd: 'add',
                filename: 'a.js',
                content: 'aa'
            });
            s.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'aaaa'
                }]);
            }).then(() => {
                done();
            }).catch(e => console.error(e));
        });
        it('transform to the ancestor', done => {
            const s = new Stream(null, '*.js', new DoubleTransformer()).end();

            const s1 = s.pipe(new DoubleTransformer()).pipe(new DoubleTransformer()).end();
            s1.fix({
                cmd: 'add',
                filename: 'a.js',
                content: 'a'
            });
            s1.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'aaaaaaaa' //2^3
                }]);
            }).then(() => {
                done();
            });
        });
        it('should get multiple files', done => {
            const s = new Stream(null, '*.js', new MultiplyTransformer()).end();
            s.fix({
                cmd: 'add',
                filename: 'a.js',
                content: 'a'
            });
            s.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'a'
                }, {
                    filename: 'a.js',
                    content: 'aa'
                }]);
                done();
            });
        });
        it('should support null/undefined/[]', done => {
            class EmptyTransformer extends Transformer {
                _transform() {
                    return Promise.resolve(this.options.data);
                }
            }
            const s = new Stream().pipe(new EmptyTransformer({
                data: undefined
            })).pipe(new EmptyTransformer({
                data: []
            })).pipe(new EmptyTransformer({
                data: null
            })).end();

            s.fix({
                cmd: 'add',
                filename: 'a.js',
                content: 'a'
            });

            s.flow().then(files => {
                assert.deepEqual(files, []);
                done();
            });
        });
        it('fix could force even file not matched', done => {
            const s = new Stream(null, '*.css').end();
            const file = {
                cmd: 'add',
                filename: 'a.js'
            };
            s.fix(file);
            s.flow().then(files => {
                assert.deepEqual(files, [], 'file not match cannot fix');
            }).then(() => {
                s.fix(file, true);
                return s.flow();
            }).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: undefined
                }], 'file fixed if force');
            }).then(() => {
                done();
            }).catch(e => console.error(e));

        });
        it('should cache', done => {
            let transformed = false;
            class OnceTransformer extends Transformer {
                _transform(file) {
                    const ret = Promise.resolve(transformed ? null : extend(file, {
                        content: 'a'
                    }));
                    transformed = true;
                    return ret;
                }
            }

            const s = new Stream(null, '*.js').pipe(new OnceTransformer()).end();
            s.fix({
                cmd: 'add',
                filename: 'a.js'
            });
            s.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'a'
                }]);
            }).then(() => {
                return s.flow();
            }).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    content: 'a'
                }]);
            }).then(() => {
                done();
            }).catch(e => console.error(e));
        });
        it('should support furcal&cache', done => {
            let total = 0;
            class OneTransformer extends Transformer {
                _transform(file) {
                    ++total;
                    return Promise.resolve(extend(file, {
                        n: '1'
                    }));
                }
            }
            class AppendTransformer extends Transformer {
                _transform(file) {
                    return Promise.resolve(extend(file, {
                        n: file.n + '' + this.options.n
                    }));
                }
            }
            const s = new Stream(null, '*.js', new OneTransformer());
            const s1 = s.pipe(new AppendTransformer({
                n: 2
            }));
            const s2 = s1.pipe(new AppendTransformer({
                n: 3
            })).end();
            s2.fix({
                cmd: 'add',
                filename: 'a.js'
            });
            s2.flow().then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    n: '123',
                    content: undefined
                }], 'transformers in series');
            }).then(() => {
                const s3 = s1.pipe(new AppendTransformer({
                    n: 4
                })).end();

                s3.fix({
                    cmd: 'add',
                    filename: 'a.js'
                });

                return s3.flow();
            }).then(files => {
                assert.deepEqual(files, [{
                    filename: 'a.js',
                    n: '124',
                    content: undefined
                }], 'transformers in another series');
                assert.deepEqual(total, 1, 'stream caches');
                done();
            }).catch(e => console.error(e));
        });
    });
    describe('#isRest', () => {
        it('should return true if pattern is null', () => {
            const s = new Stream(null, null);
            assert.ok(s.isRest());
        });
        it('should return false if pattern is undefined/NaN/""', () => {
            let s = new Stream(null, undefined);
            assert.ok(!s.isRest());
            s = new Stream(null, NaN);
            assert.ok(!s.isRest());
            s = new Stream(null, "");
            assert.ok(!s.isRest());
        });
    });
    describe('#end', () => {
        it('should set the tag', () => {
            const s = new Stream();
            s.end('kate');
            assert.deepEqual(s.tag, 'kate');
        });
        it('should emit "end" event', done => {
            const s = new Stream();
            s.on('end', () => {
                done();
            });
            s.end();
        });
        it('should emit "end" event to th ancestor', done => {
            const s = new Stream(null, '', new DoubleTransformer());
            const last = s.pipe(new DoubleTransformer()).pipe(new DoubleTransformer());
            s.on('end', leaf => {
                assert.deepEqual(leaf, last);
                done();
            });
            last.end();
        });
    });
});