/**
 * Copyright 2016 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var q = require('q');
var BigIp = require('../../../f5-cloud-libs').bigIp;
var util = require('../../../f5-cloud-libs').util;
var icontrolMock = require('../testUtil/icontrolMock');

var bigIp;
var realReady;

const TASK_PATH = '/tm/task/sys/ucs';

module.exports = {
    setUp: function(callback) {
        bigIp = new BigIp();

        // we have to call init so we can wait till it's done to set icontrol
        bigIp.init('host', 'user', 'password')
            .then(function() {
                realReady = bigIp.ready;  // Store this so we can test the ready function
                bigIp.icontrol = icontrolMock;
                bigIp.ready = function() {
                    return q();
                };
                icontrolMock.reset();
                callback();
            });
    },

    testActive: {
        testActive: function(test) {
            icontrolMock.when(
                'list',
                '/tm/cm/failover-status',
                {
                    entries: {
                        'https://localhost/mgmt/tm/cm/failover-status/0': {
                            nestedStats: {
                                entries: {
                                    status: {
                                        description: 'ACTIVE'
                                    }
                                }
                            }
                        }
                    }
                }
            );

            test.expect(1);
            bigIp.active()
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },

        testStandby: function(test) {
            icontrolMock.when(
                'list',
                '/tm/cm/failover-status',
                {
                    entries: {
                        'https://localhost/mgmt/tm/cm/failover-status/0': {
                            nestedStats: {
                                entries: {
                                    status: {
                                        description: 'STANDBY'
                                    }
                                }
                            }
                        }
                    }
                }
            );

            test.expect(1);
            bigIp.active()
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },

        testNotActive: function(test) {
            icontrolMock.when(
                'list',
                '/tm/cm/failover-status',
                {
                    entries: {
                        'https://localhost/mgmt/tm/cm/failover-status/0': {
                            nestedStats: {
                                entries: {
                                    status: {
                                        description: 'FOOBAR'
                                    }
                                }
                            }
                        }
                    }
                }
            );

            test.expect(1);
            bigIp.active(util.NO_RETRY)
                .then(function() {
                    test.ok(false, "BIG-IP should not be active.");
                })
                .catch(function(err) {
                    test.strictEqual(err.name, 'ActiveError');
                })
                .finally(function() {
                    test.done();
                });
        },

        testActiveThrow: function(test) {
            icontrolMock.fail('list', '/tm/cm/failover-status');

            test.expect(1);
            bigIp.active(util.NO_RETRY)
                .then(function() {
                    test.ok(false, "BIG-IP should not be active.");
                })
                .catch(function(err) {
                    test.strictEqual(err.name, 'ActiveError');
                })
                .finally(function() {
                    test.done();
                });
            }
    },

    testDelete: function(test) {
        icontrolMock.when('delete', '/tm/sys/foo/bar', {});

        test.expect(2);
        bigIp.delete('/tm/sys/foo/bar')
            .then(function() {
                  test.strictEqual(icontrolMock.lastCall.method, 'delete');
                  test.strictEqual(icontrolMock.lastCall.path, '/tm/sys/foo/bar');
            })
            .catch(function(err) {
                test.ok(false, err.message);
            })
            .finally(function() {
                test.done();
            });
    },

    testInit: {
        testBasic: function(test) {
            var host = 'myHost';
            var user = 'myUser';
            var password = 'myPassword';
            var port = 1234;
            bigIp = new BigIp();

            test.expect(4);
            // we have to call init here w/ the same params as the ctor can't
            // be async.
            bigIp.init(host, user, password, {port: port})
                .then(function() {
                    test.strictEqual(bigIp.host, host);
                    test.strictEqual(bigIp.user, user);
                    test.strictEqual(bigIp.password, password);
                    test.strictEqual(bigIp.port, port);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testPasswordUrl: function(test) {
            var fs = require('fs');
            var host = 'myHost';
            var user = 'myUser';
            var password = 'myPassword';
            var passwordFile = '/tmp/passwordFromUrlTest';
            var passwordUrl = 'file://' + passwordFile;

            fs.writeFileSync(passwordFile, password);
            bigIp = new BigIp();

            test.expect(1);
            bigIp.init(host, user, passwordUrl, {passwordIsUrl: true})
                .then(function() {
                    test.strictEqual(bigIp.password, password);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    fs.unlinkSync(passwordFile);
                    test.done();
                });
        },

        testNotInitialized: function(test) {
            bigIp = new BigIp();

            test.expect(1);
            bigIp.ready(util.NO_RETRY)
                .then(function() {
                    test.ok(false, 'Uninitialized BIG-IP should not be ready');
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        }
    },

    testList: function(test) {

        test.expect(1);
        bigIp.list()
            .then(function() {
                test.strictEqual(icontrolMock.lastCall.method, 'list');
            })
            .catch(function(err) {
                test.ok(false, err);
            })
            .finally(function() {
                test.done();
            });
    },

    testLoadConfig: {
        testNoFile: function(test) {

            test.expect(4);
            bigIp.loadConfig()
                .then(function() {
                    test.strictEqual(icontrolMock.lastCall.method, 'create');
                    test.strictEqual(icontrolMock.lastCall.path, '/tm/sys/config');
                    test.strictEqual(icontrolMock.lastCall.body.command, 'load');
                    test.strictEqual(icontrolMock.lastCall.body.name, 'default');
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },

        testFile: function(test) {
            var fileName = 'foobar';

            test.expect(1);
            bigIp.loadConfig(fileName)
                .then(function() {
                    test.strictEqual(icontrolMock.lastCall.body.options[0].file, fileName);
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },

        testOptions: function(test) {
            var options = {
                foo: 'bar',
                hello: 'world'
            };

            test.expect(2);
            bigIp.loadConfig(null, options)
                .then(function() {
                    test.strictEqual(icontrolMock.lastCall.body.options[0].foo, options.foo);
                    test.strictEqual(icontrolMock.lastCall.body.options[1].hello, options.hello);
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },
    },

    testLoadUcs: {
        setUp: function(callback) {
            icontrolMock.when('create', TASK_PATH, {_taskId: '1234'});
            icontrolMock.when('list', TASK_PATH + '/1234/result', {_taskState: 'COMPLETED'});

            callback();
        },

        testBasic: function(test) {

            test.expect(1);
            bigIp.loadUcs('/tmp/foo')
                .then(function() {
                    test.deepEqual(icontrolMock.getRequest('replace', TASK_PATH + '/1234'), {_taskState: 'VALIDATING'});
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testOptions: function(test) {
            test.expect(1);
            bigIp.loadUcs('/tmp/foo', {foo: 'bar', hello: 'world'})
                .then(function() {
                    var command = icontrolMock.getRequest('create', TASK_PATH);
                    test.deepEqual(command.options, [{foo: 'bar'}, {hello: 'world'}]);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testNeverComplete: function(test) {
            icontrolMock.when('list', TASK_PATH + '/1234/result', {_taskState: 'PENDING'});
            test.expect(1);
            bigIp.loadUcs('/tmp/foo', undefined, util.NO_RETRY)
                .then(function() {
                    test.ok(false, 'Should not have completed');
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testFailed: function(test) {
            icontrolMock.when('list', TASK_PATH + '/1234/result', {_taskState: 'FAILED'});
            test.expect(1);
            bigIp.loadUcs('/tmp/foo')
                .then(function() {
                    test.ok(false, 'Should not have completed');
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testRestjavadRestart: function(test) {
            icontrolMock.fail('list', TASK_PATH + '/1234/result');
            test.expect(1);
            bigIp.loadUcs('/tmp/foo', undefined, util.NO_RETRY)
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testPasswordUrl: function(test) {
            var fs = require('fs');
            var password = 'myPassword';
            var passwordFile = '/tmp/passwordFromUrlTest';
            var passwordUrl = 'file://' + passwordFile;

            fs.writeFileSync(passwordFile, password);

            bigIp.init('host', 'user', passwordUrl, {passwordIsUrl: true})
                .then(function() {
                    bigIp.icontrol = icontrolMock;
                    bigIp.password = '';
                    bigIp.loadUcs('/tmp/foo')
                        .then(function() {
                            test.strictEqual(bigIp.password, password);
                        })
                        .catch(function(err) {
                            test.ok(false, err);
                        })
                        .finally(function() {
                            fs.unlinkSync(passwordFile);
                            test.done();
                        });
                    });
        }
    },

    testPing: {
        testNoAddress: function(test) {
            test.expect(1);
            bigIp.ping()
                .then(function() {
                    test.ok(false, 'Ping with no address should have been rejected.');
                })
                .catch(function(err) {
                    test.notStrictEqual(err.message.indexOf('Address is required'), -1);
                })
                .finally(function() {
                    test.done();
                });
        },

        testPacketsReceived: function(test) {
            icontrolMock.when('create',
                              '/tm/util/ping',
                              {
                                  commandResult: "PING 104.219.104.168 (104.219.104.168) 56(84) bytes of data.\n64 bytes from 104.219.104.168: icmp_seq=1 ttl=240 time=43.5 ms\n\n--- 104.219.104.168 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 43ms\nrtt min/avg/max/mdev = 43.593/43.593/43.593/0.000 ms\n"
                              });
            test.expect(1);
            bigIp.ping('1.2.3.4')
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err.message);
                })
                .finally(function() {
                    test.done();
                });
        },

        testNoPacketsReceived: function(test) {
            icontrolMock.when('create',
                              '/tm/util/ping',
                              {
                                  commandResult: "PING 1.2.3.4 (1.2.3.4) 56(84) bytes of data.\n\n--- 1.2.3.4 ping statistics ---\n2 packets transmitted, 0 received, 100% packet loss, time 2000ms\n\n"
                              });
            test.expect(1);
            bigIp.ping('1.2.3.4', util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ping with no packets should have failed.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testUnknownHost: function(test) {
            icontrolMock.when('create',
                              '/tm/util/ping',
                              {
                                  commandResult: "ping: unknown host f5.com\n"
                              });
            test.expect(1);
            bigIp.ping('1.2.3.4', util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ping with unknown host should have failed.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testUnexpectedResponse: function(test) {
            icontrolMock.when('create',
                              '/tm/util/ping',
                              {
                                  commandResult: "foobar"
                              });
            test.expect(1);
            bigIp.ping('1.2.3.4', util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ping with unexpected response should have failed.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testNoResponse: function(test) {
            icontrolMock.setDefaultResponse(undefined);
            icontrolMock.when('create',
                              '/tm/util/ping',
                              undefined);
            test.expect(1);
            bigIp.ping('1.2.3.4', util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ping with no response should have failed.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        }
    },

    testReady: {
        setUp: function(callback) {
            bigIp.ready = realReady;

            icontrolMock.when(
                'list',
                '/shared/echo-js/available',
                {}
            );

            icontrolMock.when(
                'list',
                '/shared/identified-devices/config/device-info/available',
                {}
            );

            icontrolMock.when(
                'list',
                '/tm/sys/available',
                {}
            );

            icontrolMock.when(
                'list',
                '/tm/cm/available',
                {}
            );

            icontrolMock.when(
                'list',
                '/tm/sys/mcp-state/',
                {
                    entries: {
                        entry: {
                            nestedStats: {
                                entries: {
                                    phase: {
                                        description: 'running'
                                    }
                                }
                            }
                        }
                    }
                }
            );

            callback();
        },

        testBasic: function(test) {
            test.expect(1);
            bigIp.ready(util.NO_RETRY)
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testAvailabilityFail: function(test) {
            icontrolMock.fail(
                'list',
                '/shared/echo-js/available'
            );

            test.expect(1);
            bigIp.ready(util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ready should have failed availability.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testMcpNotReady: function(test) {
            icontrolMock.when(
                'list',
                '/tm/sys/mcp-state/',
                {
                    entries: {
                        entry: {
                            nestedStats: {
                                entries: {
                                    phase: {
                                        description: 'foo'
                                    }
                                }
                            }
                        }
                    }
                }
            );

            test.expect(1);
            bigIp.ready(util.NO_RETRY)
                .then(function() {
                    test.ok(false, "Ready should have failed MCP check.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        },

        testMcpCheckReject: function(test) {
            icontrolMock.fail('list', '/tm/sys/mcp-state/');

            test.expect(1);
            bigIp.ready(util.NO_RETRY)
                .then(function() {
                    test.ok(false, "MCP check should have rejected.");
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
        }
    },

    testReboot: function(test) {
        icontrolMock.when('create', '/tm/sys', {});
        test.expect(3);
        bigIp.reboot()
            .then(function() {
                test.strictEqual(icontrolMock.lastCall.method, 'create');
                test.strictEqual(icontrolMock.lastCall.path, '/tm/sys');
                test.strictEqual(icontrolMock.lastCall.body.command, 'reboot');
            })
            .catch(function(err) {
                test.ok(false, err);
            })
            .finally(function() {
                test.done();
            });
    },

    testRebootRequired: {
        testRebootRequired: function(test) {
            icontrolMock.when(
                'list',
                '/tm/sys/db/provision.action',
                {
                    value: 'reboot'
                }
            );

            test.expect(3);
            bigIp.rebootRequired()
                .then(function(rebootRequired) {
                    test.strictEqual(icontrolMock.lastCall.method, 'list');
                    test.strictEqual(icontrolMock.lastCall.path,'/tm/sys/db/provision.action');
                    test.ok(rebootRequired, 'Reboot should have been required.');
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testRebootNotRequired: function(test) {
            icontrolMock.when(
                'list',
                '/tm/sys/db/provision.action',
                {
                    value: 'none'
                }
            );

            test.expect(1);
            bigIp.rebootRequired()
                .then(function(rebootRequired) {
                    test.ifError(rebootRequired);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testUnexpectedResponse: function(test) {
            icontrolMock.when(
                'list',
                '/tm/sys/db/provision.action',
                {}
            );

            test.expect(1);
            bigIp.rebootRequired(util.NO_RETRY)
                .then(function() {
                    test.ok(false, 'rebootRequired with no value should not have resolved.');
                })
                .catch(function(err) {
                    test.notStrictEqual(err.message.indexOf('no value'), -1);
                })
                .finally(function() {
                    test.done();
                });
        },

        testFailedActionCheck: function(test) {
            icontrolMock.fail('list', '/tm/sys/db/provision.action');
            test.expect(1);
            bigIp.rebootRequired(util.NO_RETRY)
                .then(function() {
                    test.ok(false, 'rebootRequired with failed action check should not have resolved.');
                })
                .catch(function() {
                    test.ok(true);
                })
                .finally(function() {
                    test.done();
                });
            }
    },

    testSave: {
        testNoFile: function(test) {
            icontrolMock.when('create', '/tm/sys/config', {});

            test.expect(4);
            bigIp.save()
                .then(function() {
                    test.strictEqual(icontrolMock.lastCall.method, 'create');
                    test.strictEqual(icontrolMock.lastCall.path, '/tm/sys/config');
                    test.strictEqual(icontrolMock.lastCall.body.command, 'save');
                    test.strictEqual(icontrolMock.lastCall.body.options, undefined);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testFile: function(test) {
            icontrolMock.when('create', '/tm/sys/config', {});

            test.expect(1);
            bigIp.save('foo')
                .then(function() {
                    test.strictEqual(icontrolMock.lastCall.body.options[0].file, 'foo');
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        }
    },

    testTransaction: {

        testBasic: function(test) {
            var commands = [
                {
                    method: 'list',
                    path: '/foo/bar'
                },
                {
                    method: 'create',
                    path: '/bar/foo',
                    body: {
                        foo: 'bar'
                    }
                },
                {
                    method: 'modify',
                    path: '/hello/world',
                    body: {
                        roger: 'dodger'
                    }
                },
                {
                    method: 'delete',
                    path: '/okie/dokie'
                }
            ];

            var transId = '1234';

            icontrolMock.when('create',
                              '/tm/transaction/',
                              {
                                  transId: transId
                              });

            icontrolMock.when('modify',
                              '/tm/transaction/' + transId,
                              {
                                  state: 'COMPLETED'
                              }
                              );

            test.expect(5);
            bigIp.transaction(commands)
                .then(function() {
                    test.strictEqual(icontrolMock.getRequest('list', '/foo/bar'), null);
                    test.deepEqual(icontrolMock.getRequest('create', '/bar/foo'), {foo: 'bar'});
                    test.deepEqual(icontrolMock.getRequest('modify', 'hello/world', {roger: 'dodger'}));
                    test.deepEqual(icontrolMock.getRequest('delete', '/okie/dokie'), null);
                    test.deepEqual(icontrolMock.getRequest('modify', '/tm/transaction/1234'), { state: 'VALIDATING' });
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        },

        testIncomplete: function(test) {
            var commands = [
                {
                    method: 'list',
                    path: '/foo/bar'
                }
            ];

            var transId = '1234';

            icontrolMock.when('create',
                              '/tm/transaction/',
                              {
                                  transId: transId
                              });

            icontrolMock.when('modify',
                              '/tm/transaction/' + transId,
                              {
                                  state: 'FOOBAR'
                              }
                              );

            test.expect(1);
            bigIp.transaction(commands)
                .then(function() {
                    test.ok(false, "Transaction should have rejected incomplete");
                })
                .catch(function(err) {
                    test.notStrictEqual(err.message.indexOf('not completed'), -1);
                })
                .finally(function() {
                    test.done();
                });
        },

        testNoCommands: function(test) {
            test.expect(1);
            bigIp.transaction()
                .then(function() {
                    test.ok(true);
                })
                .catch(function(err) {
                    test.ok(false, err);
                })
                .finally(function() {
                    test.done();
                });
        }
    }
};
