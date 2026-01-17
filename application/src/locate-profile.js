'use strict'; module.exports = ({ config, }) => { /* globals Buffer, */

const FS = require('fs'), Path = require('path');
const home = require('os').homedir();

/**
 * Tries to locate the current profile based on a magic value the management extension has written
 * to its `browser.storage.local`. It basically checks all default locations for profiles for that value.
 * @param  {string}  magic   Random string (base64 to avoid encoding issues) in the `browser.storage.local`.
 * @param  {string}  extId   Extension id of the management extension.
 * @return {string}
 */
return async function({ magic, extId, }) {

	// step 1: find all dirs that contain the profiles to check
	if (config.browser !== 'firefox') { throw new Error(`Only Firefox is supported`); }
	let parents = [ ], names = null; {

		const { cwd, args, } = getBrowserArgs(); // get from cli
		const iProfileArg = args.findIndex(arg => (/^"?-profile"?$/i).test(arg)) + 1;
		if (iProfileArg !== 0 && args[iProfileArg]) {
			const path = makeAbsolute(args[iProfileArg].replace(/^"|"$/g, ''), cwd);
			if (path) {
				names = [ Path.basename(path), ]; parents = [ Path.dirname(path), ];
			}
		} else {
			// there is also a flag to choose a specific profile in the default location, but we should find that anyway
			switch (process.platform) { // use default, no configuration in for firefox
				case 'win32': {
					parents = [ process.env.APPDATA + String.raw`\Mozilla\Firefox\Profiles`, ];
				} break;
				case 'linux': {
					parents = [ home +'/.mozilla/firefox', ]; // directly in there
				} break;
				case 'darwin': {
					parents = [ home +'/Library/Application Support/Firefox/Profiles/', ];
				} break;
				default: throw new Error(`Unknown OS ${process.platform}`);
			}
		}
	}

	magic = Buffer.from(magic, 'utf-8');
	const path = `/browser-extension-data/${extId}/storage.js`;


	// step 2: check all possible locations for that magic value
	return (await Promise.all([ ].concat(...parents.map(dir => { try {
		return (names || FS.readdirSync(dir)).map(name => Path.join(dir, name));
	} catch (_) { return null; } }).filter(_=>_)).map(profile => new Promise(done => {
		FS.readFile(profile + path, (error, data) => {
			if (error) { done(null); return; }
			done(data.includes(magic) ? Path.normalize(profile) : null);
		});
	})))).find(_=>_);

};

function makeAbsolute(path, base) {
	if (Path.isAbsolute(path)) { return path; }
	if (path.startsWith('~/')) { // TODO: do these have env vars expanded? If not, replace HOME/APPDATA/...
		if (process.platform === 'win32') { return null; }
		else { return Path.join(home, path.slice(2)); }
	} else { return base ? Path.resolve(base, path) : null; }
}

function getBrowserArgs() {
	const exec = require('child_process').execFileSync;
	const ppid = require('./get-ppid.js'), pid = ppid(ppid(process.pid));
	switch (process.platform) {
		case 'win32': {
			const command = exec(
				'wmic', `process where processId=${pid} get CommandLine`.split(' '),
				{ encoding: 'utf-8', }
			).slice('CommandLine'.length + 2).trim();
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd: null, args, };
		}
		case 'linux': {
			const cwd = FS.realpathSync(`/proc/${pid}/cwd`);
			const command = FS.readFileSync(`/proc/${pid}/cmdline`, 'utf-8').replace(/\0$/, '');
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd, args, };
		}
		case 'darwin': {
			// see stackoverflow.com/q/8327139 for cwd and possibly a ffi solution
			const command = exec('ps', [ '-p', pid+'', '-o', 'command', ], { encoding: 'utf-8', }).split(/\n/g)[1];
			const args = [ ]; command.replace(/".*?"|(?:[^\s\\]|\\ |\\)+(?:".*?")?/g, s => (args.push(s), ''));
			return { cwd: null, args, };
		}
		default: throw new Error(`Unknown OS ${process.platform}`);
	}
}

};
