/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddCacheRemoteKnownMissingFilesMeta1746517415409 {
	name = 'AddCacheRemoteKnownMissingFilesMeta1746517415409'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" ADD "cacheRemoteKnownMissingFiles" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "cacheRemoteKnownMissingFiles"`);
    }
}
