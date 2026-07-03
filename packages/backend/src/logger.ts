/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import cluster from 'node:cluster';
import chalk from 'chalk';
import { default as convertColor } from 'color-convert';
import { format as dateFormat } from 'date-fns';
import fetch from 'node-fetch';
import * as http from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { bindThis } from '@/decorators.js';
import { envOption } from './env.js';
import type { Keyword } from 'color-convert';

type Context = {
	name: string;
	color?: Keyword;
};

type Level = 'error' | 'success' | 'warning' | 'debug' | 'info';

// eslint-disable-next-line import/no-default-export
export default class Logger {
	private context: Context;
	private parentLogger: Logger | null = null;
	private logQueue: any[] = [];

	constructor(context: string, color?: Keyword) {
		this.context = {
			name: context,
			color: color,
		};
		if (process.env.LOG_URL) {
			this.sendLogLoop(); // don't await
		}
	}

	@bindThis
	public createSubLogger(context: string, color?: Keyword): Logger {
		const logger = new Logger(context, color);
		logger.parentLogger = this;
		return logger;
	}

	@bindThis
	private async sendLogLoop(): void {
		const httpAgent = http.Agent({
			keepAlive: true,
			keepAliveMsecs: 300 * 1000,
			maxSockets: 2,
			maxFreeSockets: 2,
			scheduling: 'lifo',
		});
		const headers = {
			'Content-Type': 'application/json',
			'Authorization': `Basic ${btoa(`${process.env.LOG_USER}:${process.env.LOG_PASSWORD}`)}`,
		};
		const batchSize = 20;
		var loggedError: number = 0;
		while (true) {
			const sending: any[] = this.logQueue.splice(0, batchSize);
			if (sending.length > 0) {
				while (true) {
					try {
						const response = await fetch(process.env.LOG_URL, {
							method: 'POST',
							headers: headers,
							body: JSON.stringify(sending),
							agent: httpAgent,
						});
						if (!response.ok) {
							throw new Error(`Sending log failed with status code ${response.status}, ${response.statusText}`);
						}
						break;
					} catch (e) {
						if (loggedError < 5) {
							loggedError++;
							console.log(e);
						}
						await setTimeout(5000);
					}
				}
			} else {
				await setTimeout(1000);
			}
		}
	}

	@bindThis
	private log(level: Level, message: string, data?: Record<string, any> | null, important = false, subContexts: Context[] = []): void {
		if (envOption.quiet) return;

		if (this.parentLogger) {
			this.parentLogger.log(level, message, data, important, [this.context].concat(subContexts));
			return;
		}

		const now = new Date();
		const time = dateFormat(now, 'HH:mm:ss');
		const worker = cluster.isPrimary ? '*' : cluster.worker!.id;
		const l =
			level === 'error' ? important ? chalk.bgRed.white('ERR ') : chalk.red('ERR ') :
			level === 'warning' ? chalk.yellow('WARN') :
			level === 'success' ? important ? chalk.bgGreen.white('DONE') : chalk.green('DONE') :
			level === 'debug' ? chalk.gray('VERB') :
			level === 'info' ? chalk.blue('INFO') :
			null;
		const contexts = [this.context].concat(subContexts).map(d => d.color ? chalk.rgb(...convertColor.keyword.rgb(d.color))(d.name) : chalk.white(d.name));
		const m =
			level === 'error' ? chalk.red(message) :
			level === 'warning' ? chalk.yellow(message) :
			level === 'success' ? chalk.green(message) :
			level === 'debug' ? chalk.gray(message) :
			level === 'info' ? message :
			null;

		let log = `${l} ${worker}\t[${contexts.join(' ')}]\t${m}`;
		if (envOption.withLogTime) log = chalk.gray(time) + ' ' + log;

		const args: unknown[] = [important ? chalk.bold(log) : log];
		if (data != null) {
			args.push(data);
		}
		console.log(...args);

		this.logQueue.push({
			_timestamp: now.getTime() * 1000,
			worker, level, message, data, important,
			context: this.context.name,
			contexts: [this.context].concat(subContexts).map(x => x.name)
		});
	}

	@bindThis
	public error(x: string | Error, data?: Record<string, any> | null, important = false): void { // 実行を継続できない状況で使う
		if (x instanceof Error) {
			data = data ?? {};
			data.e = x;
			this.log('error', x.toString(), data, important);
		} else if (typeof x === 'object') {
			this.log('error', `${(x as any).message ?? (x as any).name ?? x}`, data, important);
		} else {
			this.log('error', `${x}`, data, important);
		}
	}

	@bindThis
	public warn(message: string, data?: Record<string, any> | null, important = false): void { // 実行を継続できるが改善すべき状況で使う
		this.log('warning', message, data, important);
	}

	@bindThis
	public succ(message: string, data?: Record<string, any> | null, important = false): void { // 何かに成功した状況で使う
		this.log('success', message, data, important);
	}

	@bindThis
	public debug(message: string, data?: Record<string, any> | null, important = false): void { // デバッグ用に使う(開発者に必要だが利用者に不要な情報)
		if (process.env.NODE_ENV !== 'production' || envOption.verbose) {
			this.log('debug', message, data, important);
		}
	}

	@bindThis
	public info(message: string, data?: Record<string, any> | null, important = false): void { // それ以外
		this.log('info', message, data, important);
	}
}
