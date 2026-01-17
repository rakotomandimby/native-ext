'use strict'; module.exports = async ({ config, }) => { const browser = { }; {

/**
 * This module collects and exposes information about the connecting browser and extension.
 * It is available as `require('browser')` for the extension modules.
 */

const FS = require('fs'), Path = require('path');

browser.name = config.browser; // 'firefox'
browser.profileDir = config.profile; // e.g. `C:\Users\<user>\AppData\Roaming\Mozilla\Firefox\Profiles\<rand>.<name>`
if (browser.name !== 'firefox') { throw new Error(`Only Firefox is supported`); }

const extId = browser.extId = process.argv[5];
if (config.locations && (extId in config.locations)) {
	const path = config.locations[extId]; let stat;
	try { stat = FS.statSync(path); } catch (_) { }
	if (stat && stat.isDirectory()) { browser.extDir = path; }
	else if (stat && stat.isFile()) { browser.extFile = path; }
	else { throw new Error(`Location configured for ${extId} is not accessable`); }
} else {
	if (browser.name === 'firefox') {
		const path = Path.join(browser.profileDir, 'extensions', extId); let stat;
		try { stat = FS.statSync(path +'.xpi'); } catch (_) { }
		if (stat && stat.isFile()) { browser.extFile = path +'.xpi'; }
		else {
			try { stat = FS.statSync(path); } catch (_) { }
			if (stat && stat.isDirectory()) { browser.extDir = path; }
			else { throw new Error(`The extension ${extId} is not installed in the default location in ${browser.profileDir}`); }
		}
	}
}


/// pid of the browser main process
lazy(browser, 'pid', () => {
	const ppid = require('./get-ppid.js');
	return ppid(ppid(process.pid));
});


function lazy(obj, prop, getter) {
	Object.defineProperty(obj, prop, { configurable: true, enumerable: true, get() {
		const value = getter();
		Object.defineProperty(obj, prop, { value, });
		return value;
	}, });
}

} return browser; };
