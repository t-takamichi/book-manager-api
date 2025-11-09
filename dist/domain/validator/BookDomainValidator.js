import { DomainValidationError } from '../../domain/errors/customErrors.js';
export class BookDomainValidator {
    /**
     * ドメイン（ビジネス）レベルの検証。
     * ここでは例として、検索語が存在する場合は3文字以上を要求するというビジネスルールを置いています。
     * 将来的に「禁止語」や「特定パターン禁止」などのルールを追加してください。
     */
    static validate(query) {
        if (!query)
            return; // 空クエリはドメインでは許容（全件取得など）
        const trimmed = query.trim();
        if (trimmed.length > 0 && trimmed.length < 3) {
            throw new DomainValidationError('Query parameter must be at least 3 characters for business reasons.');
        }
        // 例: 禁止語チェック
        // const forbidden = ['forbidden', 'banned'];
        // if (forbidden.includes(trimmed.toLowerCase())) {
        //   throw new Error('This search term is not allowed.');
        // }
    }
}
