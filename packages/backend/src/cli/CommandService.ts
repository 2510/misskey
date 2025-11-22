/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import type { FollowingsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { QueueService } from '@/core/QueueService.js';
import { SystemAccountService } from '@/core/SystemAccountService.js';

@Injectable()
export class CommandService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		private metaService: MetaService,
		private queueService: QueueService,
		private systemAccountService: SystemAccountService,

		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
	) {
	}

	@bindThis
	public async ping() {
		console.log('pong');
	}

	@bindThis
	public async resetCaptcha() {
		await this.metaService.update({
			enableHcaptcha: false,
			hcaptchaSiteKey: null,
			hcaptchaSecretKey: null,
			enableMcaptcha: false,
			mcaptchaSitekey: null,
			mcaptchaSecretKey: null,
			mcaptchaInstanceUrl: null,
			enableRecaptcha: false,
			recaptchaSiteKey: null,
			recaptchaSecretKey: null,
			enableTurnstile: false,
			turnstileSiteKey: null,
			turnstileSecretKey: null,
			enableTestcaptcha: false,
		});
	}

	@bindThis
	public async unfollowFromProxy() {
		const proxy = await this.systemAccountService.fetch('proxy');

		// based-on: queue/processors/ExportFollowingProcessorService.ts
		let cursor: MiFollowing['id'] | null = null;
		while (true) {
			const followings = await this.followingsRepository.find({
				where: {
					followerId: proxy.id,
					...(cursor ? { id: MoreThan(cursor) } : {}),
				},
				take: 100,
				order: {
					id: 1,
				},
			}) as MiFollowing[];

			if (followings.length === 0) {
				break;
			}
			console.log(`Unfollowing ${followings.length} accounts...`);

			cursor = followings.at(-1)?.id ?? null;

			for (const following of followings) {
				this.queueService.createUnfollowJob([{ from: { id: proxy.id }, to: { id: following.followeeId } }]);
			}
		}
		console.log(`Requests successfully queued.`);
	}
}
