/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class User1775217893584 {
    name = 'User1775217893584'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" ADD "isInsensitive" boolean NOT NULL DEFAULT false`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isInsensitive"`);
    }
}
