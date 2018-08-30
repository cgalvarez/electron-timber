'use strict';

const {inspect} = require('util');
const {existsSync} = require('fs');
const {dirname, join, relative, sep} = require('path');
const callsites = require('callsites');

const {inspectMainOptions, text} = require('./constants');

const transports = [
	'console'
];

const utils = {
	_calcMaxLength(accumulator, currentValue) {
		const currentLength = currentValue.length;
		return (currentLength > accumulator) ? currentLength : accumulator;
	},

	_findCaller() {
		for (const caller of callsites()) {
			const filename = caller.getFileName();
			if (filename !== 'module.js' && /[/\\]electron-timber[/\\]/.test(filename) === false) {
				return filename;
			}
		}
	},

	capitalize(txt) {
		return txt.replace(/(?:^|\s)\S/g, a => a.toUpperCase());
	},

	contrastRatio(luminanceA, luminanceB, delta = 0.05) {
		// See https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
		return (luminanceA > luminanceB) ?
			((luminanceA + delta) / (luminanceB + delta)) :
			((luminanceB + delta) / (luminanceA + delta));
	},

	envHas(clFlag) {
		return utils.has(process.env, clFlag);
	},

	getPackageName() {
		let path = utils._findCaller();
		if (!path) {
			return;
		}

		// Search upwards until a `package.json` is found.
		let pkgName;
		while (path && !pkgName) {
			path = dirname(path);
			const packageJsonPath = join(path, 'package.json');
			if (existsSync(packageJsonPath)) {
				pkgName = require(packageJsonPath).name;
			}
		}

		return pkgName;
	},

	getTransports(basePath) {
		const map = {};
		const relBasePath = relative(__dirname, basePath);
		transports.forEach(transport => {
			const modulePath = '.' + sep + join(relBasePath, 'transports', transport);
			const transportModule = require(modulePath);
			map[transportModule.type] = transportModule;
		});
		return map;
	},

	has(object, key) {
		return {}.hasOwnProperty.call(object, key);
	},

	hasMethod(object, method) {
		return typeof object[method] === 'function';
	},

	/**
	 * @summary Converts an hexadecimal color to RGB components.
	 * @param   {String} hex The full hexadecimal color (inc. leading shebang) to convert.
	 * @return  {Object}     The object with the caculated RGB components.
	 * @author  Tim Down <https://stackoverflow.com/questions/5623838/#answer-5624139>
	 */
	hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	},

	/**
	 * @summary Checks if `v` is an array (`true`) or not (`false`).
	 * @param   {Any}     v The value to check.
	 * @return  {Boolean}   `true` if array; `false` otherwise.
	 */
	isArray(v) {
		return Object.prototype.toString.call(v) === '[object Array]';
	},

	isNil(v) {
		return v === undefined || v === null;
	},

	/**
	 * @summary Checks if `v` is an object (`true`) or not (`false`).
	 * @param   {Any}     v The value to check.
	 * @return  {Boolean}   `true` if object; `false` otherwise.
	 */
	isObject(v) {
		return Object.prototype.toString.call(v) === '[object Object]';
	},

	isSimpleType(v) {
		switch (Object.prototype.toString.call(v)) {
			case '[object Boolean]':
			case '[object Number]':
			case '[object String]':
			case '[object Null]':
			case '[object Undefined]':
				return true;
			default:
				return false;
		}
	},

	/**
	 * @summary Checks if `v` is a string (`true`) or not (`false`).
	 * @param   {Any}     v The value to check.
	 * @return  {Boolean}   `true` if string; `false` otherwise.
	 */
	isString(v) {
		return (typeof v === 'string');
	},

	/**
	 * @summary Calculates the grayscale representation of luminance for `hexColor`.
	 * @param   {String} hexColor The full hexadecimal color (inc. leading shebang).
	 * @return  {Number}          The grayscale representation of luminance.
	 * @author  kirilloid <https://stackoverflow.com/questions/9733288/#answer-9733420>
	 */
	luminance(hexColor) {
		const color = utils.hexToRgb(hexColor);
		const l = [color.r, color.g, color.b].map(v => {
			v /= 255;
			return v <= 0.03928 ? (v / 12.92) : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return (0.2126 * l[0]) + (0.7152 * l[1]) + (0.0722 * l[2]);
	},

	mapEnvCsvVar(clFlag, defaults = []) {
		return new Map(utils.envHas(clFlag) ? process.env[clFlag].split(',') : defaults);
	},

	oneOf(allowed, value) {
		return allowed.some(valid => (valid === value));
	},

	prettifyMainArg(arg, colorize = false) {
		const options = inspectMainOptions[colorize ? 'all' : 'none'];
		if (utils.isString(arg)) {
			return arg;
		}
		if (utils.isSimpleType(arg)) {
			return inspect(arg, options);
		}
		return text.lf + inspect(arg, options);
	},

	/**
	 * @summary Lightens `hexColor` the specified `percent` if positive; otherwise darkens it.
	 * @param   {String} color   Hexadecimal color to shade (light/darken) with '#' prepended.
	 * @param   {Float}  percent Percentage between -1 (darken) and 1 (lighten).
	 * @return  {String}         The shaded color.
	 * @author  Pimp Trizkit <https://stackoverflow.com/questions/5560248/#answer-13542669> (v2-hex);
	 */
	shadeColor(hexColor, percent) {
		const f = parseInt(hexColor.slice(1), 16);
		const t = (percent < 0) ? 0 : 255;
		const p = (percent < 0) ? (percent * -1) : percent;
		const R = f >> 16;
		const G = (f >> 8) & 0x00FF;
		const B = f & 0x0000FF;
		return '#' + (0x1000000 + ((Math.round((t - R) * p) + R) * 0x10000) +
			((Math.round((t - G) * p) + G) * 0x100) + (Math.round((t - B) * p) + B)).toString(16).slice(1);
	},

	/**
	 * Adapts a (captured) message from the browser console to be printed to the
	 * main console (which uses `chalk`). Since it could contain any custom CSS, we
	 * will strip every present custom CSS, since transforming every possible,
	 * custom, random CSS into chalk styles is a titanic, unfeasible work!
	 *
	 * @param [Any[]] args The browser console args.
	 * NOTE: Mutates `args`.
	 */
	stripCSS(args) {
		const numArgs = args.length - 1;

		if (numArgs < 1) {
			return;
		}

		for (let i = numArgs; i > 0; i -= 1) {
			if (utils.isString(args[i]) && args[i].endsWith(';')) {
				args.splice(i, 1);
			}
		}

		if (numArgs > args.length - 1) {
			args[0] = args[0].replace(/%[oOdisfc]/g, '');
		}

		return args;
	}
};

module.exports = utils;
