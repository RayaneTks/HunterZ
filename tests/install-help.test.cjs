const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getInstallHelp } = require('../lib/pwa-install');
test('touch Mac is iPadOS with install help',()=>assert.equal(getInstallHelp({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',maxTouchPoints:5}).kind,'ios-help'));
test('embedded browsers explain how to open real browser',()=>assert.equal(getInstallHelp({userAgent:'Mozilla iPhone Instagram',maxTouchPoints:1}).kind,'webview-help'));
test('native prompt only advertised when supplied',()=>assert.equal(getInstallHelp({userAgent:'Android Chrome',maxTouchPoints:1,hasPrompt:false}).kind,'browser-help'));
test('installed app hides install affordance',()=>assert.equal(getInstallHelp({standalone:true}).kind,'installed'));
