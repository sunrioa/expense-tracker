/**
 * 业务异常：能直接给用户看的错误，映射为 HTTP 400。
 * 对应原 com.ledger.common.BusinessException。
 */
export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessError';
  }
}
